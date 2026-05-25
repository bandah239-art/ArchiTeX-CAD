import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-full flex flex-col items-center justify-center p-8 bg-infra-dark text-gray-200">
          <h1 className="text-xl font-semibold text-white mb-2">
            {this.props.fallbackTitle ?? 'Something went wrong'}
          </h1>
          <p className="text-sm text-gray-400 mb-4 max-w-lg text-center">
            {this.state.error.message}
          </p>
          <button
            type="button"
            className="px-4 py-2 rounded bg-infra-accent text-white text-sm hover:bg-infra-highlight/80"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
