import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeRefreshToken, revokeAllUserTokens } from '@/lib/auth/tokens';

// Single device logout
export async function POST(request: NextRequest) {
  try {
    // Get tokens from cookies
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    const userId = cookieStore.get('user_id')?.value;

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    });

    // Clear all auth cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 0, // Expire immediately
    };

    response.cookies.set('access_token', '', cookieOptions);
    response.cookies.set('refresh_token', '', cookieOptions);
    response.cookies.set('user_id', '', cookieOptions);

    // Revoke refresh token if present
    if (refreshToken && userId) {
      await revokeRefreshToken(userId, refreshToken);
      console.log(`✅ User logged out: ${userId}`);
    }

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}

// Logout from all devices
export async function DELETE(request: NextRequest) {
  try {
    // Get user ID from cookies
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;

    if (!userId) {
      return NextResponse.json(
        { error: 'No active session found' },
        { status: 401 }
      );
    }

    // Revoke ALL refresh tokens for this user
    const revokedCount = await revokeAllUserTokens(userId);

    // Create response
    const response = NextResponse.json({
      success: true,
      message: `Logged out from all devices (${revokedCount} sessions terminated)`
    });

    // Clear all auth cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 0, // Expire immediately
    };

    response.cookies.set('access_token', '', cookieOptions);
    response.cookies.set('refresh_token', '', cookieOptions);
    response.cookies.set('user_id', '', cookieOptions);

    console.log(`✅ User logged out from all devices: ${userId} (${revokedCount} sessions)`);

    return response;

  } catch (error) {
    console.error('Logout all devices error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
