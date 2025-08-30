"use client";
import { useState, useEffect } from 'react';
import { Language, languages, getCurrentLanguage, setLanguage } from '@/lib/i18n';
import { Globe, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  onLanguageChange?: (lang: Language) => void;
}

export default function LanguageSelector({ onLanguageChange }: LanguageSelectorProps) {
  const [currentLang, setCurrentLang] = useState<Language>('en');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const lang = getCurrentLanguage();
    setCurrentLang(lang);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setCurrentLang(lang);
    setLanguage(lang);
    setIsOpen(false);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
    // Force page reload to apply translations
    window.location.reload();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 255, 255, 0.05) 100%)',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          borderRadius: '12px',
          color: '#00ffff',
          fontSize: '14px',
          fontWeight: '500',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          minWidth: '120px',
          justifyContent: 'space-between'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 255, 255, 0.15) 0%, rgba(0, 255, 255, 0.1) 100%)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 255, 255, 0.05) 100%)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Globe size={16} />
          <span>{languages[currentLang]}</span>
        </div>
        <ChevronDown 
          size={14} 
          style={{ 
            transition: 'transform 0.3s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }} 
        />
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          right: '0',
          marginTop: '4px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 255, 255, 0.1)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          {Object.entries(languages).map(([code, name]) => (
            <button
              key={code}
              onClick={() => handleLanguageChange(code as Language)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 12px',
                background: code === currentLang 
                  ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.2) 0%, rgba(0, 255, 255, 0.1) 100%)'
                  : 'transparent',
                border: 'none',
                color: code === currentLang ? '#00ffff' : 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                fontWeight: code === currentLang ? '600' : '500',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => {
                if (code !== currentLang) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0, 255, 255, 0.1) 0%, rgba(0, 255, 255, 0.05) 100%)';
                  e.currentTarget.style.color = '#00ffff';
                }
              }}
              onMouseLeave={(e) => {
                if (code !== currentLang) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
                }
              }}
            >
              <span>{name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close dropdown when clicking outside */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
