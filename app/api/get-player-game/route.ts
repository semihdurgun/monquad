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

    // Get parameters from query params
    const { searchParams } = new URL(request.url);
    const playerAddress = searchParams.get('playerAddress');
    const gameAddress = GAME_ADDRESS;

    if (!playerAddress) {
      return createAuthenticatedResponse(
        { error: 'Missing required parameter: playerAddress' },
        400
      );
    }

    // Validate address formats
    if (!/^0x[a-fA-F0-9]{40}$/.test(playerAddress)) {
      return createAuthenticatedResponse(
        { error: 'Invalid player address format' },
        400
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(gameAddress)) {
      return createAuthenticatedResponse(
        { error: 'Invalid game address format' },
        400
      );
    }

    // Create public client
    const client = createPublicClient({
      chain: monadTestnet,
      transport: http()
    });

    // Get player game data from contract
    const playerGameData = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'playerDataPerGame',
      args: [gameAddress as `0x${string}`, playerAddress as `0x${string}`]
    });

    // playerGameData is a tuple: [score, transactions]
    const [score, transactions] = playerGameData;

    logSecurityEvent('PLAYER_GAME_DATA_RETRIEVED', request, { playerAddress, gameAddress });

    return createAuthenticatedResponse({
      success: true,
      data: {
        playerAddress,
        gameAddress,
        score: Number(score),
        transactions: Number(transactions),
        lastUpdated: Math.floor(Date.now() / 1000) // Current timestamp
      }
    });

  } catch (error) {
    console.error('Error getting player game data:', error);
    logSecurityEvent('PLAYER_GAME_DATA_ERROR', request, { error: error instanceof Error ? error.message : 'Unknown error' });
    
    return createAuthenticatedResponse(
      { error: 'Failed to get player game data' },
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

    const { playerAddress, gameAddress } = await request.json();

    if (!playerAddress || !gameAddress) {
      return createAuthenticatedResponse(
        { error: 'Both playerAddress and gameAddress are required' },
        400
      );
    }

    if (!isValidAddress(playerAddress) || !isValidAddress(gameAddress)) {
      return createAuthenticatedResponse(
        { error: 'Invalid player or game address format' },
        400
      );
    }

    // Create public client
    const client = createPublicClient({
      chain: monadTestnet,
      transport: http()
    });

    // Get player game data from contract
    const playerGameData = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'playerDataPerGame',
      args: [gameAddress as `0x${string}`, playerAddress as `0x${string}`]
    });

    // playerGameData is a tuple: [score, transactions]
    const [score, transactions] = playerGameData;

    logSecurityEvent('PLAYER_GAME_DATA_RETRIEVED', request, { playerAddress, gameAddress });

    return createAuthenticatedResponse({
      success: true,
      playerAddress,
      gameAddress,
      score: score.toString(),
      transactions: transactions.toString()
    });

  } catch (error) {
    console.error('Error getting player data per game:', error);
    logSecurityEvent('PLAYER_GAME_DATA_ERROR', request, { error: error instanceof Error ? error.message : 'Unknown error' });
    
    return createAuthenticatedResponse(
      { error: 'Failed to get player data per game' },
      500
    );
  }
}