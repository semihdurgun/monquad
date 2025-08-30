import jwt from 'jsonwebtoken';
import { getRedisClient } from '@/lib/redis';

// Edge-compatible crypto
let crypto: any;
if (typeof window === 'undefined') {
  // Server-side: use Node.js crypto
  crypto = require('crypto');
} else {
  // Client-side: use Web Crypto API
  crypto = {
    randomBytes: (size: number) => {
      const array = new Uint8Array(size);
      globalThis.crypto.getRandomValues(array);
      return {
        toString: (encoding: string) => {
          if (encoding === 'hex') {
            return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
          }
          return array;
        }
      };
    },
    randomUUID: () => globalThis.crypto.randomUUID()
  };
}

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';

// Token configuration
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m' as const, // 15 minutes
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60, // 7 days in seconds
  REFRESH_TOKEN_LENGTH: 64, // bytes
};

// Types
export interface AccessTokenPayload {
  userId: string;
  username: string;
  walletAddress: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenData {
  userId: string;
  tokenId: string;
  createdAt: number;
}

// Generate cryptographically secure refresh token
export function generateRefreshToken(): string {
  return crypto.randomBytes(TOKEN_CONFIG.REFRESH_TOKEN_LENGTH).toString('hex');
}

// Generate access token (JWT)
export function generateAccessToken(payload: {
  userId: string;
  username: string;
  walletAddress: string;
}): string {
  const options: jwt.SignOptions = {
    expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
    issuer: 'monadcast-game',
    audience: 'monadcast-users',
  };
  
  return jwt.sign(payload, JWT_SECRET, options);
}

// Verify access token
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'monadcast-game',
      audience: 'monadcast-users',
    }) as AccessTokenPayload;
  } catch (error) {
    console.error('Access token verification failed:', error);
    return null;
  }
}

// Store refresh token in Redis
export async function storeRefreshToken(
  userId: string,
  refreshToken: string,
  tokenId: string
): Promise<void> {
  try {
    const redis = await getRedisClient();
    const key = `refresh_token:${userId}:${refreshToken}`;
    
    const tokenData: RefreshTokenData = {
      userId,
      tokenId,
      createdAt: Date.now(),
    };

    await redis.setEx(
      key,
      TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY,
      JSON.stringify(tokenData)
    );

    console.log(`✅ Refresh token stored for user ${userId}`);
  } catch (error) {
    console.error('Failed to store refresh token:', error);
    throw new Error('Token storage failed');
  }
}

// Validate refresh token
export async function validateRefreshToken(
  userId: string,
  refreshToken: string
): Promise<RefreshTokenData | null> {
  try {
    const redis = await getRedisClient();
    const key = `refresh_token:${userId}:${refreshToken}`;

    const data = await redis.get(key);
    if (!data) {
      console.log(`❌ Refresh token not found for user ${userId}`);
      return null;
    }

    const tokenData: RefreshTokenData = JSON.parse(data);
    console.log(`✅ Refresh token validated for user ${userId}`);
    return tokenData;
  } catch (error) {
    console.error('Refresh token validation error:', error);
    return null;
  }
}

// Revoke specific refresh token (for rotation)
export async function revokeRefreshToken(
  userId: string,
  refreshToken: string
): Promise<void> {
  try {
    const redis = await getRedisClient();
    const key = `refresh_token:${userId}:${refreshToken}`;

    const deleted = await redis.del(key);
    console.log(`🗑️ Refresh token revoked for user ${userId}, deleted: ${deleted}`);
  } catch (error) {
    console.error('Failed to revoke refresh token:', error);
    // Don't throw error for revoke operations
  }
}

// Security breach: Revoke ALL tokens for user
export async function revokeAllUserTokens(userId: string): Promise<number> {
  try {
    const redis = await getRedisClient();
    const pattern = `refresh_token:${userId}:*`;

    const keys = await redis.keys(pattern);
    
    if (keys.length === 0) {
      console.log(`ℹ️ No tokens found to revoke for user ${userId}`);
      return 0;
    }

    const deleted = await redis.del(keys);
    console.log(`🚨 SECURITY BREACH: Revoked ${deleted} tokens for user ${userId}`);
    return deleted;
  } catch (error) {
    console.error('Error revoking all user tokens:', error);
    return 0;
  }
}

// Get user's active token count
export async function getUserActiveTokenCount(userId: string): Promise<number> {
  const redis = await getRedisClient();
  const pattern = `refresh_token:${userId}:*`;

  try {
    const keys = await redis.keys(pattern);
    return keys.length;
  } catch (error) {
    console.error('Error getting user token count:', error);
    return 0;
  }
}

// Clean expired tokens (maintenance function)
export async function cleanExpiredTokens(): Promise<number> {
  // Redis otomatik olarak TTL'li key'leri siler, bu fonksiyon monitoring için
  const redis = await getRedisClient();
  const pattern = 'refresh_token:*';
  
  try {
    const keys = await redis.keys(pattern);
    console.log(`ℹ️ Total active refresh tokens: ${keys.length}`);
    return keys.length;
  } catch (error) {
    console.error('Error cleaning expired tokens:', error);
    return 0;
  }
}
