import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, X } from 'lucide-react';
import './Keyboard.css';

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  onEnter: () => void;
  onDelete: () => void;
  disabled?: boolean;
  maxLength?: number;
  currentLength?: number;
}

const Keyboard: React.FC<KeyboardProps> = ({
  onKeyPress,
  onEnter,
  onDelete,
  disabled = false,
  maxLength = 4,
  currentLength = 0
}) => {
  const handleKeyboard = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    if (event.key === "Enter") {
      onEnter();
    } else if (event.key === "Backspace") {
      onDelete();
    } else if (event.key >= '0' && event.key <= '9') {
      if (currentLength < maxLength) {
        onKeyPress(event.key);
      }
    }
  }, [disabled, onEnter, onDelete, onKeyPress, currentLength, maxLength]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyboard);
    return () => {
      document.removeEventListener("keydown", handleKeyboard);
    };
  }, [handleKeyboard]);

  const selectLetter = (keyVal: string) => {
    if (disabled) return;

    if (keyVal === "ENTER") {
      onEnter();
    } else if (keyVal === "DLT") {
      onDelete();
    } else {
      if (currentLength < maxLength) {
        onKeyPress(keyVal);
      }
    }
  };

  return (
    <div className="keyboard-container">
      <div className="keyboard">
        {/* Row 1: 1, 2, 3 */}
        <div className="keyboard-row">
          {['1', '2', '3'].map((key) => (
            <button
              key={key}
              className="keyboard-key number-key"
              onClick={() => selectLetter(key)}
              disabled={disabled || currentLength >= maxLength}
            >
              <span className="key-content">{key}</span>
            </button>
          ))}
        </div>
        
        {/* Row 2: 4, 5, 6 */}
        <div className="keyboard-row">
          {['4', '5', '6'].map((key) => (
            <button
              key={key}
              className="keyboard-key number-key"
              onClick={() => selectLetter(key)}
              disabled={disabled || currentLength >= maxLength}
            >
              <span className="key-content">{key}</span>
            </button>
          ))}
        </div>
        
        {/* Row 3: 7, 8, 9 */}
        <div className="keyboard-row">
          {['7', '8', '9'].map((key) => (
            <button
              key={key}
              className="keyboard-key number-key"
              onClick={() => selectLetter(key)}
              disabled={disabled || currentLength >= maxLength}
            >
              <span className="key-content">{key}</span>
            </button>
          ))}
        </div>
        
        {/* Row 4: Delete, 0, Enter */}
        <div className="keyboard-row">
          <button
            className="keyboard-key delete-key"
            onClick={() => selectLetter("DLT")}
            disabled={disabled}
          >
            <span className="key-content">
              <X className="key-icon" size={16} />
            </span>
          </button>
          
          <button
            className="keyboard-key number-key"
            onClick={() => selectLetter("0")}
            disabled={disabled || currentLength >= maxLength}
          >
            <span className="key-content">0</span>
          </button>
          
          <button
            className="keyboard-key enter-key"
            onClick={() => selectLetter("ENTER")}
            disabled={disabled}
          >
            <span className="key-content">
              <ArrowRight className="key-icon" size={16} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Keyboard;