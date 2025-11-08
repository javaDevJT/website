import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface BootSequenceProps {
  onComplete: () => void;
}

interface ClientInfo {
  hostname?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
}

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [currentLine, setCurrentLine] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [bootLines, setBootLines] = useState<string[]>([
    'Initializing system...',
    'Loading...',
  ]);

  // Fetch REAL server info from backend
  useEffect(() => {
    // Fetch both client and server info in parallel
    Promise.all([
      axios.get('/api/client/info'),
      axios.get('/api/server/boot-info')
    ])
      .then(([clientResponse, serverResponse]) => {
        const clientInfo: ClientInfo = clientResponse.data;
        const serverInfo = serverResponse.data;
        
        setClientInfo(clientInfo);
        
        // Generate boot lines with REAL SERVER data
        const usedMemoryMB = serverInfo.usedMemoryMB;
        const totalMemoryMB = serverInfo.totalMemoryMB;
        const uptimeMs = serverInfo.uptime;
        const uptimeFormatted = formatUptime(uptimeMs);
        
        const lines = [
          'JTDev BIOS Version 1.0.0 (2025-11-08)',
          `Memory Test: ${totalMemoryMB}MB OK`,
          `CPU: ${serverInfo.cpuCores} cores @ ${serverInfo.osArch}`,
          `Platform: ${serverInfo.osName} ${serverInfo.osVersion}`,
          `Java Runtime: ${serverInfo.javaVersion}`,
          `Server Uptime: ${uptimeFormatted}`,
          `Hostname: ${serverInfo.hostname}`,
          `Client IP: ${clientInfo.ipAddress || 'Unknown'}`,
          '',
          'Initializing terminal interface...',
          `Connecting to ${serverInfo.hostname}...`,
          '[  OK  ] Connection established',
          'Loading portfolio system...',
          'Mounting filesystem...',
          `[  OK  ] Mounted /home/${clientInfo.username || 'visitor'}`,
          `[  OK  ] ${usedMemoryMB}MB/${totalMemoryMB}MB memory in use`,
          '[  OK  ] Started User Session Manager',
          '[  OK  ] Reached target Multi-User System',
          '[  OK  ] Reached target Graphical Interface',
          `Starting terminal emulator for ${clientInfo.username || 'visitor'}...`,
          '',
          `Welcome to ${serverInfo.hostname}!`,
          'Joshua Terk Terminal Portfolio v1.0.0',
          `Session: ${new Date().toLocaleString()}`,
          'Ready.',
        ];
        
        setBootLines(lines);
      })
      .catch(error => {
        console.error('Error fetching server info:', error);
        // Fallback boot lines
        const browserInfo = getBrowserInfo(navigator.userAgent);
        const osInfo = getOSInfo(navigator.userAgent);
        
        setBootLines([
          'BIOS Version 1.0.0',
          'Memory Test: 8192MB OK',
          `Client: ${browserInfo} on ${osInfo}`,
          'Initializing terminal interface...',
          'Loading portfolio system...',
          '[  OK  ] System ready',
          'Joshua Terk Terminal Portfolio v1.0.0',
          'Ready.',
        ]);
        // Set dummy client info to trigger boot sequence
        setClientInfo({ hostname: 'localhost' });
      });
  }, []);

  const formatUptime = (uptimeMs: number): string => {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  const getBrowserInfo = (userAgent: string): string => {
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Edg')) return 'Edge';
    return 'Unknown Browser';
  };

  const getOSInfo = (userAgent: string): string => {
    if (userAgent.includes('Mac OS X')) {
      const match = userAgent.match(/Mac OS X ([0-9_]+)/);
      return match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
    }
    if (userAgent.includes('Windows NT')) {
      const match = userAgent.match(/Windows NT ([0-9.]+)/);
      if (match) {
        const version = match[1];
        if (version === '10.0') return 'Windows 10/11';
        return `Windows NT ${version}`;
      }
      return 'Windows';
    }
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return navigator.platform || 'Unknown OS';
  };



  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    // Wait for client info to load before starting boot sequence
    if (!clientInfo) return;
    
    if (currentLine < bootLines.length) {
      // Faster for initial BIOS messages, slower for loading messages
      const isLoadingMessage = bootLines[currentLine].includes('Loading') || 
                               bootLines[currentLine].includes('Initializing') ||
                               bootLines[currentLine].includes('Mounting');
      const delay = currentLine === 0 ? 300 : isLoadingMessage ? Math.random() * 150 + 100 : Math.random() * 80 + 40;
      
      const timer = setTimeout(() => {
        setCurrentLine(prev => prev + 1);
      }, delay);

      return () => clearTimeout(timer);
    } else if (bootLines.length > 2) { // Only complete if we have real boot lines
      // Wait a moment then complete
      const timer = setTimeout(() => {
        onComplete();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [currentLine, bootLines.length, onComplete, clientInfo, bootLines]);

  return (
    <div
      style={{
        fontFamily: 'Fira Code, monospace',
        backgroundColor: '#000',
        color: '#00ff00',
        height: '100vh',
        width: '100vw',
        padding: '20px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '14px',
        lineHeight: '1.4'
      }}
    >
      <AnimatePresence>
        {bootLines.slice(0, currentLine).map((line, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            style={{
              color: line.includes('OK') ? '#00ff00' : 
                     line.includes('Ready') ? '#00ff00' :
                     line.includes('Error') ? '#ff5555' : '#ffffff'
            }}
          >
            {line}
          </motion.div>
        ))}
      </AnimatePresence>
      {currentLine < bootLines.length && showCursor && (
        <span style={{ color: '#00ff00' }}>█</span>
      )}
    </div>
  );
};

export default BootSequence;
