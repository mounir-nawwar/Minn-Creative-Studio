import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary component catches JavaScript errors in child components
 * and displays a fallback UI instead of crashing the entire app.
 * 
 * Usage:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  /**
   * Update state when an error occurs
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Log error details when caught
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console for development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // In production, you could log to Sentry, Rollbar, etc.
    // Sentry.captureException(error, { extra: errorInfo });
  }

  /**
   * Reset error state (call from fallback UI)
   */
  resetError = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 m-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <h2 className="text-red-400 font-bold text-lg">Something went wrong</h2>
          </div>
          
          <div className="bg-red-950/30 border border-red-500/30 rounded p-3 mb-4">
            <p className="text-red-300 font-mono text-sm">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={this.resetError}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 rounded-lg text-sm font-medium transition-colors"
            >
              Try Again
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 text-blue-300 rounded-lg text-sm font-medium transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
