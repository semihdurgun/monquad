'use client'
import dynamic from 'next/dynamic'
import { useAccountStore } from '@/store/accountStore'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const PinGame = dynamic(() => import('@/components/Pingame'), { ssr: false })

export default function Page() {
  const { accountAddress, user, hasUsername } = useAccountStore()
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  
  console.log('Game page - Account:', accountAddress, user, hasUsername)
  console.log('Game page - Auth:', { isAuthenticated, isLoading })

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.log('🔒 Not authenticated, redirecting to home...')
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#00ffff',
        fontSize: '18px'
      }}>
        <div>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>Checking authentication...</div>
          <div style={{ textAlign: 'center', fontSize: '14px', opacity: 0.7 }}>Please wait...</div>
        </div>
      </div>
    )
  }

  // Show redirect message if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#0a0a0a',
        color: '#ff6b6b',
        fontSize: '18px'
      }}>
        <div>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>🔒 Authentication required</div>
          <div style={{ textAlign: 'center', fontSize: '14px', opacity: 0.7 }}>Redirecting to login...</div>
        </div>
      </div>
    )
  }

  return <PinGame accountAddress={accountAddress} user={user} hasUsername={hasUsername} />
}