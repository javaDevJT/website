import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          fontFamily: 'Fira Code, monospace',
          backgroundColor: '#000',
          color: '#ff5555',
          height: '100vh',
          width: '100vw',
          padding: '20px',
          overflow: 'auto'
        }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px' }}>
{`
╔════════════════════════════════════════════════════════════╗
║                   SYSTEM ERROR                             ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  An unexpected error occurred in the terminal.             ║
║                                                            ║
║  Error: ${this.state.error?.message || 'Unknown error'}
║                                                            ║
║  Please refresh the page to restart the terminal.          ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

Stack Trace:
${this.state.error?.stack || 'No stack trace available'}

Component Stack:
${this.state.errorInfo?.componentStack || 'No component stack available'}
`}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#ff5555',
              color: '#000',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '14px'
            }}
          >
            Reload Terminal
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
