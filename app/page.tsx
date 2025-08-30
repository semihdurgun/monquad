"use client";
import { useState, useEffect } from 'react';
import AuthComponent from '@/components/Auth';
import { 
  Calculator, 
  Shield, 
  Zap, 
  ArrowRight,
  CheckCircle,
  Brain,
  Clock,
  Target,
  Sparkles,
  Play,
  Trophy,
  Users,
  TrendingUp
} from 'lucide-react';
import { getTranslation, getCurrentLanguage } from '@/lib/i18n';

export default function Home() {
  const lang = getCurrentLanguage();
  const [animatedNumbers, setAnimatedNumbers] = useState<string[]>(['M', 'O', 'N', 'Q']);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Animated MONQ sequence effect
  useEffect(() => {
    const sequences = [
      ['M', 'O', 'N', 'Q'],
      ['1', '2', '3', '4'],
      ['9', '8', '7', '6'], 
      ['5', '0', '1', '9'],
      ['M', 'O', 'N', 'Q']
    ];
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % sequences.length;
        setAnimatedNumbers(sequences[nextIndex]);
        return nextIndex;
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Floating numbers animation
  const [floatingNumbers, setFloatingNumbers] = useState<Array<{id: number, x: number, y: number, delay: number}>>([]);
  
  useEffect(() => {
    const numbers = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5
    }));
    setFloatingNumbers(numbers);
  }, []);
  
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0f0617] via-[#1a0b2e] via-[#2d1b69] to-[#000000]">
      {/* Floating Numbers Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {floatingNumbers.map((num) => (
          <div
            key={num.id}
            className="absolute text-purple-500/10 font-mono text-4xl animate-pulse"
            style={{
              left: `${num.x}%`,
              top: `${num.y}%`,
              animationDelay: `${num.delay}s`,
              animationDuration: `${4 + Math.random() * 4}s`
            }}
          >
            {Math.floor(Math.random() * 10)}
          </div>
        ))}
      </div>

      {/* Geometric Background Effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-radial from-purple-600/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-radial from-amber-500/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gradient-radial from-blue-500/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex justify-between items-center p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-amber-500 rounded-lg flex items-center justify-center">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-300 bg-clip-text text-transparent">
            MONQUAD
          </h2>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 min-h-[calc(100vh-120px)] flex items-center">
        <div className="w-full max-w-7xl mx-auto px-6">
          {/* Hero Section */}
          <div className="text-center mb-16">

            {/* Main MONQ Display */}
            <div className="flex justify-center mb-8">
              <div className="flex gap-4">
                {animatedNumbers.map((char, i) => (
                  <div
                    key={i}
                    className="relative group"
                  >
                    <div
                      className="w-20 h-28 bg-black/80 border-2 rounded-xl flex items-center justify-center transition-all duration-500 hover:scale-105"
                      style={{
                        borderColor: currentIndex === 0 ? 'rgba(139, 69, 19, 0.6)' : 'rgba(255, 165, 0, 0.6)',
                        boxShadow: currentIndex === 0 
                          ? '0 0 30px rgba(139, 69, 19, 0.4), inset 0 0 20px rgba(139, 69, 19, 0.1)' 
                          : '0 0 30px rgba(255, 165, 0, 0.4), inset 0 0 20px rgba(255, 165, 0, 0.1)'
                      }}
                    >
                      <span 
                        className="text-4xl font-bold font-mono transition-all duration-500"
                        style={{
                          color: currentIndex === 0 ? '#D2691E' : '#ff6a00',
                          textShadow: currentIndex === 0 
                            ? '0 0 15px rgba(139, 69, 19, 0.8)' 
                            : '0 0 15px rgba(255, 106, 0, 0.8)'
                        }}
                      >
                        {char}
                      </span>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/5 rounded-xl pointer-events-none" />
                  </div>
                ))}
              </div>
            </div>

            {/* Hero Title */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-purple-200 to-amber-300 bg-clip-text text-transparent">
                Mon
                <img src="/assets/monquad-fav1.png" alt="MONQUAD" className="w-20 h-20 inline-block" />
                uad
              </span>
            </h1>

            {/* Hero Description */}
            <p className="text-xl text-purple-100/80 mb-12 max-w-2xl mx-auto leading-relaxed">
              {getTranslation(lang, 'heroDescription')}
            </p>

            {/* Main Content Layout - Auth + Features Side by Side */}
            <div className="w-full max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                
                {/* Left Side - Enhanced Auth Component */}
                <div className="group relative w-full max-w-md mx-auto lg:mx-0">
                  {/* Animated Background Glow */}
                  <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 via-amber-500 to-purple-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-80 transition-all duration-500 animate-pulse" />
                  
                  {/* Secondary Glow Layer */}
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-400 to-amber-400 rounded-xl opacity-30 group-hover:opacity-50 transition-all duration-300" />
                  
                  {/* Main Container */}
                  <div className="relative bg-gradient-to-br from-gray-900/95 to-black/95 backdrop-blur-sm rounded-xl border border-purple-500/20 shadow-2xl group-hover:shadow-purple-500/25 transition-all duration-300">
                    {/* Inner Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-amber-600/5 rounded-xl" />
                    
                    {/* Content Container */}
                    <div className="relative p-6">
                      {/* Auth Component */}
                      <AuthComponent />
                      
                      {/* Security Badge */}
                      <div className="mt-4 flex justify-center">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <div className="w-1 h-1 bg-amber-400 rounded-full" />
                          <span>Secured by Privy</span>
                          <div className="w-1 h-1 bg-amber-400 rounded-full" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side - Game Features Text */}
                <div className="w-full space-y-6 text-left">
                  <div className="space-y-4">
                    <div className="space-y-4 text-purple-200/80 leading-relaxed">
                      <p className="text-lg">
                        <span className="text-purple-300 font-semibold">
                          {getTranslation(lang, 'logicPuzzle')}:
                        </span>{' '}
                        {getTranslation(lang, 'logicDescription')}
                      </p>
                      
                      <p className="text-lg">
                        <span className="text-amber-300 font-semibold">
                          {getTranslation(lang, 'timedChallenge')}:
                        </span>{' '}
                        {getTranslation(lang, 'timedDescription')}
                      </p>
                      
                      <p className="text-lg">
                        <span className="text-green-300 font-semibold">
                          {getTranslation(lang, 'eightAttempts')}:
                        </span>{' '}
                        {getTranslation(lang, 'attemptsDescription')}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}