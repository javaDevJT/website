import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';

interface Tool {
  name: string;
  icon: string;
  url: string;
  alt: string;
}

const tools: Tool[] = [
  {
    name: 'Angular',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/angularjs/angularjs-original-wordmark.svg',
    url: 'https://angular.io',
    alt: 'angularjs'
  },
  {
    name: 'AWS',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/amazonwebservices/amazonwebservices-original-wordmark.svg',
    url: 'https://aws.amazon.com',
    alt: 'aws'
  },
  {
    name: 'Azure',
    icon: 'https://www.vectorlogo.zone/logos/microsoft_azure/microsoft_azure-icon.svg',
    url: 'https://azure.microsoft.com/en-in/',
    alt: 'azure'
  },
  {
    name: 'Bash',
    icon: 'https://www.vectorlogo.zone/logos/gnu_bash/gnu_bash-icon.svg',
    url: 'https://www.gnu.org/software/bash/',
    alt: 'bash'
  },
  {
    name: 'Docker',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/docker/docker-original-wordmark.svg',
    url: 'https://www.docker.com/',
    alt: 'docker'
  },
  {
    name: 'Express',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/express/express-original-wordmark.svg',
    url: 'https://expressjs.com',
    alt: 'express'
  },
  {
    name: 'Git',
    icon: 'https://www.vectorlogo.zone/logos/git-scm/git-scm-icon.svg',
    url: 'https://git-scm.com/',
    alt: 'git'
  },
  {
    name: 'Grafana',
    icon: 'https://www.vectorlogo.zone/logos/grafana/grafana-icon.svg',
    url: 'https://grafana.com',
    alt: 'grafana'
  },
  {
    name: 'Java',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/java/java-original.svg',
    url: 'https://www.java.com',
    alt: 'java'
  },
  {
    name: 'JavaScript',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/javascript/javascript-original.svg',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    alt: 'javascript'
  },
  {
    name: 'Kafka',
    icon: 'https://www.vectorlogo.zone/logos/apache_kafka/apache_kafka-icon.svg',
    url: 'https://kafka.apache.org/',
    alt: 'kafka'
  },
  {
    name: 'Kubernetes',
    icon: 'https://www.vectorlogo.zone/logos/kubernetes/kubernetes-icon.svg',
    url: 'https://kubernetes.io',
    alt: 'kubernetes'
  },
  {
    name: 'Linux',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/linux/linux-original.svg',
    url: 'https://www.linux.org/',
    alt: 'linux'
  },
  {
    name: 'SQL Server',
    icon: 'https://www.svgrepo.com/show/303229/microsoft-sql-server-logo.svg',
    url: 'https://www.microsoft.com/en-us/sql-server',
    alt: 'mssql'
  },
  {
    name: 'Nginx',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/nginx/nginx-original.svg',
    url: 'https://www.nginx.com',
    alt: 'nginx'
  },
  {
    name: 'Node.js',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/nodejs/nodejs-original-wordmark.svg',
    url: 'https://nodejs.org',
    alt: 'nodejs'
  },
  {
    name: 'Oracle',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/oracle/oracle-original.svg',
    url: 'https://www.oracle.com/',
    alt: 'oracle'
  },
  {
    name: 'PostgreSQL',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/postgresql/postgresql-original-wordmark.svg',
    url: 'https://www.postgresql.org',
    alt: 'postgresql'
  },
  {
    name: 'Python',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/python/python-original.svg',
    url: 'https://www.python.org',
    alt: 'python'
  },
  {
    name: 'RabbitMQ',
    icon: 'https://www.vectorlogo.zone/logos/rabbitmq/rabbitmq-icon.svg',
    url: 'https://www.rabbitmq.com',
    alt: 'rabbitMQ'
  },
  {
    name: 'React',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original-wordmark.svg',
    url: 'https://reactjs.org/',
    alt: 'react'
  },
  {
    name: 'Redis',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/redis/redis-original-wordmark.svg',
    url: 'https://redis.io',
    alt: 'redis'
  },
  {
    name: 'Spring',
    icon: 'https://www.vectorlogo.zone/logos/springio/springio-icon.svg',
    url: 'https://spring.io/',
    alt: 'spring'
  },
  {
    name: 'TypeScript',
    icon: 'https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg',
    url: 'https://www.typescriptlang.org/',
    alt: 'typescript'
  },
  {
    name: 'Datadog',
    icon: 'https://imgix.datadoghq.com/img/about/presskit/logo-v/dd_vertical_white.png?auto=format&fit=max&w=847&dpr=2',
    url: 'https://www.datadoghq.com/',
    alt: 'datadog'
  }
];

const ToolsDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentTheme, getTheme } = useTheme();
  
  // Force component to re-render when currentTheme changes by using it in useMemo
  const theme = React.useMemo(() => {
    return getTheme();
  }, [currentTheme, getTheme]);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  // Helper function to convert hex to rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const content = (
    <>
      {/* Toggle Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleDrawer();
        }}
        className="fixed px-4 py-2 rounded-l-lg border-2 border-r-0 font-mono text-sm font-bold transition-all cursor-pointer"
        style={{ 
          top: 'calc(50% - 20px)',
          right: '0',
          backgroundColor: 'transparent',
          color: theme.text,
          borderColor: hexToRgba(theme.text, 0.5),
          pointerEvents: 'auto',
          zIndex: 10000,
        }}
        title={isOpen ? "Close Tools" : "View Tools"}
      >
        <span className="flex items-center gap-2">
          <span>TOOLS</span>
          <span>{isOpen ? '×' : '▸'}</span>
        </span>
      </button>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={toggleDrawer}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
                zIndex: 10000,
              }}
            />

            {/* Drawer Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: '0%' }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '320px',
                backgroundColor: theme.background === '#000000' || theme.background === '#0d0d0d' || theme.background === '#1a1a2e'
                  ? 'rgba(30, 30, 40, 0.98)'
                  : hexToRgba(theme.background, 0.95),
                borderLeft: `4px solid ${theme.text}`,
                boxShadow: `0 0 30px ${hexToRgba(theme.text, 0.5)}`,
                overflowY: 'auto',
                zIndex: 10001,
              }}
            >

              {/* Header */}
              <div 
                style={{
                  position: 'sticky',
                  top: 0,
                  padding: '16px',
                  backgroundColor: theme.background === '#000000' || theme.background === '#0d0d0d' || theme.background === '#1a1a2e'
                    ? 'rgba(30, 30, 40, 0.98)'
                    : hexToRgba(theme.background, 0.95),
                  borderBottom: `2px solid ${theme.text}`,
                  zIndex: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 
                    style={{ 
                      fontFamily: 'Fira Code, monospace',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      letterSpacing: '0.05em',
                      color: theme.text,
                      margin: 0,
                    }}
                  >
                    $ ls /tools
                  </h2>
                  <button
                    onClick={toggleDrawer}
                    style={{ 
                      background: 'none',
                      border: 'none',
                      color: theme.text,
                      fontSize: '28px',
                      fontFamily: 'Fira Code, monospace',
                      lineHeight: 1,
                      cursor: 'pointer',
                      padding: '0 4px',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = theme.error}
                    onMouseLeave={(e) => e.currentTarget.style.color = theme.text}
                    aria-label="Close drawer"
                  >
                    ×
                  </button>
                </div>
                <div 
                  style={{ 
                    marginTop: '8px',
                    fontSize: '12px',
                    fontFamily: 'Fira Code, monospace',
                    color: hexToRgba(theme.text, 0.7),
                  }}
                >
                  {tools.length} items found
                </div>
              </div>

              {/* Tools Grid */}
              <div style={{ padding: '24px' }}>
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '24px',
                }}>
                  {tools.map((tool) => (
                    <a
                      key={tool.name}
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        textDecoration: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Icon Container */}
                      <div 
                        style={{
                          width: '56px',
                          height: '56px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: hexToRgba(theme.text, 0.06),
                          borderRadius: '8px',
                          border: `1px solid ${hexToRgba(theme.text, 0.2)}`,
                          transition: 'all 0.3s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = hexToRgba(theme.text, 0.15);
                          e.currentTarget.style.borderColor = theme.text;
                          const img = e.currentTarget.querySelector('img') as HTMLImageElement;
                          if (img) img.style.filter = 'grayscale(0%)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = hexToRgba(theme.text, 0.06);
                          e.currentTarget.style.borderColor = hexToRgba(theme.text, 0.2);
                          const img = e.currentTarget.querySelector('img') as HTMLImageElement;
                          if (img) img.style.filter = 'grayscale(100%)';
                        }}
                      >
                        <img
                          src={tool.icon}
                          alt={tool.alt}
                          style={{
                            width: '40px',
                            height: '40px',
                            objectFit: 'contain',
                            filter: 'grayscale(100%)',
                            transition: 'filter 0.3s ease',
                          }}
                          loading="lazy"
                        />
                      </div>
                      {/* Tool Name */}
                      <span 
                        style={{ 
                          fontSize: '11px',
                          fontFamily: 'Fira Code, monospace',
                          color: hexToRgba(theme.text, 0.7),
                          textAlign: 'center',
                          lineHeight: '1.2',
                          maxWidth: '80px',
                          wordWrap: 'break-word',
                        }}
                      >
                        {tool.name}
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div 
                style={{
                  position: 'sticky',
                  bottom: 0,
                  padding: '16px',
                  backgroundColor: theme.background === '#000000' || theme.background === '#0d0d0d' || theme.background === '#1a1a2e'
                    ? 'rgba(30, 30, 40, 0.98)'
                    : hexToRgba(theme.background, 0.95),
                  borderTop: `2px solid ${theme.text}`,
                }}
              >
                <p 
                  style={{ 
                    fontSize: '12px',
                    fontFamily: 'Fira Code, monospace',
                    textAlign: 'center',
                    color: hexToRgba(theme.text, 0.6),
                    margin: 0,
                  }}
                >
                  Click any tool to learn more
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );

  return createPortal(content, document.body);
};

export default ToolsDrawer;
