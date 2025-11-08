import { useState, useEffect, useCallback } from 'react';

export type TypingSpeed = 'instant' | 'fast' | 'medium' | 'slow';

interface UseTypingEffectOptions {
  text: string;
  speed?: TypingSpeed;
  enabled?: boolean;
  onComplete?: () => void;
}

const SPEED_MAP: Record<TypingSpeed, number> = {
  instant: 0,
  fast: 10,
  medium: 30,
  slow: 60,
};

export const useTypingEffect = ({
  text,
  speed = 'fast',
  enabled = true,
  onComplete,
}: UseTypingEffectOptions) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [shouldSkip, setShouldSkip] = useState(false);

  const skip = useCallback(() => {
    setShouldSkip(true);
  }, []);

  useEffect(() => {
    if (!enabled || speed === 'instant' || shouldSkip) {
      setDisplayedText(text);
      setIsComplete(true);
      setIsTyping(false);
      if (onComplete) onComplete();
      return;
    }

    setIsTyping(true);
    setIsComplete(false);
    setDisplayedText('');

    let currentIndex = 0;
    const delay = SPEED_MAP[speed];

    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsTyping(false);
        setIsComplete(true);
        if (onComplete) onComplete();
        clearInterval(interval);
      }
    }, delay);

    return () => clearInterval(interval);
  }, [text, speed, enabled, onComplete, shouldSkip]);

  return {
    displayedText,
    isTyping,
    isComplete,
    skip,
  };
};
