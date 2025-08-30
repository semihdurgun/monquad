import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

// Redis client singleton with connection state
let redis: RedisClientType | null = null;
let isConnecting = false;
let lastConnectionTime = 0;
const CONNECTION_TIMEOUT = 30000; // 30 seconds

export async function getRedisClient(): Promise<RedisClientType> {
  // Check if we have a valid connection
  if (redis && redis.isReady) {
    return redis;
  }

  // Check if we're already connecting
  if (isConnecting) {
    // Wait for existing connection attempt
    while (isConnecting && Date.now() - lastConnectionTime < CONNECTION_TIMEOUT) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (redis && redis.isReady) {
      return redis;
    }
  }

  // Create new connection
  isConnecting = true;
  lastConnectionTime = Date.now();

  try {
    // Cleanup old connection if exists
    if (redis) {
      try {
        await redis.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      redis = null;
    }

    // Create new Redis client with proper TLS support for Upstash
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const isUpstash = redisUrl.includes('upstash.io');
    
    // Convert redis:// to rediss:// for Upstash (TLS)
    const finalUrl = isUpstash ? redisUrl.replace('redis://', 'rediss://') : redisUrl;
    
    redis = createClient({
      url: finalUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: false,
      },
    });

    // Minimal error handling
    redis.on('error', (err) => {
      console.error('Redis Client Error:', err.message);
      // Reset connection on error
      redis = null;
      isConnecting = false;
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('end', () => {
      console.log('🔌 Redis connection ended');
      redis = null;
      isConnecting = false;
    });

    // Connect with timeout
    await Promise.race([
      redis.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      )
    ]);

    isConnecting = false;
    return redis;

  } catch (error) {
    console.error('Redis connection failed:', error);
    isConnecting = false;
    redis = null;
    throw error;
  }
}

// Graceful shutdown
export async function closeRedisClient() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// Test connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    console.error('Redis connection test failed:', error);
    return false;
  }
}
