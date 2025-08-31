'use client'
import { useState, useEffect } from 'react'
import { useAccountStore } from '@/store/accountStore'
import { X, RefreshCw } from 'lucide-react'
import { getTranslation, getCurrentLanguage, Language } from '@/lib/i18n'

interface PlayerData {
  playerAddress: string;
  score: number;
  transactions: number;
  lastUpdated: number;
}

interface LeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
}

export default function Leaderboard({ isOpen, onClose, language }: LeaderboardProps) {
  const { accountAddress } = useAccountStore()
  const [playerData, setPlayerData] = useState<PlayerData | null>(null)
  const [gameData, setGameData] = useState<PlayerData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentLanguage = language || getCurrentLanguage()

  useEffect(() => {
    if (isOpen && accountAddress) {
      fetchPlayerData()
    }
  }, [isOpen, accountAddress])

  const fetchPlayerData = async () => {
    if (!accountAddress) return

    setIsLoading(true)
    setError(null)

    try {
      // Fetch total player data
      const playerResponse = await fetch(`/api/get-player?playerAddress=${accountAddress}`)
      const playerResult = await playerResponse.json()

      if (playerResult.success) {
        setPlayerData(playerResult.data)
      }

      // Fetch game-specific data
      const gameResponse = await fetch(`/api/get-player-game?playerAddress=${accountAddress}`)
      const gameResult = await gameResponse.json()

      if (gameResult.success) {
        setGameData(gameResult.data)
      }

    } catch (err) {
      setError(getTranslation(currentLanguage, 'failedToLoad'))
      console.error('Leaderboard fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      zIndex: 2000,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: 'rgba(20,20,20,0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        padding: '40px',
        maxWidth: '600px',
        width: '100%',
        height: '100%',
        marginTop: '50px',
        border: '1px solid rgba(255,255,255,0.2)',
        color: '#fff',
        fontFamily: 'Lucida Console, Courier New, monospace',
        animation: 'slideDown 0.4s ease-out',
        position: 'relative'
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          }}
        >
          ×
        </button>

        {/* Header */}
        <h2 style={{ 
          margin: '0 0 30px 0', 
          fontSize: '28px',
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#fff'
        }}>
          {getTranslation(currentLanguage, 'leaderboard')}
        </h2>

        {/* Main Content */}
        <div style={{ marginBottom: '30px' }}>
          {isLoading ? (
            <div style={{
              textAlign: 'center',
              fontSize: '16px',
              lineHeight: '1.6',
              color: '#ccc'
            }}>
              {getTranslation(currentLanguage, 'loadingStats')}
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ 
                margin: '0 0 20px 0', 
                fontSize: '16px', 
                lineHeight: '1.6',
                color: '#ef4444'
              }}>
                {error}
              </p>
              <button
                onClick={fetchPlayerData}
                style={{
                  padding: '12px 40px',
                  background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(156, 39, 176, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(156, 39, 176, 0.3)';
                }}
              >
                <RefreshCw size={16} />
                {getTranslation(currentLanguage, 'retry')}
              </button>
            </div>
          ) : (
            <div>
              
              {/* Total Statistics Section */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ 
                  margin: '0 0 20px 0', 
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#fff'
                }}>
                  {getTranslation(currentLanguage, 'totalStatistics')}
                </h3>
                {playerData ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      padding: '20px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: '#9C27B0',
                        marginBottom: '8px'
                      }}>
                        {playerData.score.toLocaleString()}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#ccc'
                      }}>
                        {getTranslation(currentLanguage, 'totalScore')}
                      </div>
                    </div>
                    <div style={{
                      padding: '20px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: '#9C27B0',
                        marginBottom: '8px'
                      }}>
                        {playerData.transactions}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#ccc'
                      }}>
                        {getTranslation(currentLanguage, 'gamesPlayed')}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ 
                    margin: '0', 
                    fontSize: '16px', 
                    lineHeight: '1.6',
                    color: '#ccc'
                  }}>
                    {getTranslation(currentLanguage, 'noDataAvailable')}
                  </p>
                )}
              </div>

              {/* Separator */}
              <div style={{
                width: '100%',
                height: '1px',
                background: 'rgba(255,255,255,0.3)',
                margin: '25px 0'
              }} />

              {/* PIN Game Statistics Section */}
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ 
                  margin: '0 0 20px 0', 
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#fff'
                }}>
                  {getTranslation(currentLanguage, 'pinGameStatistics')}
                </h3>
                {gameData ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '20px',
                    textAlign: 'center'
                  }}>
                    <div style={{
                      padding: '20px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: '#9C27B0',
                        marginBottom: '8px'
                      }}>
                        {gameData.score.toLocaleString()}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#ccc'
                      }}>
                        {getTranslation(currentLanguage, 'bestScore')}
                      </div>
                    </div>
                    <div style={{
                      padding: '20px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.05)'
                    }}>
                      <div style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: '#9C27B0',
                        marginBottom: '8px'
                      }}>
                        {gameData.transactions}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#ccc'
                      }}>
                        Sessions
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ 
                    margin: '0', 
                    fontSize: '16px', 
                    lineHeight: '1.6',
                    color: '#ccc'
                  }}>
                    No PIN game data available
                  </p>
                )}
              </div>

              {/* Separator */}
              <div style={{
                width: '100%',
                height: '1px',
                background: 'rgba(255,255,255,0.3)',
                margin: '25px 0'
              }} />

              {/* Player Information Section */}
              {accountAddress && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 style={{ 
                    margin: '0 0 15px 0', 
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#fff'
                  }}>
                    {getTranslation(currentLanguage, 'playerInformation')}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span style={{ fontSize: '14px', color: '#ccc', minWidth: '120px' }}>
                        {getTranslation(currentLanguage, 'walletAddress')}:
                      </span>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '14px',
                        color: '#9C27B0'
                      }}>
                        {formatAddress(accountAddress)}
                      </span>
                    </div>
                    {playerData && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <span style={{ fontSize: '14px', color: '#ccc', minWidth: '120px' }}>
                          {getTranslation(currentLanguage, 'lastUpdated')}:
                        </span>
                        <span style={{
                          fontSize: '14px',
                          color: '#9C27B0'
                        }}>
                          {formatDate(playerData.lastUpdated)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideDown {
          from { 
            opacity: 0;
            transform: translateY(-50px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
} 