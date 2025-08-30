import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MonadGameUser {
  id: number;
  username: string;
  walletAddress: string;
}

interface AccountState {
  accountAddress: string;
  user: MonadGameUser | null;
  hasUsername: boolean;
  
  // Actions
  setAccountAddress: (address: string) => void;
  setUser: (user: MonadGameUser | null) => void;
  setHasUsername: (hasUsername: boolean) => void;
  reset: () => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      accountAddress: '',
      user: null,
      hasUsername: false,
      
      setAccountAddress: (address) => set({ accountAddress: address }),
      setUser: (user) => set({ user }),
      setHasUsername: (hasUsername) => set({ hasUsername }),
      reset: () => set({ accountAddress: '', user: null, hasUsername: false }),
    }),
    {
      name: 'account-storage',
      partialize: (state) => ({ 
        accountAddress: state.accountAddress,
        user: state.user,
        hasUsername: state.hasUsername 
      }),
    }
  )
) 