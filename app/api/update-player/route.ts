// Explicitly set runtime to nodejs for crypto and full node features
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, http } from 'viem';
import { monadTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { CONTRACT_ADDRESS, CONTRACT_ABI, isValidAddress } from '@/lib/contract';
import { validateApiKey, validateOrigin, createAuthenticatedResponse } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limiter';
import { generateRequestId, isDuplicateRequest, markRequestProcessing, markRequestComplete } from '@/lib/request-deduplication';
import { requireAuth } from '@/lib/auth/middleware-helpers';

export async function POST(request: NextRequest) {
  try {
    // Authentication check (via middleware)
    let authenticatedUser;
    try {
      authenticatedUser = await requireAuth(request);
    } catch (error) {
      return createAuthenticatedResponse({ error: 'Authentication required' }, 401);
    }

    // Security checks (kept for backward compatibility)
    if (!validateApiKey(request)) {
      return createAuthenticatedResponse({ error: 'Unauthorized: Invalid API key' }, 401);
    }

    if (!validateOrigin(request)) {
      return createAuthenticatedResponse({ error: 'Forbidden: Invalid origin' }, 403);
    }

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = rateLimit(clientIp, { maxRequests: 10, windowMs: 60000 }); // 10 requests per minute
    
    if (!rateLimitResult.allowed) {
      return createAuthenticatedResponse({
        error: 'Too many requests',
        resetTime: rateLimitResult.resetTime
      }, 429);
    }

    // Parse request body
    const { scoreAmount, transactionAmount } = await request.json();
    
    // Use authenticated user's wallet address
    const playerAddress = authenticatedUser.walletAddress;

    // Validate input
    if (scoreAmount === undefined || transactionAmount === undefined) {
      return createAuthenticatedResponse(
        { error: 'Missing required fields: scoreAmount, transactionAmount' },
        400
      );
    }

    // Player address comes from authenticated user, so it's already validated
    console.log(`🎮 Updating score for authenticated user: ${authenticatedUser.username} (${playerAddress})`);

    // Validate that scoreAmount and transactionAmount are positive numbers
    if (scoreAmount < 0 || transactionAmount < 0) {
      return createAuthenticatedResponse(
        { error: 'Score and transaction amounts must be non-negative' },
        400
      );
    }

    // Maximum limits to prevent abuse
    const MAX_SCORE_PER_REQUEST = 10000;
    const MAX_TRANSACTIONS_PER_REQUEST = 100;

    if (scoreAmount > MAX_SCORE_PER_REQUEST || transactionAmount > MAX_TRANSACTIONS_PER_REQUEST) {
      return createAuthenticatedResponse(
        { error: `Amounts too large. Max score: ${MAX_SCORE_PER_REQUEST}, Max transactions: ${MAX_TRANSACTIONS_PER_REQUEST}` },
        400
      );
    }

    // Request deduplication
    const requestId = generateRequestId(playerAddress, scoreAmount, transactionAmount);
    if (isDuplicateRequest(requestId)) {
      return createAuthenticatedResponse(
        { error: 'Duplicate request detected. Please wait before retrying.' },
        409
      );
    }

    markRequestProcessing(requestId);

    // Get private key from environment variable
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      console.error('WALLET_PRIVATE_KEY environment variable not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Validate and format private key
    let formattedPrivateKey: `0x${string}`;
    try {
      // Remove any whitespace
      const cleanKey = privateKey.trim();
      
      // Check if it already has 0x prefix
      if (cleanKey.startsWith('0x')) {
        // Already has prefix, validate length (should be 66 characters: 0x + 64 hex chars)
        if (cleanKey.length !== 66) {
          throw new Error(`Invalid private key length with 0x prefix: ${cleanKey.length}, expected 66`);
        }
        formattedPrivateKey = cleanKey as `0x${string}`;
      } else {
        // No prefix, should be 64 hex characters, add 0x
        if (cleanKey.length !== 64) {
          throw new Error(`Invalid private key length without prefix: ${cleanKey.length}, expected 64`);
        }
        formattedPrivateKey = `0x${cleanKey}` as `0x${string}`;
      }
      
      // Validate hex format (should be 0x followed by 64 hex chars)
      if (!/^0x[0-9a-fA-F]{64}$/.test(formattedPrivateKey)) {
        throw new Error('Invalid private key format: must be 64 hex characters (with or without 0x prefix)');
      }
      
      console.log(`✅ Private key validated successfully. Length: ${formattedPrivateKey.length}`);
    } catch (error) {
      console.error('Private key validation error:', error);
      return NextResponse.json(
        { error: 'Invalid wallet configuration' },
        { status: 500 }
      );
    }

    // Create account from private key
    const account = privateKeyToAccount(formattedPrivateKey);

    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http()
    });

    // Call the updatePlayerData function
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'updatePlayerData',
      args: [
        playerAddress as `0x${string}`,
        BigInt(scoreAmount),
        BigInt(transactionAmount)
      ]
    });

    markRequestComplete(requestId);

    return createAuthenticatedResponse({
      success: true,
      transactionHash: hash,
      message: 'Player data updated successfully'
    });

  } catch (error) {
    console.error('Error updating player data:', error);
    
    // Handle specific viem errors
    if (error instanceof Error) {
      if (error.message.includes('insufficient funds')) {
        return createAuthenticatedResponse(
          { error: 'Insufficient funds to complete transaction' },
          400
        );
      }
      if (error.message.includes('execution reverted')) {
        return createAuthenticatedResponse(
          { error: 'Contract execution failed - check if wallet has GAME_ROLE permission' },
          400
        );
      }
      if (error.message.includes('AccessControlUnauthorizedAccount')) {
        return createAuthenticatedResponse(
          { error: 'Unauthorized: Wallet does not have GAME_ROLE permission' },
          403
        );
      }
    }

    return createAuthenticatedResponse(
      { error: 'Failed to update player data' },
      500
    );
  }
}