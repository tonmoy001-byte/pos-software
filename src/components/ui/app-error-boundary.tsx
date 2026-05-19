"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { ErrorState } from "./states";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-8">
          <ErrorState
            title="Application Error"
            message={this.state.error?.message || "An unexpected error occurred"}
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
