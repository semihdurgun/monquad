import { NextRequest } from 'next/server';
import { verifyAccessToken } from './tokens';

// Extract user info from request headers (set by middleware)
export interface AuthenticatedUser {
  userId: string;
  walletAddress: string;
  username: string;
}

export function getAuthenticatedUser(request: NextRequest): AuthenticatedUser | null {
  const username = request.headers.get('x-username');
  const walletAddress = request.headers.get('x-wallet-address');
  const userId = request.headers.get('x-user-id');

  if (!username || !walletAddress || !userId) {
    return null;
  }

  return {
    userId,
    walletAddress,
    username,
  };
}

// Check if user is authenticated
export function isAuthenticated(request: NextRequest): boolean {
  return getAuthenticatedUser(request) !== null;
}

// Get wallet address from request (this is our unique identifier)
export function getWalletId(request: NextRequest): string | null {
  return request.headers.get('x-wallet-address');
}

// Get username from request
export function getUsername(request: NextRequest): string | null {
  return request.headers.get('x-username');
}

// Get wallet address from request
export function getWalletAddress(request: NextRequest): string | null {
  return request.headers.get('x-wallet-address');
}

// Require authentication (throws error if not authenticated)
export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser> {
  // Try getting user from headers first (set by middleware)
  const user = getAuthenticatedUser(request);
  
  if (user) {
    return user;
  }
  
  // Fallback: Try verifying JWT token directly (if middleware didn't run)
  const accessToken = request.cookies.get('access_token')?.value;
  
  if (accessToken) {
    try {
      const tokenPayload = await verifyAccessToken(accessToken);
      
      if (tokenPayload) {
        return {
          userId: tokenPayload.userId,
          username: tokenPayload.username,
          walletAddress: tokenPayload.walletAddress,
        };
      }
    } catch (error) {
      console.error('❌ Token verification failed:', error);
    }
  }
  
  throw new Error('Authentication required');
}
