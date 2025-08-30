import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Environment variables
const API_KEY = process.env.API_KEY;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [];
const SECRET_KEY = process.env.SECRET_KEY || 'default-secret-key';

// API Key validation with timing attack protection
export function validateApiKey(request: NextRequest): boolean {
  if (!API_KEY) {
    console.error('API_KEY not configured');
    return false;
  }

  const providedKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!providedKey) {
    return false;
  }

  // Use crypto.timingSafeEqual for timing attack protection
  try {
    const providedBuffer = Buffer.from(providedKey, 'utf8');
    const expectedBuffer = Buffer.from(API_KEY, 'utf8');
    
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch (error) {
    console.error('API key validation error:', error);
    return false;
  }
}

// Origin validation with strict checking
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // If no origin/referer, only allow from same domain
  if (!origin && !referer) {
    return true; // Same-origin requests
  }

  // Check against allowed origins
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  // Additional security: check referer
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = refererUrl.origin;
      
      if (ALLOWED_ORIGINS.includes(refererOrigin)) {
        return true;
      }
    } catch (error) {
      console.error('Invalid referer URL:', error);
      return false;
    }
  }

  return false;
}

// Request signature validation
export function validateRequestSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('x-signature');
  const timestamp = request.headers.get('x-timestamp');
  
  if (!signature || !timestamp) {
    return false;
  }

  // Check timestamp (prevent replay attacks)
  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);
  const timeWindow = 5 * 60 * 1000; // 5 minutes
  
  if (Math.abs(now - requestTime) > timeWindow) {
    return false;
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(body + timestamp)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Secure response creation
export function createAuthenticatedResponse(data: any, status: number = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', "default-src 'self'");
  
  // Remove sensitive headers
  response.headers.delete('X-Powered-By');
  response.headers.delete('Server');
  
  return response;
}

// Input sanitization
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .substring(0, 1000); // Limit length
}

// Rate limiting helper
export function getClientIdentifier(request: NextRequest): string {
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('x-client-ip') ||
                   'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Create a hash of IP + User-Agent for better identification
  return crypto
    .createHash('sha256')
    .update(clientIp + userAgent)
    .digest('hex');
}

// Request logging for security monitoring
export function logSecurityEvent(event: string, request: NextRequest, details?: any): void {
  const logData = {
    timestamp: new Date().toISOString(),
    event,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    origin: request.headers.get('origin') || 'unknown',
    path: request.nextUrl.pathname,
    method: request.method,
    details
  };

  console.log('SECURITY_EVENT:', JSON.stringify(logData));
} 