import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Explicitly set runtime to nodejs for crypto support
export const runtime = 'nodejs';

import crypto from 'node:crypto';
import {
  generateAccessToken,
  generateRefreshToken,
  validateRefreshToken,
  storeRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  TOKEN_CONFIG
} from '@/lib/auth/tokens';
import { findUserById } from '@/lib/auth/user';

// GET method - Check authentication status
export async function GET(request: NextRequest) {
  try {
    // Get tokens from cookies
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    const userId = cookieStore.get('user_id')?.value;

    if (!refreshToken || !userId) {
      return NextResponse.json(
        { valid: false, error: 'No tokens found' },
        { status: 200 }
      );
    }

    // Validate refresh token
    const tokenData = await validateRefreshToken(refreshToken, userId);
    if (!tokenData) {
      return NextResponse.json(
        { valid: false, error: 'Invalid refresh token' },
        { status: 200 }
      );
    }

    // Get user info
    const user = await findUserById(userId);
    if (!user) {
      return NextResponse.json(
        { valid: false, error: 'User not found' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        walletAddress: user.walletAddress,
      },
      tokenData
    });

  } catch (error) {
    console.error('❌ Auth status check error:', error);
    return NextResponse.json(
      { valid: false, error: 'Authentication check failed' },
      { status: 200 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get tokens from cookies
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    const userId = cookieStore.get('user_id')?.value;

    if (!refreshToken || !userId) {
      return NextResponse.json(
        { error: 'No refresh token provided' },
        { status: 401 }
      );
    }

    // Validate refresh token in Redis
    const tokenData = await validateRefreshToken(userId, refreshToken);
    
    if (!tokenData) {
      // SECURITY BREACH DETECTED!
      // Token doesn't exist in Redis - either expired or already used (reuse attack)
      console.log(`🚨 SECURITY BREACH: Invalid refresh token for user ${userId}`);
      
      // Revoke ALL tokens for this user
      const revokedCount = await revokeAllUserTokens(userId);
      console.log(`🚨 Revoked ${revokedCount} tokens for user ${userId} due to security breach`);

      // Clear all cookies
      const response = NextResponse.json(
        { error: 'Security breach detected. All sessions terminated.' },
        { status: 401 }
      );

      response.cookies.delete('access_token');
      response.cookies.delete('refresh_token');
      response.cookies.delete('user_id');

      return response;
    }

    // Get user data
    const user = findUserById(userId);
    if (!user) {
      console.log(`❌ User not found: ${userId}`);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // REFRESH TOKEN ROTATION
    // 1. Revoke the old refresh token
    await revokeRefreshToken(userId, refreshToken);

    // 2. Generate new tokens
    const newTokenId = crypto.randomUUID();
    const newAccessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      walletAddress: user.walletAddress,
    });
    const newRefreshToken = generateRefreshToken();

    // 3. Store new refresh token
    await storeRefreshToken(userId, newRefreshToken, newTokenId);

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Tokens refreshed successfully',
      user: {
        id: user.id,
        username: user.username,
        walletAddress: user.walletAddress,
      },
    });

    // Set new secure cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    };

    // New access token cookie
    response.cookies.set('access_token', newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60, // 15 minutes
    });

    // New refresh token cookie
    response.cookies.set('refresh_token', newRefreshToken, {
      ...cookieOptions,
      maxAge: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY, // 7 days
    });

    // Update user_id cookie (extends expiry)
    response.cookies.set('user_id', user.id, {
      ...cookieOptions,
      maxAge: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY, // 7 days
    });

    console.log(`✅ Tokens refreshed successfully for user: ${user.username} (${user.id})`);

    return response;

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}
