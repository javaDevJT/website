import { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import BootSequence from './components/BootSequence';
import CustomTerminalEnhanced from './components/CustomTerminalEnhanced';
import ScanLines from './components/ScanLines';
import ToolsDrawer from './components/ToolsDrawer';

function App() {
  const [showBoot, setShowBoot] = useState(() => {
    // Only show boot sequence once per session
    const hasBooted = sessionStorage.getItem('hasBooted');
    return !hasBooted;
  });

  const [scanLinesEnabled, setScanLinesEnabled] = useState(() => {
    // Load scan lines preference from localStorage
    const saved = localStorage.getItem('scanlines-enabled');
    if (saved === null) {
      return true;
    }
    return saved === 'true';
  });

  const handleBootComplete = () => {
    sessionStorage.setItem('hasBooted', 'true');
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
    localStorage.setItem('scanlines-enabled', scanLinesEnabled.toString());
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
      <ToolsDrawer />
    </ErrorBoundary>
  );
}

export default App;
