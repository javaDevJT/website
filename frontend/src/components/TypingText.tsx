import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTypingEffect, TypingSpeed } from '../hooks/useTypingEffect';

interface TypingTextProps {
  text: string;
  speed?: TypingSpeed;
  enabled?: boolean;
  onComplete?: () => void;
  className?: string;
  showCursor?: boolean;
}

const TypingText: React.FC<TypingTextProps> = ({
  text,
  speed = 'fast',
  enabled = true,
  onComplete,
  className = '',
  showCursor = false,
}) => {
  const { displayedText, isTyping, skip } = useTypingEffect({
    text,
    speed,
    enabled,
    onComplete,
  });

  // Allow skipping animation on any keypress
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isTyping && e.key !== 'Tab' && e.key !== 'Shift' && e.key !== 'Control') {
        skip();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isTyping, skip]);

  return (
    <span className={className}>
      {displayedText}
      {showCursor && isTyping && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
          style={{ marginLeft: '2px' }}
        >
          █
        </motion.span>
      )}
    </span>
  );
};

export default TypingText;
