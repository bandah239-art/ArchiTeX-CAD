import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  /** Pass the panel name so the error log knows context */
  context?: string;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

function generateId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function sendToElectron(payload: object): void {
  try {
    // window.electronAPI is exposed by Electron preload
    const api = (window as unknown as { electronAPI?: { logError?: (p: object) => void } }).electronAPI;
    api?.logError?.(payload);
  } catch {
    // not running in Electron — silent
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null, errorId: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, errorId: generateId() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const errorId = this.state.errorId ?? generateId();
    const payload = {
      timestamp: new Date().toISOString(),
      level: 'error',
      source: 'react',
      context: this.props.context ?? 'unknown',
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    };

    // Log to console in structured format
    console.error('[ErrorBoundary]', JSON.stringify(payload, null, 2));

    // Send to Electron main process for persistent log file
    sendToElectron(payload);

    this.setState({ errorInfo: info, errorId });
  }

  private handleReset = () => {
    this.setState({ error: null, errorInfo: null, errorId: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      const { error, errorInfo, errorId } = this.state;
      const isDev = import.meta.env.DEV;

      return (
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: '#0f1117',
            color: '#e2e8f0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Icon */}
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>

          <h1
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#f1f5f9',
              marginBottom: '0.4rem',
              textAlign: 'center',
            }}
          >
            {this.props.fallbackTitle ?? 'Something went wrong'}
          </h1>

          <p
            style={{
              fontSize: '0.8rem',
              color: '#94a3b8',
              maxWidth: 480,
              textAlign: 'center',
              marginBottom: '1.5rem',
              lineHeight: 1.5,
            }}
          >
            {error.message || 'An unexpected error occurred in this panel.'}
          </p>

          {/* Error ID for log correlation */}
          {errorId && (
            <p style={{ fontSize: '0.7rem', color: '#475569', marginBottom: '1.5rem', fontFamily: 'monospace' }}>
              Error ID: {errorId}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: isDev ? '1.5rem' : 0 }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: 6,
                background: '#3b82f6',
                color: '#fff',
                fontSize: '0.8rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: 6,
                background: '#1e293b',
                color: '#94a3b8',
                fontSize: '0.8rem',
                border: '1px solid #334155',
                cursor: 'pointer',
              }}
            >
              Reload app
            </button>
          </div>

          {/* Dev-only stack trace */}
          {isDev && (
            <details
              style={{
                marginTop: '1rem',
                maxWidth: 680,
                width: '100%',
                background: '#0d1117',
                border: '1px solid #1e293b',
                borderRadius: 6,
                padding: '0.75rem',
              }}
            >
              <summary
                style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}
              >
                Stack trace (dev only)
              </summary>
              <pre
                style={{
                  fontSize: '0.65rem',
                  color: '#ef4444',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0,
                }}
              >
                {error.stack}
              </pre>
              {errorInfo?.componentStack && (
                <pre
                  style={{
                    fontSize: '0.65rem',
                    color: '#94a3b8',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    margin: '0.5rem 0 0',
                  }}
                >
                  {errorInfo.componentStack}
                </pre>
              )}
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
