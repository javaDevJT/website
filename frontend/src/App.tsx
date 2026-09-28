import { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import BootSequence from './components/BootSequence';
import CustomTerminalEnhanced from './components/CustomTerminalEnhanced';
import ScanLines from './components/ScanLines';

const readStorage = (kind: 'local' | 'session', key: string): string | null => {
  try {
    const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (kind: 'local' | 'session', key: string, value: string): void => {
  try {
    const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
    storage.setItem(key, value);
  } catch {
    // The terminal remains usable when browser storage is unavailable.
  }
};

function App() {
  const [showBoot, setShowBoot] = useState(() => {
    // Only show boot sequence once per session
    const hasBooted = readStorage('session', 'hasBooted');
    return !hasBooted;
  });

  const [scanLinesEnabled, setScanLinesEnabled] = useState(() => {
    // Load scan lines preference from localStorage
    const saved = readStorage('local', 'scanlines-enabled');
    if (saved === null) {
      return true;
    }
    return saved === 'true';
  });

  const handleBootComplete = () => {
    writeStorage('session', 'hasBooted', 'true');
    setShowBoot(false);
  };

  // Skip boot sequence with Escape key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showBoot) {
        handleBootComplete();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showBoot]);

  // Update scan lines preference
  useEffect(() => {
    writeStorage('local', 'scanlines-enabled', scanLinesEnabled.toString());
  }, [scanLinesEnabled]);

  if (showBoot) {
    return (
      <ErrorBoundary>
        <BootSequence onComplete={handleBootComplete} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ScanLines enabled={scanLinesEnabled} />
      <CustomTerminalEnhanced 
        onToggleScanLines={() => setScanLinesEnabled(!scanLinesEnabled)}
        scanLinesEnabled={scanLinesEnabled}
      />
    </ErrorBoundary>
  );
}

export default App;
