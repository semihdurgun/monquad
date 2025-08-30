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

export async function POST(request: NextRequest) {
  try {
    // 1. JWT Authentication
    const authenticatedUser = await requireAuth(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { roundId, reason } = body;

    if (!roundId) {
      return NextResponse.json({ error: 'Missing roundId parameter' }, { status: 400 });
    }

    // Validate reason if provided
    const validReasons = ['completed', 'abandoned', 'timeout', 'manual'];
    if (reason && !validReasons.includes(reason)) {
      return NextResponse.json({ error: 'Invalid end reason' }, { status: 400 });
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

    // 5. Check if already completed
    const now = Date.now();
    if (roundData.gameState.isCompleted) {
      console.log(`ℹ️ PIN Game Round ${roundId} already completed for wallet ${authenticatedUser.walletAddress}`);
    } else {
      // Mark as completed with appropriate reason
      roundData.gameState.isCompleted = true;
      
      // Determine final state based on reason
      const endReason = reason || (roundData.gameState.isWon ? 'completed' : 'abandoned');
      
      switch (endReason) {
        case 'timeout':
          roundData.gameState.isWon = false;
          roundData.gameState.score = 0;
          break;
        case 'abandoned':
          roundData.gameState.isWon = false;
          // Keep any partial score if user made progress
          break;
        case 'manual':
          // Keep current state
          break;
        case 'completed':
        default:
          // State should already be set correctly
          break;
      }
      
      console.log(`🏁 PIN Game Round ${roundId} ended for wallet ${authenticatedUser.walletAddress} (reason: ${endReason}, won: ${roundData.gameState.isWon}, score: ${roundData.gameState.score})`);
    }

    // 6. Calculate final statistics
    const finalStats = {
      roundId,
      secretCode: roundData.secretCode, // Reveal secret code at end
      isWon: roundData.gameState.isWon,
      score: roundData.gameState.score,
      attemptsUsed: roundData.gameState.attempts.length,
      maxAttempts: roundData.gameState.maxAttempts,
      timeUsed: now - roundData.startTime,
      gameDuration: 5 * 60 * 1000, // 5 minutes
      attempts: roundData.gameState.attempts.map(attempt => ({
        guess: attempt.guess,
        result: attempt.result,
        attemptNumber: attempt.attemptNumber,
        timestamp: attempt.timestamp
      })),
      endTime: now,
      startTime: roundData.startTime,
      reason: reason || 'completed'
    };

    // 7. Update round data in Redis with shorter TTL (1 hour for historical access)
    await redis.setEx(`pin-round:${roundId}`, 3600, JSON.stringify(roundData));

    // 8. Optionally store game statistics in a separate key for leaderboards
    const statsKey = `pin-stats:${authenticatedUser.walletAddress}:${roundId}`;
    const statsData = {
      walletAddress: authenticatedUser.walletAddress,
      roundId,
      isWon: roundData.gameState.isWon,
      score: roundData.gameState.score,
      attemptsUsed: roundData.gameState.attempts.length,
      timeUsed: finalStats.timeUsed,
      timestamp: now,
      secretCode: roundData.secretCode
    };
    
    // Store stats for 7 days
    await redis.setEx(statsKey, 7 * 24 * 3600, JSON.stringify(statsData));

    // 9. Return final game results
    return NextResponse.json({
      success: true,
      ...finalStats
    });

  } catch (error) {
    console.error('❌ PIN Game end round error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint for retrieving ended game statistics
export async function GET(request: NextRequest) {
  try {
    const authenticatedUser = await requireAuth(request);
    if (!authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const roundId = url.searchParams.get('roundId');

    if (!roundId) {
      return NextResponse.json({ error: 'Missing roundId parameter' }, { status: 400 });
    }

    // Try to get from stats first, then fall back to main round data
    const redis = await getRedisClient();
    const statsKey = `pin-stats:${authenticatedUser.walletAddress}:${roundId}`;
    const statsDataStr = await redis.get(statsKey);
    
    if (statsDataStr) {
      const statsData = JSON.parse(statsDataStr);
      return NextResponse.json(statsData);
    }

    // Fall back to main round data
    const roundDataStr = await redis.get(`pin-round:${roundId}`);
    if (!roundDataStr) {
      return NextResponse.json({ error: 'Round statistics not found' }, { status: 404 });
    }

    const roundData: PinGameRoundData = JSON.parse(roundDataStr);
    
    // Ensure numeric fields are properly typed
    roundData.startTime = Number(roundData.startTime);
    
    if (roundData.walletAddress !== authenticatedUser.walletAddress) {
      return NextResponse.json({ error: 'Round does not belong to user' }, { status: 403 });
    }

    return NextResponse.json({
      walletAddress: roundData.walletAddress,
      roundId,
      isWon: roundData.gameState.isWon,
      score: roundData.gameState.score,
      attemptsUsed: roundData.gameState.attempts.length,
      secretCode: roundData.secretCode,
      isCompleted: roundData.gameState.isCompleted
    });

  } catch (error) {
    console.error('❌ PIN Game get end stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
