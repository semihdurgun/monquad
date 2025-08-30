import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  try {
    // 1. JWT Authentication
    const authenticatedUser = await requireAuth(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get query parameters
    const url = new URL(request.url);
    const roundId = url.searchParams.get('roundId');

    if (!roundId) {
      return NextResponse.json({ error: 'Missing roundId parameter' }, { status: 400 });
    }

    // 3. Get round data from Redis
    const redis = await getRedisClient();
    const roundDataStr = await redis.get(`pin-round:${roundId}`);
    
    if (!roundDataStr) {
      return NextResponse.json({ error: 'Round not found or expired' }, { status: 404 });
    }

    const roundData: PinGameRoundData = JSON.parse(roundDataStr);

    // Ensure numeric fields are properly typed
    roundData.startTime = Number(roundData.startTime);

    // 4. Verify round belongs to user (using wallet address)
    if (roundData.walletAddress !== authenticatedUser.walletAddress) {
      return NextResponse.json({ error: 'Round does not belong to user' }, { status: 403 });
    }

    // 5. Check if game time has expired (auto-complete if needed)
    const now = Date.now();
    const gameTimeElapsed = now - roundData.startTime;
    const maxGameTime = 5 * 60 * 1000; // 5 minutes
    let wasUpdated = false;
    
    if (gameTimeElapsed > maxGameTime && !roundData.gameState.isCompleted) {
      // Auto-complete expired game
      roundData.gameState.isCompleted = true;
      roundData.gameState.isWon = false;
      roundData.gameState.score = 0;
      wasUpdated = true;
    }

    // 6. Update Redis if game state changed
    if (wasUpdated) {
      await redis.setEx(`pin-round:${roundId}`, 600, JSON.stringify(roundData));
    }

    // 7. Prepare response with PUBLIC information only
    const response = {
      roundId,
      startTime: roundData.startTime,
      timeElapsed: gameTimeElapsed,
      timeRemaining: Math.max(0, maxGameTime - gameTimeElapsed),
      isCompleted: roundData.gameState.isCompleted,
      isWon: roundData.gameState.isWon,
      score: roundData.gameState.score,
      attempts: roundData.gameState.attempts.map(attempt => ({
        guess: attempt.guess,
        result: attempt.result,
        attemptNumber: attempt.attemptNumber,
        timestamp: attempt.timestamp
      })),
      attemptsUsed: roundData.gameState.attempts.length,
      attemptsRemaining: roundData.gameState.maxAttempts - roundData.gameState.attempts.length,
      maxAttempts: roundData.gameState.maxAttempts,
      serverTimestamp: now
    };

    // 8. Only reveal secret code if game is completed
    if (roundData.gameState.isCompleted) {
      (response as any).secretCode = roundData.secretCode;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ PIN Game get status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Alternative endpoint for getting user's active round (if any)
export async function POST(request: NextRequest) {
  try {
    const authenticatedUser = await requireAuth(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // This could be enhanced to search for active rounds by user ID
    // For now, return a simple response
    return NextResponse.json({ 
      message: 'Use GET method with roundId parameter to check specific round status' 
    });

  } catch (error) {
    console.error('❌ PIN Game get active round error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
