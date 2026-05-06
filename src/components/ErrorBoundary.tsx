import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Optional getter returning a snapshot of relevant props/state at crash time. */
  getContext?: () => Record<string, unknown>;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors in its subtree and logs full diagnostic detail
 * (message, stack, component stack, route) to the console so you can copy/paste
 * the exact failure. Renders a minimal recovery UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const payload = {
      label: this.props.label ?? "ErrorBoundary",
      route: typeof window !== "undefined" ? window.location.pathname + window.location.search : "ssr",
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: info.componentStack,
      time: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "ssr",
    };
    // Grouped, fully expanded log so it's easy to copy from devtools.
    // eslint-disable-next-line no-console
    console.group(`🛑 [${payload.label}] render error @ ${payload.route}`);
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line no-console
    console.error("Component stack:", info.componentStack);
    // eslint-disable-next-line no-console
    console.error("Diagnostics:", payload);
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="font-semibold text-destructive">Something went wrong on this page.</p>
        <p className="mt-1 text-muted-foreground">
          The full error has been logged to your browser console (open DevTools → Console).
        </p>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px]">
          {error.message}
        </pre>
        <button
          onClick={this.reset}
          className="mt-3 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    );
  }
}
