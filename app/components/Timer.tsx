import React, { useEffect, useState, useRef, useCallback } from 'react'

interface TimerProps {
  initialTime?: number;
  onTimeUp?: () => void;
  isActive?: boolean;
  key?: string; // Force re-render when game state changes
}

function Timer({ 
  initialTime = 300, // 5 minutes default
  onTimeUp,
  isActive = true,
  key
}: TimerProps) {
    const [timeLeft, setTimeLeft] = useState(initialTime);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const onTimeUpRef = useRef(onTimeUp);

    // Update ref when onTimeUp changes
    useEffect(() => {
        onTimeUpRef.current = onTimeUp;
    }, [onTimeUp]);

    // Reset timer when initialTime changes or component re-mounts
    useEffect(() => {
        setTimeLeft(initialTime);
    }, [initialTime, key]);

    // Timer logic
    useEffect(() => {
        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Don't start timer if not active
        if (!isActive) {
            return;
        }

        // Start timer
        intervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    // Time's up
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    // Call onTimeUp callback
                    if (onTimeUpRef.current) {
                        onTimeUpRef.current();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Cleanup function
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isActive, key]); // Add key to dependencies to force re-render

    // Format time as MM:SS
    const formatTime = useCallback((seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, []);

    // Get color based on time remaining
    const getTimeColor = useCallback((seconds: number): string => {
        if (seconds > 60) return '#fff'; // White for normal time
        if (seconds > 15) return '#FFD700'; // Gold for warning
        return '#FF4444'; // Red for critical
    }, []);

    return (
        <div className='font-link' style={{ 
            fontSize: '18px', 
            fontWeight: 'bold',
            textAlign: 'center',
            padding: '8px 16px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.7)',
            color: getTimeColor(timeLeft),
            fontFamily: 'Lucida Console, Courier New, monospace',
            border: '1px solid rgba(255,255,255,0.3)',
            minWidth: '80px',
            transition: 'color 0.3s ease'
        }}>
            {timeLeft > 0 ? formatTime(timeLeft) : '00:00'}
        </div>
    );
}

export default Timer; 