import { NextRequest } from 'next/server';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

interface ClientData {
  requests: number[];
  blocked: boolean;
  blockUntil: number;
}

// In-memory store (in production, use Redis)
const clientStore = new Map<string, ClientData>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of clientStore.entries()) {
    // Remove requests older than 1 hour
    data.requests = data.requests.filter(time => now - time < 60 * 60 * 1000);
    
    // Remove blocked status if expired
    if (data.blocked && now > data.blockUntil) {
      data.blocked = false;
      data.blockUntil = 0;
    }
    
    // Remove empty entries
    if (data.requests.length === 0 && !data.blocked) {
      clientStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Enhanced rate limiting with multiple windows
export function rateLimit(
  clientId: string, 
  config: RateLimitConfig,
  request?: NextRequest
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Get or create client data
  let clientData = clientStore.get(clientId);
  if (!clientData) {
    clientData = {
      requests: [],
      blocked: false,
      blockUntil: 0
    };
    clientStore.set(clientId, clientData);
  }

  // Check if client is blocked
  if (clientData.blocked) {
    if (now < clientData.blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: clientData.blockUntil,
        retryAfter: Math.ceil((clientData.blockUntil - now) / 1000)
      };
    } else {
      // Unblock client
      clientData.blocked = false;
      clientData.blockUntil = 0;
    }
  }

  // Remove old requests outside the window
  clientData.requests = clientData.requests.filter(time => time > windowStart);

  // Check current request count
  const currentRequests = clientData.requests.length;
  const remaining = Math.max(0, config.maxRequests - currentRequests);

  if (currentRequests >= config.maxRequests) {
    // Block client for exponential backoff
    const blockDuration = Math.min(
      30 * 60 * 1000, // Max 30 minutes
      Math.pow(2, Math.floor(currentRequests / config.maxRequests)) * 60 * 1000 // Exponential backoff
    );
    
    clientData.blocked = true;
    clientData.blockUntil = now + blockDuration;

    // Log security event
    if (request) {
      console.log('RATE_LIMIT_BLOCKED:', {
        clientId,
        currentRequests,
        blockDuration,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      });
    }

    return {
      allowed: false,
      remaining: 0,
      resetTime: clientData.blockUntil,
      retryAfter: Math.ceil(blockDuration / 1000)
    };
  }

  // Add current request
  clientData.requests.push(now);

  return {
    allowed: true,
    remaining: remaining - 1,
    resetTime: now + config.windowMs
  };
}

// Multi-tier rate limiting
export function multiTierRateLimit(clientId: string, request?: NextRequest): RateLimitResult {
  const now = Date.now();
  
  // Tier 1: Per-minute limit
  const minuteLimit = rateLimit(clientId, { maxRequests: 60, windowMs: 60 * 1000 }, request);
  if (!minuteLimit.allowed) {
    return minuteLimit;
  }

  // Tier 2: Per-hour limit
  const hourLimit = rateLimit(clientId, { maxRequests: 600, windowMs: 60 * 60 * 1000 }, request);
  if (!hourLimit.allowed) {
    return hourLimit;
  }

  // Tier 3: Per-day limit
  const dayLimit = rateLimit(clientId, { maxRequests: 8000, windowMs: 24 * 60 * 60 * 1000 }, request);
  if (!dayLimit.allowed) {
    return dayLimit;
  }

  return {
    allowed: true,
    remaining: Math.min(minuteLimit.remaining, hourLimit.remaining, dayLimit.remaining),
    resetTime: Math.min(minuteLimit.resetTime, hourLimit.resetTime, dayLimit.resetTime)
  };
}

// IP-based rate limiting with subnet consideration
export function ipBasedRateLimit(request: NextRequest): RateLimitResult {
  const clientIp = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('x-client-ip') ||
                   'unknown';
  
  // Extract subnet for better rate limiting
  const subnet = clientIp.split('.')[0] + '.' + clientIp.split('.')[1];
  const clientId = `ip:${clientIp}:subnet:${subnet}`;
  
  return multiTierRateLimit(clientId, request);
}

// User-Agent based rate limiting
export function userAgentBasedRateLimit(request: NextRequest): RateLimitResult {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const clientId = `ua:${userAgent}`;
  
  // Stricter limits for suspicious user agents
  const isSuspicious = /bot|crawler|spider|scraper/i.test(userAgent);
  const maxRequests = isSuspicious ? 15 : 30;
  
  return rateLimit(clientId, { maxRequests, windowMs: 60 * 1000 }, request);
}

// Combined rate limiting
export function combinedRateLimit(request: NextRequest): RateLimitResult {
  const ipResult = ipBasedRateLimit(request);
  if (!ipResult.allowed) {
    return ipResult;
  }

  const uaResult = userAgentBasedRateLimit(request);
  if (!uaResult.allowed) {
    return uaResult;
  }

  return {
    allowed: true,
    remaining: Math.min(ipResult.remaining, uaResult.remaining),
    resetTime: Math.min(ipResult.resetTime, uaResult.resetTime)
  };
} 