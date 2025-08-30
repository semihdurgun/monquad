'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Types
export interface User {
  id: string;
  username: string;
  walletAddress: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextType extends AuthState {
  login: (username: string, walletAddress: string) => Promise<boolean>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Auto refresh token setup
  useEffect(() => {
    if (authState.isAuthenticated) {
      // Set up auto-refresh 1 minute before expiry (14 minutes)
      const refreshInterval = setInterval(async () => {
        console.log('🔄 Auto-refreshing token...');
        const success = await refreshToken();
        if (!success) {
          console.log('❌ Auto-refresh failed, logging out');
          await logout();
        }
      }, 14 * 60 * 1000); // 14 minutes

      return () => clearInterval(refreshInterval);
    }
  }, [authState.isAuthenticated]);

  async function checkAuthStatus() {
    try {
      console.log('🔍 Checking auth status...');
      
      const response = await fetch('/api/auth/refresh', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📤 Auth status response:', data);
        
        if (data.valid && data.user) {
          console.log('✅ Valid auth found, setting user state');
          setAuthState({
            user: data.user,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          console.log('❌ No valid auth found');
          setAuthState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }

  async function login(username: string, walletAddress: string): Promise<boolean> {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, walletAddress }),
      });

      if (response.ok) {
        const data = await response.json();
        setAuthState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
        });
        console.log('✅ Login successful:', data.user.username);
        return true;
      } else {
        const errorData = await response.json();
        console.error('❌ Login failed:', errorData.error);
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
        return false;
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      return false;
    }
  }

  async function refreshToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAuthState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
        });
        console.log('✅ Token refreshed for:', data.user.username);
        return true;
      } else {
        const errorData = await response.json();
        console.error('❌ Token refresh failed:', errorData.error);
        
        // If security breach detected, clear state
        if (errorData.error.includes('Security breach')) {
          setAuthState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
        
        return false;
      }
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      console.log('✅ Logged out successfully');
    }
  }

  async function logoutAllDevices(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout all devices error:', error);
    } finally {
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      console.log('✅ Logged out from all devices');
    }
  }

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    logoutAllDevices,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for making authenticated API calls
export function useAuthenticatedFetch() {
  const { refreshToken, logout } = useAuth();

  return async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    // First attempt
    let response = await fetch(url, {
      ...options,
      credentials: 'include',
    });

    // If 401 and requires refresh, try to refresh and retry
    if (response.status === 401) {
      const errorData = await response.json();
      
      if (errorData.requiresRefresh) {
        console.log('🔄 Access token expired, attempting refresh...');
        
        const refreshSuccess = await refreshToken();
        if (refreshSuccess) {
          // Retry the original request
          response = await fetch(url, {
            ...options,
            credentials: 'include',
          });
        } else {
          // Refresh failed, logout user
          console.log('❌ Token refresh failed, logging out');
          await logout();
          throw new Error('Authentication failed');
        }
      }
    }

    return response;
  };
}
