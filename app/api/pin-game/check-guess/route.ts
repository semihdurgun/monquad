import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth/middleware-helpers';
import { getRedisClient } from '@/lib/redis';

interface PinGameRoundData {
  walletAddress: string;
  secretKey: string;
  secretCode: string;
  startTime: number;
  gameState: {
    attempts: PinGuess[];
    maxAttempts: number;
    isCompleted: boolean;
    isWon: boolean;
    score: number;
  };
}

interface PinGuess {
  guess: string;
  timestamp: number;
  result: {
    correct: number;
    close: number;
  };
  attemptNumber: number;
}

interface GuessResult {
  correct: number; // Exact matches (right digit, right position)
  close: number;   // Right digit, wrong position
}

export async function POST(request: NextRequest) {
  try {
    // 1. JWT Authentication
    const authenticatedUser = await requireAuth(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { roundId, guess, timestamp } = body;

    if (!roundId || !guess || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Validate guess format (4 digits)
    if (!/^\d{4}$/.test(guess)) {
      return NextResponse.json({ error: 'Invalid guess format. Must be 4 digits (0000-9999)' }, { status: 400 });
    }

    // 4. Get round data from Redis
    const redis = await getRedisClient();
    const roundDataStr = await redis.get(`pin-round:${roundId}`);
    
    if (!roundDataStr) {
      return NextResponse.json({ error: 'Round not found or expired' }, { status: 404 });
    }

    const roundData: PinGameRoundData = JSON.parse(roundDataStr);
    
    // Ensure numeric fields are properly typed
    roundData.startTime = Number(roundData.startTime);

    // 5. Verify round belongs to user (using wallet address)
    if (roundData.walletAddress !== authenticatedUser.walletAddress) {
      console.error(`❌ Wallet mismatch: Round belongs to ${roundData.walletAddress}, but authenticated user is ${authenticatedUser.walletAddress}`);
      return NextResponse.json({ error: 'Round does not belong to user' }, { status: 403 });
    }

    // 6. Check if game is already completed
    if (roundData.gameState.isCompleted) {
      return NextResponse.json({ error: 'Game is already completed' }, { status: 400 });
    }

    // 7. Check if maximum attempts reached
    if (roundData.gameState.attempts.length >= roundData.gameState.maxAttempts) {
      return NextResponse.json({ error: 'Maximum attempts reached' }, { status: 400 });
    }

    // 8. SIMPLIFIED VALIDATION: For PIN game, we rely on timing and attempt validation
    // The ticket system is not needed since we have other security measures
    console.log(`🎯 PIN Game guess received: ${guess} for round ${roundId}`);

    // 9. ANTI-CHEAT: Check if 5 minutes passed since game start
    const now = Date.now();
    const gameTimeElapsed = now - roundData.startTime;
    const maxGameTime = 5 * 60 * 1000; // 5 minutes
    
    if (gameTimeElapsed > maxGameTime) {
      // Mark game as completed (time expired)
      roundData.gameState.isCompleted = true;
      roundData.gameState.isWon = false;
      await redis.setEx(`pin-round:${roundId}`, 600, JSON.stringify(roundData));
      
      console.log(`⏰ Game expired: ${Math.floor(gameTimeElapsed / 1000)}s elapsed, max ${Math.floor(maxGameTime / 1000)}s`);
      
      return NextResponse.json({ 
        error: 'Game time expired (5 minutes)', 
        isCompleted: true,
        isWon: false,
        timeExpired: true
      }, { status: 400 });
    }

    // 11. ✅ ALL VALIDATIONS PASSED - Process the guess
    const guessResult = evaluateGuess(guess, roundData.secretCode);
    const attemptNumber = roundData.gameState.attempts.length + 1;

    const newAttempt: PinGuess = {
      guess: guess,
      timestamp: now,
      result: guessResult,
      attemptNumber: attemptNumber
    };

    // Add attempt to game state
    roundData.gameState.attempts.push(newAttempt);

    // 12. Check if game is won (4 correct digits)
    if (guessResult.correct === 4) {
      roundData.gameState.isCompleted = true;
      roundData.gameState.isWon = true;
      
      // Calculate score based on attempts and time used
      const timeUsed = now - roundData.startTime; // Time used in ms
      const maxTime = 5 * 60 * 1000; // 5 minutes
      const timeBonus = Math.max(0, Math.floor((maxTime - timeUsed) / 1000)); // Remaining time bonus
      const attemptBonus = Math.max(0, (roundData.gameState.maxAttempts - attemptNumber) * 100);
      roundData.gameState.score = 1000 + timeBonus + attemptBonus;
    }
    // 13. Check if max attempts reached
    else if (attemptNumber >= roundData.gameState.maxAttempts) {
      roundData.gameState.isCompleted = true;
      roundData.gameState.isWon = false;
      roundData.gameState.score = 0;
    }

    // 14. Update round data in Redis
    await redis.setEx(`pin-round:${roundId}`, 600, JSON.stringify(roundData));

    // 15. If game is won, update player score on blockchain
    if (roundData.gameState.isWon && roundData.gameState.score > 0) {
      try {
        console.log(`🎯 PIN Game won! Updating blockchain score: ${roundData.gameState.score}`);
        
        // Make internal API call to update-player
        const updatePlayerResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/update-player`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.API_KEY || '',
            'x-wallet-address': authenticatedUser.walletAddress,
            'x-username': authenticatedUser.username || ''
          },
          body: JSON.stringify({
            scoreAmount: roundData.gameState.score,
            transactionAmount: 1 // 1 game completed
          }),
        });

        if (updatePlayerResponse.ok) {
          const updateResult = await updatePlayerResponse.json();
          console.log(`✅ Blockchain score updated:`, updateResult);
        } else {
          const errorData = await updatePlayerResponse.json();
          console.error(`❌ Failed to update blockchain score:`, errorData);
        }
      } catch (error) {
        console.error('❌ Error calling update-player API:', error);
        // Don't fail the main response if blockchain update fails
      }
    }

    // 16. Return result to client (without revealing secret code unless game is completed)
    const response: any = {
      attemptNumber: attemptNumber,
      guess: guess,
      result: guessResult,
      isCompleted: roundData.gameState.isCompleted,
      isWon: roundData.gameState.isWon,
      attemptsRemaining: roundData.gameState.maxAttempts - attemptNumber,
      score: roundData.gameState.score,
      timestamp: now
    };

    // Only reveal secret code if game is completed
    if (roundData.gameState.isCompleted) {
      response.secretCode = roundData.secretCode;
    }

    console.log(`🎯 PIN Game attempt ${attemptNumber}/${roundData.gameState.maxAttempts} by wallet ${authenticatedUser.walletAddress}: ${guess} → ${guessResult.correct}C ${guessResult.close}N`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ PIN Game check guess error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function evaluateGuess(guess: string, secretCode: string): GuessResult {
  let correct = 0;
  let close = 0;
  
  const guessDigits = guess.split('');
  const secretDigits = secretCode.split('');
  const usedSecretIndices = new Set<number>();
  const usedGuessIndices = new Set<number>();

  // First pass: count correct positions (exact matches)
  for (let i = 0; i < 4; i++) {
    if (guessDigits[i] === secretDigits[i]) {
      correct++;
      usedSecretIndices.add(i);
      usedGuessIndices.add(i);
    }
  }

  // Second pass: count close positions (right digit, wrong position)
  for (let i = 0; i < 4; i++) {
    if (usedGuessIndices.has(i)) continue; // Skip already matched positions
    
    for (let j = 0; j < 4; j++) {
      if (usedSecretIndices.has(j)) continue; // Skip already matched positions
      
      if (guessDigits[i] === secretDigits[j]) {
        close++;
        usedSecretIndices.add(j);
        break; // Each guess digit can only match one secret digit
      }
    }
  }

  return { correct, close };
}
