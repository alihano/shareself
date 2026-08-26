"use client";

import { Component, type ReactNode } from "react";
import { Button } from "./Button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// React error boundaries must be class components — there is no hook
// equivalent (per React's own docs) — so this stays a class despite the rest
// of the app being function components.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger-bg p-6 text-center">
          <p className="font-medium text-red-400">{this.props.fallbackTitle ?? "Something went wrong"}</p>
          <p className="text-sm text-red-300/80">{this.state.error.message}</p>
          <Button variant="secondary" onClick={this.reset}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
