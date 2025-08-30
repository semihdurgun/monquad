// Edge-compatible crypto
let crypto: any;
if (typeof window === 'undefined') {
  // Server-side: use Node.js crypto
  crypto = require('crypto');
} else {
  // Client-side: use Web Crypto API
  crypto = {
    randomUUID: () => globalThis.crypto.randomUUID()
  };
}

// Types
export interface User {
  id: string;
  username: string;
  walletAddress: string;
  createdAt: number;
  lastLoginAt?: number;
}

export interface LoginCredentials {
  username: string;
  walletAddress: string;
}

// Simulated user database (production'da gerçek database kullanın)
// Bu örnek için memory'de tutuyoruz
const users = new Map<string, User>();

// Helper: Generate user ID
function generateUserId(): string {
  return crypto.randomUUID();
}

// Helper: Normalize wallet address
function normalizeWalletAddress(address: string): string {
  return address.toLowerCase().trim();
}

// Helper: Normalize username
function normalizeUsername(username: string): string {
  return username.toLowerCase().trim();
}

// Validate wallet address format
export function isValidWalletAddress(address: string): boolean {
  const normalizedAddress = normalizeWalletAddress(address);
  // Ethereum address validation (0x + 40 hex characters)
  return /^0x[a-fA-F0-9]{40}$/.test(normalizedAddress);
}

// Validate username format
export function isValidUsername(username: string): boolean {
  const normalizedUsername = normalizeUsername(username);
  // Username: 3-20 characters, alphanumeric + underscore
  return /^[a-z0-9_]{3,20}$/.test(normalizedUsername);
}

// Find user by wallet address
export function findUserByWalletAddress(walletAddress: string): User | null {
  const normalizedAddress = normalizeWalletAddress(walletAddress);
  
  for (const user of users.values()) {
    if (user.walletAddress === normalizedAddress) {
      return user;
    }
  }
  
  return null;
}

// Find user by username
export function findUserByUsername(username: string): User | null {
  const normalizedUsername = normalizeUsername(username);
  
  for (const user of users.values()) {
    if (user.username === normalizedUsername) {
      return user;
    }
  }
  
  return null;
}

// Find user by ID
export function findUserById(userId: string): User | null {
  return users.get(userId) || null;
}

// Create new user
export function createUser(credentials: LoginCredentials): User {
  const normalizedWalletAddress = normalizeWalletAddress(credentials.walletAddress);
  const normalizedUsername = normalizeUsername(credentials.username);

  // Validation
  if (!isValidWalletAddress(normalizedWalletAddress)) {
    throw new Error('Invalid wallet address format');
  }

  if (!isValidUsername(normalizedUsername)) {
    throw new Error('Invalid username format');
  }

  // Check if wallet already exists
  if (findUserByWalletAddress(normalizedWalletAddress)) {
    throw new Error('Wallet address already registered');
  }

  // Check if username already exists
  if (findUserByUsername(normalizedUsername)) {
    throw new Error('Username already taken');
  }

  const user: User = {
    id: generateUserId(),
    username: normalizedUsername,
    walletAddress: normalizedWalletAddress,
    createdAt: Date.now(),
  };

  users.set(user.id, user);
  console.log(`✅ User created: ${user.username} (${user.walletAddress})`);
  
  return user;
}

// Authenticate user (login)
export function authenticateUser(credentials: LoginCredentials): User | null {
  const normalizedWalletAddress = normalizeWalletAddress(credentials.walletAddress);
  const normalizedUsername = normalizeUsername(credentials.username);

  // Validation
  if (!isValidWalletAddress(normalizedWalletAddress) || !isValidUsername(normalizedUsername)) {
    return null;
  }

  // Find user by wallet address
  const user = findUserByWalletAddress(normalizedWalletAddress);
  
  if (!user) {
    console.log(`❌ User not found for wallet: ${normalizedWalletAddress}`);
    return null;
  }

  // Check if username matches
  if (user.username !== normalizedUsername) {
    console.log(`❌ Username mismatch for wallet: ${normalizedWalletAddress}`);
    return null;
  }

  // Update last login
  user.lastLoginAt = Date.now();
  users.set(user.id, user);

  console.log(`✅ User authenticated: ${user.username}`);
  return user;
}

// Register or login user
export function registerOrLoginUser(credentials: LoginCredentials): User {
  const normalizedWalletAddress = normalizeWalletAddress(credentials.walletAddress);
  
  // Try to find existing user
  const existingUser = findUserByWalletAddress(normalizedWalletAddress);
  
  if (existingUser) {
    // User exists, authenticate
    const authenticatedUser = authenticateUser(credentials);
    if (!authenticatedUser) {
      throw new Error('Authentication failed: username mismatch');
    }
    return authenticatedUser;
  } else {
    // User doesn't exist, create new
    return createUser(credentials);
  }
}

// Update user last login
export function updateUserLastLogin(userId: string): void {
  const user = users.get(userId);
  if (user) {
    user.lastLoginAt = Date.now();
    users.set(userId, user);
  }
}

// Get all users (admin function)
export function getAllUsers(): User[] {
  return Array.from(users.values());
}

// Get user count
export function getUserCount(): number {
  return users.size;
}

// Initialize with some test users (development only)
export function initializeTestUsers(): void {
  if (process.env.NODE_ENV === 'development') {
    try {
      createUser({
        username: 'testuser',
        walletAddress: '0x1234567890123456789012345678901234567890'
      });
      
      createUser({
        username: 'admin',
        walletAddress: '0x0987654321098765432109876543210987654321'
      });
      
      console.log('🧪 Test users initialized');
    } catch (error) {
      // Users might already exist
      console.log('ℹ️ Test users already exist or initialization failed');
    }
  }
}
