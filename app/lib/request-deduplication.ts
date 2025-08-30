import crypto from 'crypto';

interface RequestData {
  id: string;
  timestamp: number;
  status: 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

// In-memory store for request tracking (in production, use Redis)
const requestStore = new Map<string, RequestData>();

// Cleanup old requests every 10 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [id, data] of requestStore.entries()) {
    if (now - data.timestamp > maxAge) {
      requestStore.delete(id);
    }
  }
}, 10 * 60 * 1000);

// Generate unique request ID
export function generateRequestId(playerAddress: string, scoreAmount: number, transactionAmount: number): string {
  const data = `${playerAddress}:${scoreAmount}:${transactionAmount}:${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Check if request is duplicate
export function isDuplicateRequest(requestId: string): boolean {
  const existingRequest = requestStore.get(requestId);
  
  if (!existingRequest) {
    return false;
  }

  // If request is still processing, consider it duplicate
  if (existingRequest.status === 'processing') {
    return true;
  }

  // If request completed recently (within 5 minutes), consider it duplicate
  const now = Date.now();
  const recentThreshold = 5 * 60 * 1000; // 5 minutes
  
  if (existingRequest.status === 'completed' && 
      now - existingRequest.timestamp < recentThreshold) {
    return true;
  }

  return false;
}

// Mark request as processing
export function markRequestProcessing(requestId: string): void {
  requestStore.set(requestId, {
    id: requestId,
    timestamp: Date.now(),
    status: 'processing'
  });
}

// Mark request as completed
export function markRequestComplete(requestId: string, result?: any): void {
  const existingRequest = requestStore.get(requestId);
  
  if (existingRequest) {
    existingRequest.status = 'completed';
    existingRequest.result = result;
    existingRequest.timestamp = Date.now();
  }
}

// Mark request as failed
export function markRequestFailed(requestId: string, error: string): void {
  const existingRequest = requestStore.get(requestId);
  
  if (existingRequest) {
    existingRequest.status = 'failed';
    existingRequest.error = error;
    existingRequest.timestamp = Date.now();
  }
}

// Get request status
export function getRequestStatus(requestId: string): RequestData | null {
  return requestStore.get(requestId) || null;
}

// Validate request signature to prevent tampering
export function validateRequestSignature(
  requestId: string, 
  playerAddress: string, 
  scoreAmount: number, 
  transactionAmount: number,
  signature: string,
  timestamp: number
): boolean {
  const now = Date.now();
  const timeWindow = 5 * 60 * 1000; // 5 minutes
  
  // Check timestamp
  if (Math.abs(now - timestamp) > timeWindow) {
    return false;
  }

  // Recreate the data that was signed
  const data = `${requestId}:${playerAddress}:${scoreAmount}:${transactionAmount}:${timestamp}`;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.SECRET_KEY || 'default-secret')
    .update(data)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

// Rate limiting per player address
const playerRequestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkPlayerRateLimit(playerAddress: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5; // Max 5 requests per minute per player
  
  const playerData = playerRequestCounts.get(playerAddress);
  
  if (!playerData || now > playerData.resetTime) {
    // Reset or initialize
    playerRequestCounts.set(playerAddress, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }
  
  if (playerData.count >= maxRequests) {
    return false;
  }
  
  playerData.count++;
  return true;
}

// Cleanup player rate limit data
setInterval(() => {
  const now = Date.now();
  for (const [playerAddress, data] of playerRequestCounts.entries()) {
    if (now > data.resetTime) {
      playerRequestCounts.delete(playerAddress);
    }
  }
}, 5 * 60 * 1000);

// Comprehensive request validation
export function validateRequest(
  requestId: string,
  playerAddress: string,
  scoreAmount: number,
  transactionAmount: number,
  signature?: string,
  timestamp?: number
): { valid: boolean; error?: string } {
  // Check if duplicate
  if (isDuplicateRequest(requestId)) {
    return { valid: false, error: 'Duplicate request detected' };
  }

  // Check player rate limit
  if (!checkPlayerRateLimit(playerAddress)) {
    return { valid: false, error: 'Player rate limit exceeded' };
  }

  // Validate signature if provided
  if (signature && timestamp) {
    if (!validateRequestSignature(requestId, playerAddress, scoreAmount, transactionAmount, signature, timestamp)) {
      return { valid: false, error: 'Invalid request signature' };
    }
  }

  // Validate amounts
  if (scoreAmount < 0 || transactionAmount < 0) {
    return { valid: false, error: 'Invalid amounts' };
  }

  if (scoreAmount > 10000 || transactionAmount > 100) {
    return { valid: false, error: 'Amounts exceed limits' };
  }

  return { valid: true };
} 