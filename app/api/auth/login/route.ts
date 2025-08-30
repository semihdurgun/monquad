import { NextRequest, NextResponse } from 'next/server';
// import { cookies } from 'next/headers'; // Not needed here, using response.cookies

// Explicitly set runtime to nodejs for crypto support
export const runtime = 'nodejs';

import crypto from 'node:crypto';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  storeRefreshToken,
  TOKEN_CONFIG 
} from '@/lib/auth/tokens';
import { 
  registerOrLoginUser, 
  initializeTestUsers,
  type LoginCredentials 
} from '@/lib/auth/user';
import { testRedisConnection } from '@/lib/redis';

// Initialize test users in development
if (process.env.NODE_ENV === 'development') {
  initializeTestUsers();
}

export async function POST(request: NextRequest) {
  try {
    // Test Redis connection
    const redisConnected = await testRedisConnection();
    if (!redisConnected) {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { username, walletAddress }: LoginCredentials = body;

    // Basic validation
    if (!username || !walletAddress) {
      return NextResponse.json(
        { error: 'Username and wallet address are required' },
        { status: 400 }
      );
    }

    // Authenticate or register user
    let user;
    try {
      user = registerOrLoginUser({ username, walletAddress });
    } catch (error) {
      console.error('Authentication error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Authentication failed' },
        { status: 401 }
      );
    }

    // Generate tokens
    const tokenId = crypto.randomUUID();
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
    });
    const refreshToken = generateRefreshToken();

    // Store refresh token in Redis
    await storeRefreshToken(user.id, refreshToken, tokenId);

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        walletAddress: user.walletAddress,
      },
      message: 'Authentication successful',
    });

    // Set secure cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };

    // Access token cookie (15 minutes)
    response.cookies.set('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60, // 15 minutes
    });

    // Refresh token cookie (7 days)
    response.cookies.set('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY, // 7 days
    });

    // User ID cookie for quick lookup
    response.cookies.set('user_id', user.id, {
      ...cookieOptions,
      maxAge: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY, // 7 days
    });

    console.log(`✅ User logged in successfully: ${user.username} (${user.id})`);

    return response;

  } catch (error) {
    console.error('Login endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    const redisConnected = await testRedisConnection();
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisConnected ? 'connected' : 'disconnected',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Service health check failed' 
      },
      { status: 503 }
    );
  }
}
