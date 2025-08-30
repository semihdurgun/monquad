// Explicitly set runtime to nodejs
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { testRedisConnection } from '@/lib/redis';

export async function GET() {
  try {
    const redisConnected = await testRedisConnection();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      redis_url_exists: !!process.env.REDIS_URL,
      redis_url_format: process.env.REDIS_URL?.substring(0, 20) + '...',
      services: {
        redis: redisConnected ? 'connected' : 'disconnected',
      },
      uptime: process.uptime(),
    };

    return NextResponse.json(health, {
      status: redisConnected ? 200 : 503,
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json(
      { 
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        services: {
          redis: 'error',
        }
      },
      { status: 503 }
    );
  }
}
