import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '@/data/telemetry/sentry';
import { FatalScreen } from './FatalScreen';

type State = { error: Error | null; attempt: number };

/**
 * Catches what the app throws while rendering, reports it and shows the fatal screen instead of
 * closing. "Open again" mounts the whole tree afresh; there is no bundle reload without
 * expo-updates, so a fault that repeats shows the screen again.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, { componentStack: info.componentStack });
  }

  private reset = () => {
    this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
  };

  render() {
    if (this.state.error) {
      return <FatalScreen kind="crash" onRetry={this.reset} detail={String(this.state.error)} />;
    }
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
