import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileCommandPaletteProps {
  onCommandSelect: (command: string) => void;
  theme: any;
}

const MobileCommandPalette: React.FC<MobileCommandPaletteProps> = ({ onCommandSelect, theme }) => {
  const [isOpen, setIsOpen] = useState(false);

  const commonCommands = [
    { cmd: 'help', desc: 'Show all commands' },
    { cmd: 'ls', desc: 'List files' },
    { cmd: 'cd portfolio', desc: 'View portfolio' },
    { cmd: 'cd blog', desc: 'View blog' },
    { cmd: 'cat about.txt', desc: 'About me' },
    { cmd: 'resume', desc: 'View resume' },
    { cmd: 'contact', desc: 'Contact info' },
    { cmd: 'neofetch', desc: 'System info' },
    { cmd: 'theme', desc: 'Change theme' },
    { cmd: 'clear', desc: 'Clear screen' },
  ];

  const handleCommandClick = (cmd: string) => {
    onCommandSelect(cmd);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        className="mobile-fab"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: theme.prompt,
          color: theme.background,
          border: 'none',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          display: 'none',
        }}
        whileTap={{ scale: 0.9 }}
        aria-label="Open command palette"
      >
        {isOpen ? '✕' : '⌘'}
      </motion.button>

      {/* Command Palette Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 999,
              display: 'none',
            }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: theme.background,
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                maxHeight: '60vh',
                overflowY: 'auto',
                padding: '20px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ 
                color: theme.text, 
                fontFamily: 'Fira Code, monospace',
                marginTop: 0,
                marginBottom: '20px',
                fontSize: '18px'
              }}>
                Quick Commands
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {commonCommands.map((item) => (
                  <button
                    key={item.cmd}
                    onClick={() => handleCommandClick(item.cmd)}
                    style={{
                      backgroundColor: theme.background,
                      color: theme.text,
                      border: `1px solid ${theme.prompt}`,
                      padding: '15px',
                      borderRadius: '8px',
                      fontFamily: 'Fira Code, monospace',
                      fontSize: '14px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.prompt;
                      e.currentTarget.style.color = theme.background;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = theme.background;
                      e.currentTarget.style.color = theme.text;
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      $ {item.cmd}
                    </div>
                    <div style={{ opacity: 0.7, fontSize: '12px' }}>
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .mobile-fab {
            display: block !important;
          }
          
          .mobile-fab + div {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
};

export default MobileCommandPalette;
