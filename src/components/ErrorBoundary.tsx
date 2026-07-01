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
        <div className="m-4 rounded-2xl bg-red-500/[0.08] p-6 ring-1 ring-red-500/25">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">!</div>
            <h2 className="text-base font-semibold text-red-400">Something went wrong</h2>
          </div>

          <div className="mb-4 rounded-lg bg-black/30 p-3 ring-1 ring-red-500/20">
            <p className="font-mono text-sm text-red-300">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={this.resetError}
              className="inline-flex h-9 items-center rounded-lg bg-red-500/15 px-4 text-sm font-medium text-red-300 ring-1 ring-red-500/30 transition-[transform,background-color] duration-150 hover:bg-red-500/20 active:scale-[0.96]"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-9 items-center rounded-lg bg-white/[0.06] px-4 text-sm font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.96]"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
