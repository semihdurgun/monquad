// Alternative: Vercel KV (Redis-compatible, serverless-optimized)
// Bu dosyayı redis.ts yerine kullanabilirsin

import { kv } from '@vercel/kv';

// Simple wrapper for Vercel KV
export async function kvSet(key: string, value: string, ttl?: number): Promise<void> {
  try {
    if (ttl) {
      await kv.setex(key, ttl, value);
    } else {
      await kv.set(key, value);
    }
  } catch (error) {
    console.error('KV set error:', error);
    throw error;
  }
}

export async function kvGet(key: string): Promise<string | null> {
  try {
    return await kv.get(key);
  } catch (error) {
    console.error('KV get error:', error);
    return null;
  }
}

export async function kvDel(key: string): Promise<number> {
  try {
    return await kv.del(key);
  } catch (error) {
    console.error('KV del error:', error);
    return 0;
  }
}

export async function kvKeys(pattern: string): Promise<string[]> {
  try {
    return await kv.keys(pattern);
  } catch (error) {
    console.error('KV keys error:', error);
    return [];
  }
}

// Test KV connection
export async function testKVConnection(): Promise<boolean> {
  try {
    await kv.set('test', 'ping');
    const result = await kv.get('test');
    await kv.del('test');
    return result === 'ping';
  } catch (error) {
    console.error('KV connection test failed:', error);
    return false;
  }
}
