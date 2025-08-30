// Upstash REST API ile Redis replacement
// Bu dosyayı redis.ts import'larının yerine kullanabilirsin

// Environment variables
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function executeRedisCommand(command: string[]): Promise<any> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    // Fallback to local Redis if Upstash not configured
    throw new Error('Upstash REST API not configured');
  }

  try {
    const response = await fetch(UPSTASH_REDIS_REST_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`Upstash REST API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Upstash REST command failed:', error);
    throw error;
  }
}

// Redis-compatible interface
export const redisRest = {
  async setEx(key: string, seconds: number, value: string): Promise<void> {
    await executeRedisCommand(['SETEX', key, seconds.toString(), value]);
  },

  async get(key: string): Promise<string | null> {
    return await executeRedisCommand(['GET', key]);
  },

  async del(key: string | string[]): Promise<number> {
    if (Array.isArray(key)) {
      return await executeRedisCommand(['DEL', ...key]);
    }
    return await executeRedisCommand(['DEL', key]);
  },

  async keys(pattern: string): Promise<string[]> {
    return await executeRedisCommand(['KEYS', pattern]);
  },

  async exists(key: string): Promise<number> {
    return await executeRedisCommand(['EXISTS', key]);
  },

  // Connection state için
  isReady: true,
};

// Test function
export async function testRedisRestConnection(): Promise<boolean> {
  try {
    await redisRest.setEx('test:ping', 10, 'pong');
    const result = await redisRest.get('test:ping');
    await redisRest.del('test:ping');
    return result === 'pong';
  } catch (error) {
    console.error('Redis REST connection test failed:', error);
    return false;
  }
}

// Get client function (for compatibility)
export async function getRedisRestClient() {
  return redisRest;
}
