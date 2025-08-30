"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  usePrivy,
  CrossAppAccountWithMetadata,
} from "@privy-io/react-auth";
import { useMonadGameUser } from "@/hooks/useMonadGameUser";
import { useAccountStore } from "@/store/accountStore";
import { useAuth } from "@/hooks/useAuth";
import { 
  AlertTriangle, 
  Loader2, 
  ArrowRight, 
  ExternalLink, 
  CheckCircle, 
  XCircle, 
  LogOut,
  Play,
  User,
  Shield,
  Zap
} from 'lucide-react';
import { getTranslation, getCurrentLanguage, Language } from '@/lib/i18n';
import LanguageSelector from './LanguageSelector';

// Separate component for when Privy is not configured
function AuthNotConfigured() {
  const lang = getCurrentLanguage();
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 16px',
      background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(251, 191, 36, 0.08) 100%)',
      border: '1px solid rgba(251, 191, 36, 0.4)',
      borderRadius: '12px',
      color: '#ffffff',
      fontSize: '14px',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      fontWeight: '500',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 8px 32px rgba(251, 191, 36, 0.2)'
    }}>
      <AlertTriangle size={16} />
      <span>{getTranslation(lang, 'authenticationNotConfigured')}</span>
    </div>
  );
}

// Main auth component with Privy hooks
function PrivyAuth() {
  const { authenticated, user, ready, logout: privyLogout, login } = usePrivy();
  const [message, setMessage] = useState<string>("");
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const router = useRouter();
  
  const { accountAddress, setAccountAddress, user: storeUser, hasUsername, setUser, setHasUsername } = useAccountStore();
  const { login: jwtLogin, logout: jwtLogout, isAuthenticated: isJwtAuthenticated, user: jwtUser } = useAuth();
  
  const { 
    user: monadUser, 
    hasUsername: hookHasUsername, 
    isLoading: isLoadingUser, 
    error: userError 
  } = useMonadGameUser(accountAddress);

  useEffect(() => {
    // Check if privy is ready and user is authenticated
    if (authenticated && user && ready) {
      // Check if user has linkedAccounts
      if (user.linkedAccounts.length > 0) {
        // Get the cross app account created using Monad Games ID        
        const crossAppAccount: CrossAppAccountWithMetadata = user.linkedAccounts.filter(account => account.type === "cross_app" && account.providerApp.id === process.env.NEXT_PUBLIC_MONAD_CROSS_APP_ID)[0] as CrossAppAccountWithMetadata;

        // The first embedded wallet created using Monad Games ID, is the wallet address
        if (crossAppAccount && crossAppAccount.embeddedWallets.length > 0) {
          const address = crossAppAccount.embeddedWallets[0].address;
          setAccountAddress(address);
        }
      } else {
        setMessage("You need to link your Monad Games ID account to continue.");
      }
    } else {
      // Clear address when not authenticated
      setAccountAddress("");
    }
  }, [authenticated, user, ready, setAccountAddress]);

  // Update store with user data from hook
  useEffect(() => {
    setUser(monadUser);
    setHasUsername(hookHasUsername);
  }, [monadUser, hookHasUsername, setUser, setHasUsername]);

  // Auto JWT login when Privy auth is complete and we have user data
  useEffect(() => {
    async function handleJwtLogin() {
      // Check if we have all required data and JWT login is not already done
      if (
        authenticated && 
        accountAddress && 
        monadUser && 
        hookHasUsername && 
        !isJwtAuthenticated && 
        !isAuthenticating
      ) {
        setIsAuthenticating(true);
        
        try {
          console.log('🔄 Attempting JWT login with Privy data:', {
            username: monadUser.username,
            walletAddress: accountAddress
          });
          
          const success = await jwtLogin(monadUser.username, accountAddress);
          
          if (success) {
            console.log('✅ JWT login successful');
          } else {
            console.error('❌ JWT login failed');
            setMessage('Failed to authenticate with backend');
          }
        } catch (error) {
          console.error('❌ JWT login error:', error);
          setMessage('Authentication error occurred');
        } finally {
          setIsAuthenticating(false);
        }
      }
    }

    handleJwtLogin();
  }, [authenticated, accountAddress, monadUser, hookHasUsername, isJwtAuthenticated, isAuthenticating, jwtLogin]);

  // Full logout function (both Privy and JWT)
  const handleFullLogout = async () => {
    try {
      // Clear account store
      setAccountAddress("");
      setUser(null);
      setHasUsername(false);
      
      // JWT logout
      await jwtLogout();
      
      // Privy logout
      await privyLogout();
      
      console.log('✅ Full logout completed');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  if (!ready) {
    const lang = getCurrentLanguage();
    
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(147, 51, 234, 0.08) 100%)',
        border: '1px solid rgba(147, 51, 234, 0.4)',
        borderRadius: '12px',
        color: '#ffffff',
        fontSize: '14px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontWeight: '500',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 32px rgba(147, 51, 234, 0.2)'
      }}>
        <Loader2 size={16} className="animate-spin" />
        <span>{getTranslation(lang, 'loading')}</span>
      </div>
    );
  }

  if (!authenticated) {
    const lang = getCurrentLanguage();
    
    return (
      <button 
        onClick={login}
        title="Sign in with Privy"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          width: '100%',
          padding: '16px 24px',
          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.25) 0%, rgba(147, 51, 234, 0.15) 100%)',
          border: '1px solid rgba(147, 51, 234, 0.5)',
          borderRadius: '12px',
          color: '#ffffff',
          fontSize: '16px',
          fontWeight: '600',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 8px 32px rgba(147, 51, 234, 0.3), 0 0 0 1px rgba(147, 51, 234, 0.2)',
          backdropFilter: 'blur(10px)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(147, 51, 234, 0.35) 0%, rgba(147, 51, 234, 0.25) 100%)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(147, 51, 234, 0.4), 0 0 0 1px rgba(147, 51, 234, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(147, 51, 234, 0.25) 0%, rgba(147, 51, 234, 0.15) 100%)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(147, 51, 234, 0.3), 0 0 0 1px rgba(147, 51, 234, 0.2)';
        }}
      >
        <Shield size={18} />
        <span>{getTranslation(lang, 'login')}</span>
        <ArrowRight size={18} />
      </button>
    );
  }

  const lang = getCurrentLanguage();
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', width: '100%' }}>
      {accountAddress ? (
        <>
          {hasUsername && storeUser ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px',
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.12) 0%, rgba(147, 51, 234, 0.06) 100%)',
              border: '1px solid rgba(147, 51, 234, 0.3)',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(147, 51, 234, 0.15)'
            }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#ffffff', 
                fontWeight: '600',
                fontSize: '15px'
              }}>
                <User size={16} />
                <span>{storeUser.username}</span>
              </div>
              <div style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'monospace'
              }}>
                {accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}
              </div>
              {isAuthenticating ? (
                <div style={{ 
                  color: '#ffffff', 
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(251, 191, 36, 0.1) 100%)',
                  borderRadius: '8px',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  backdropFilter: 'blur(5px)'
                }}>
                  <Loader2 size={12} className="animate-spin" />
                  {getTranslation(lang, 'authenticating')}
                </div>
              ) : isJwtAuthenticated ? (
                <div style={{ 
                  color: '#ffffff', 
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%)',
                  borderRadius: '8px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  backdropFilter: 'blur(5px)'
                }}>
                  <CheckCircle size={12} />
                  Authenticated
                </div>
              ) : (
                <div style={{ 
                  color: '#ffffff', 
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 10px',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%)',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backdropFilter: 'blur(5px)'
                }}>
                  <XCircle size={12} />
                  {getTranslation(lang, 'authenticationPending')}
                </div>
              )}
            </div>
          ) : (
            <a 
              href="https://monad-games-id-site.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '16px 24px',
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(251, 191, 36, 0.15) 100%)',
                border: '1px solid rgba(251, 191, 36, 0.5)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: '600',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 8px 32px rgba(251, 191, 36, 0.3), 0 0 0 1px rgba(251, 191, 36, 0.2)',
                animation: 'pulse 2s infinite',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.animation = 'none';
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(251, 191, 36, 0.35) 0%, rgba(251, 191, 36, 0.25) 100%)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(251, 191, 36, 0.4), 0 0 0 1px rgba(251, 191, 36, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.animation = 'pulse 2s infinite';
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(251, 191, 36, 0.15) 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(251, 191, 36, 0.3), 0 0 0 1px rgba(251, 191, 36, 0.2)';
              }}
            >
              <span>{getTranslation(lang, 'registerUsername')}</span>
              <ExternalLink size={18} />
            </a>
          )}
        </>
      ) : message ? (
        <div style={{ 
          color: '#ffffff', 
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.1) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(239, 68, 68, 0.2)'
        }}>
          <AlertTriangle size={14} />
          {message}
        </div>
      ) : (
        <div style={{ 
          color: '#ffffff', 
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.2) 0%, rgba(147, 51, 234, 0.1) 100%)',
          border: '1px solid rgba(147, 51, 234, 0.4)',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(147, 51, 234, 0.2)'
        }}>
          <Loader2 size={14} className="animate-spin" />
          {getTranslation(lang, 'checking')}
        </div>
      )}
      
      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Play Game Button */}
        {hasUsername && (
          <button 
            onClick={isJwtAuthenticated ? () => router.push('/game') : undefined}
            disabled={!isJwtAuthenticated}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              color: isJwtAuthenticated ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              cursor: isJwtAuthenticated ? 'pointer' : 'not-allowed',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: isJwtAuthenticated ? 1 : 0.6,
              background: isJwtAuthenticated 
                ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.25) 0%, rgba(147, 51, 234, 0.15) 100%)'
                : 'linear-gradient(135deg, rgba(100, 100, 100, 0.25) 0%, rgba(100, 100, 100, 0.15) 100%)',
              border: isJwtAuthenticated 
                ? '1px solid rgba(147, 51, 234, 0.5)'
                : '1px solid rgba(100, 100, 100, 0.4)',
              boxShadow: isJwtAuthenticated 
                ? '0 8px 32px rgba(147, 51, 234, 0.3), 0 0 0 1px rgba(147, 51, 234, 0.2)'
                : '0 8px 32px rgba(100, 100, 100, 0.2)',
              backdropFilter: 'blur(10px)',
              ...(isJwtAuthenticated && { animation: 'pulse 2s infinite' })
            }}
            onMouseEnter={(e) => {
              if (isJwtAuthenticated) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.animation = 'none';
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(147, 51, 234, 0.35) 0%, rgba(147, 51, 234, 0.25) 100%)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(147, 51, 234, 0.4), 0 0 0 1px rgba(147, 51, 234, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (isJwtAuthenticated) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(147, 51, 234, 0.25) 0%, rgba(147, 51, 234, 0.15) 100%)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(147, 51, 234, 0.3), 0 0 0 1px rgba(147, 51, 234, 0.2)';
                e.currentTarget.style.animation = 'pulse 2s infinite';
              }
            }}
            title={isJwtAuthenticated ? getTranslation(lang, 'continueToGame') : getTranslation(lang, 'waitingForAuthentication')}
          >
            {isJwtAuthenticated ? (
              <>
                <Play size={18} />
                <span>{getTranslation(lang, 'playGame')}</span>
              </>
            ) : (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{getTranslation(lang, 'authenticating')}</span>
              </>
            )}
          </button>
        )}

        {/* Logout Button */}
        <button 
          onClick={hasUsername ? handleFullLogout : privyLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#ffffff',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(147, 51, 234, 0.08) 100%)',
            border: '1px solid rgba(147, 51, 234, 0.3)',
            boxShadow: '0 4px 16px rgba(147, 51, 234, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(147, 51, 234, 0.25) 0%, rgba(147, 51, 234, 0.15) 100%)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(147, 51, 234, 0.3)';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(147, 51, 234, 0.08) 100%)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(147, 51, 234, 0.2)';
            e.currentTarget.style.color = '#ffffff';
          }}
          title={hasUsername ? "Complete logout (Privy + JWT)" : getTranslation(lang, 'logout')}
        >
          <LogOut size={16} />
          <span>{getTranslation(lang, 'logout')}</span>
        </button>
      </div>
    </div>
  );
}

// Main component that conditionally renders based on Privy configuration
export default function AuthComponent() {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  
  if (!privyAppId) {
    return <AuthNotConfigured />;
  }
  
  return <PrivyAuth />;
}