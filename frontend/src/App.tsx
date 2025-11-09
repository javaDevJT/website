import { useState, useEffect } from 'react';
import BootSequence from './components/BootSequence';
import CustomTerminalEnhanced from './components/CustomTerminalEnhanced';

function App() {
  const [showBoot, setShowBoot] = useState(() => {
    // Only show boot sequence once per session
    const hasBooted = sessionStorage.getItem('hasBooted');
    return !hasBooted;
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

  if (showBoot) {
    return <BootSequence onComplete={handleBootComplete} />;
  }

  return <CustomTerminalEnhanced />;
}

export default App;
