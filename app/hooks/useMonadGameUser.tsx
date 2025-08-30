import { useState, useEffect } from 'react';

interface MonadGameUser {
  id: number;
  username: string;
  walletAddress: string;
}

interface UserResponse {
  hasUsername: boolean;
  user?: MonadGameUser;
}

interface UseMonadGameUserReturn {
  user: MonadGameUser | null;
  hasUsername: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useMonadGameUser(walletAddress: string): UseMonadGameUserReturn {
  const [user, setUser] = useState<MonadGameUser | null>(null);
  const [hasUsername, setHasUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setUser(null);
      setHasUsername(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchUserData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${walletAddress}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log("response", response);

        const data: UserResponse = await response.json();
        console.log("data", data);
        setHasUsername(data.hasUsername);
        setUser(data.user || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setHasUsername(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();

    if (!hasUsername) {
      const interval = setInterval(fetchUserData, 8000);
      
      // Cleanup function
      return () => {
        clearInterval(interval);
      };
    }
  }, [walletAddress, hasUsername]);

  return {
    user,
    hasUsername,
    isLoading,
    error,
  };
}