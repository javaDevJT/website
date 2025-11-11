import { useState, useEffect } from 'react';

export interface Theme {
  name: string;
  background: string;
  text: string;
  prompt: string;
  error: string;
  success: string;
  info: string;
}

export const themes: Record<string, Theme> = {
  classic: {
    name: 'Classic',
    background: '#000000',
    text: '#00ff00',
    prompt: '#00ff00',
    error: '#ff5555',
    success: '#00ff00',
    info: '#ffffff',
  },
  amber: {
    name: 'Amber',
    background: '#000000',
    text: '#ffb000',
    prompt: '#ffb000',
    error: '#ff5555',
    success: '#00ff00',
    info: '#ffcc66',
  },
  blue: {
    name: 'IBM Blue',
    background: '#000000',
    text: '#00aaff',
    prompt: '#00aaff',
    error: '#ff5555',
    success: '#00ff00',
    info: '#66ccff',
  },
  hacker: {
    name: 'Hacker',
    background: '#0d0d0d',
    text: '#00ff41',
    prompt: '#00ff41',
    error: '#ff0000',
    success: '#00ff41',
    info: '#ccffcc',
  },
  synthwave: {
    name: 'Synthwave',
    background: '#1a1a2e',
    text: '#ff00ff',
    prompt: '#00ffff',
    error: '#ff0055',
    success: '#00ff00',
    info: '#ff6ec7',
  },
  light: {
    name: 'Light',
    background: '#f5f5f5',
    text: '#000000',
    prompt: '#0066cc',
    error: '#cc0000',
    success: '#009900',
    info: '#333333',
  },
};

export const useTheme = () => {
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    const saved = localStorage.getItem('terminal-theme');
    return saved || 'classic';
  });

  useEffect(() => {
    localStorage.setItem('terminal-theme', currentTheme);
    // Dispatch a custom event to notify other components
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: currentTheme }));
  }, [currentTheme]);

  // Listen for theme changes from other components
  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newTheme = customEvent.detail;
      if (newTheme !== currentTheme) {
        setCurrentTheme(newTheme);
      }
    };

    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, [currentTheme]);

  const changeTheme = (themeName: string) => {
    if (themes[themeName]) {
      setCurrentTheme(themeName);
      return true;
    }
    return false;
  };

  const getTheme = (): Theme => {
    return themes[currentTheme] || themes.classic;
  };

  const listThemes = (): string[] => {
    return Object.keys(themes);
  };

  return {
    currentTheme,
    changeTheme,
    getTheme,
    listThemes,
  };
};
