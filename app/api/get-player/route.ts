import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { monadTestnet } from 'viem/chains';
import { validateOrigin, createAuthenticatedResponse, logSecurityEvent } from '@/lib/auth';
import { combinedRateLimit } from '@/lib/rate-limiter';
import { isValidAddress, CONTRACT_ABI, CONTRACT_ADDRESS, GAME_ADDRESS } from '@/lib/contract';

export async function GET(request: NextRequest) {
  try {

    if (!validateOrigin(request)) {
      logSecurityEvent('FORBIDDEN_ORIGIN', request);
      return createAuthenticatedResponse({ error: 'Forbidden: Invalid origin' }, 403);
    }

    // Rate limiting
    const rateLimitResult = combinedRateLimit(request);
    if (!rateLimitResult.allowed) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', request);
      return createAuthenticatedResponse({
        error: 'Too many requests',
        resetTime: rateLimitResult.resetTime,
        retryAfter: rateLimitResult.retryAfter
      }, 429);
    }

    // Get player address from query params
    const { searchParams } = new URL(request.url);
    const playerAddress = searchParams.get('playerAddress');

    if (!playerAddress) {
      return createAuthenticatedResponse(
        { error: 'Missing required parameter: playerAddress' },
        400
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(playerAddress)) {
      return createAuthenticatedResponse(
        { error: 'Invalid player address format' },
        400
      );
    }

    // Create public client
    const client = createPublicClient({
      chain: monadTestnet,
      transport: http()
    });

    // Get player data from contract - both total score and total transactions
    const [totalScore, totalTransactions] = await Promise.all([
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalScoreOfPlayer',
        args: [playerAddress as `0x${string}`]
      }),
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalTransactionsOfPlayer',
        args: [playerAddress as `0x${string}`]
      })
    ]);

    logSecurityEvent('PLAYER_DATA_RETRIEVED', request, { playerAddress });

    return createAuthenticatedResponse({
      success: true,
      data: {
        playerAddress,
        score: Number(totalScore),
        transactions: Number(totalTransactions),
        lastUpdated: Math.floor(Date.now() / 1000) // Current timestamp
      }
    });

  } catch (error) {
    console.error('Error getting player data:', error);
    logSecurityEvent('PLAYER_DATA_ERROR', request, { error: error instanceof Error ? error.message : 'Unknown error' });
    
    return createAuthenticatedResponse(
      { error: 'Failed to get player data' },
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Security checks - only validate origin for internal API calls
    if (!validateOrigin(request)) {
      logSecurityEvent('FORBIDDEN_ORIGIN', request);
      return createAuthenticatedResponse({ error: 'Forbidden: Invalid origin' }, 403);
    }

    const { playerAddress } = await request.json();

    if (!playerAddress) {
      return createAuthenticatedResponse(
        { error: 'Player address is required' },
        400
      );
    }

    if (!isValidAddress(playerAddress)) {
      return createAuthenticatedResponse(
        { error: 'Invalid player address format' },
        400
      );
    }

    // Create public client
    const client = createPublicClient({
      chain: monadTestnet,
      transport: http()
    });

    // Get player data from contract - both total score and total transactions
    const [totalScore, totalTransactions] = await Promise.all([
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalScoreOfPlayer',
        args: [playerAddress as `0x${string}`]
      }),
      client.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'totalTransactionsOfPlayer',
        args: [playerAddress as `0x${string}`]
      })
    ]);

    logSecurityEvent('PLAYER_DATA_RETRIEVED', request, { playerAddress });

    return createAuthenticatedResponse({
      success: true,
      playerAddress,
      totalScore: totalScore.toString(),
      totalTransactions: totalTransactions.toString()
    });

  } catch (error) {
    console.error('Error getting player data:', error);
    logSecurityEvent('PLAYER_DATA_ERROR', request, { error: error instanceof Error ? error.message : 'Unknown error' });
    
    return createAuthenticatedResponse(
      { error: 'Failed to get player data' },
      500
    );
  }
}