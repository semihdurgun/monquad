// Alternative: Upstash REST API (HTTP-based, TLS sorunları yok)
// Bu dosyayı redis.ts yerine kullanabilirsin

// Upstash REST API kullanarak Redis operations
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function upstashRequest(command: string[]): Promise<any> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    throw new Error('Upstash REST credentials not configured');
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
      throw new Error(`Upstash REST API error: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Upstash REST request failed:', error);
    throw error;
  }
}

// Redis operations using REST API
export async function upstashSet(key: string, value: string, ttl?: number): Promise<void> {
  if (ttl) {
    await upstashRequest(['SETEX', key, ttl.toString(), value]);
  } else {
    await upstashRequest(['SET', key, value]);
  }
}

export async function upstashGet(key: string): Promise<string | null> {
  return await upstashRequest(['GET', key]);
}

export async function upstashDel(key: string): Promise<number> {
  return await upstashRequest(['DEL', key]);
}

export async function upstashKeys(pattern: string): Promise<string[]> {
  return await upstashRequest(['KEYS', pattern]);
}

// Test Upstash REST connection
export async function testUpstashRestConnection(): Promise<boolean> {
  try {
    await upstashSet('test:ping', 'pong', 10);
    const result = await upstashGet('test:ping');
    await upstashDel('test:ping');
    return result === 'pong';
  } catch (error) {
    console.error('Upstash REST connection test failed:', error);
    return false;
  }
}
