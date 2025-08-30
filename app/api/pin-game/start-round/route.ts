import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth/middleware-helpers';
import { getRedisClient } from '@/lib/redis';

interface PinGameRoundData {
  walletAddress: string; // Unique identifier (wallet address)
  secretKey: string; // HMAC secret for validating guesses
  secretCode: string; // The 4-digit code to guess (0000-9999)
  startTime: number; // Game start timestamp - used for 5min validation
  gameState: {
    attempts: PinGuess[];
    maxAttempts: number;
    isCompleted: boolean;
    isWon: boolean;
    score: number;
  };
}

interface PinGuess {
  guess: string; // 4-digit guess
  timestamp: number;
  result: {
    correct: number; // Exact matches (right digit, right position)
    close: number;   // Right digit, wrong position
  };
  attemptNumber: number;
}

export async function POST(request: NextRequest) {
  try {
    // 1. JWT Authentication
    const authenticatedUser = await requireAuth(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Generate unique round identifiers and secrets
    const roundId = crypto.randomUUID();
    // SECRET KEY - NEVER SENT TO CLIENT! STORED ONLY IN REDIS
    const roundSecretKey = crypto.randomBytes(32).toString('hex');

    // 3. Generate the secret 4-digit code (SERVER AUTHORITY)
    const secretCode = generateSecretCode();

    // 4. Game timing - 5 minutes duration (frontend handles timer)
    const startTime = Date.now();
    const gameDuration = 5 * 60 * 1000; // 5 minutes in milliseconds (for client info)

    // 5. Store round data in Redis
    const redis = await getRedisClient();
    const roundData: PinGameRoundData = {
      walletAddress: authenticatedUser.walletAddress,
      secretKey: roundSecretKey,
      secretCode: secretCode,
      startTime: startTime,
      gameState: {
        attempts: [],
        maxAttempts: 8, // Maximum 8 attempts to guess
        isCompleted: false,
        isWon: false,
        score: 0
      }
    };

    // Store for 10 minutes (5 minutes game + 5 minutes buffer)
    await redis.setEx(`pin-round:${roundId}`, 600, JSON.stringify(roundData));

    console.log(`🎲 PIN Game Round ${roundId} started for wallet ${authenticatedUser.walletAddress}`);
    console.log(`🔍 DEBUG - Secret Code: ${secretCode}`);

    // 6. Return only PUBLIC information to client
    return NextResponse.json({ 
      roundId,
      startTime,
      maxAttempts: 8,
      duration: gameDuration
    });

  } catch (error) {
    console.error('❌ PIN Game start round error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function generateSecretCode(): string {
    var arr: number[] = [];
    while(arr.length < 4){
        var r = Math.floor(Math.random() * 9);
        if(arr[0] === undefined && r === 0) continue;
        else if((arr.indexOf(r) === -1)) arr.push(r);
    }
    return arr.join("");
}

