import { Component, type ErrorInfo, type ReactNode } from "react";
import { submitCrashReport } from "@/lib/crash-report";

interface Props {
  children: ReactNode;
  label?: string;
  fallback?: (error: Error, reset: () => void, submit: () => Promise<void>, submitState: SubmitState) => ReactNode;
  /** Optional getter returning a snapshot of relevant props/state at crash time. */
  getContext?: () => Record<string, unknown>;
}

type SubmitState = "idle" | "submitting" | "submitted" | "error";

interface State {
  error: Error | null;
  componentStack: string | null;
  capturedContext: Record<string, unknown> | null;
  submitState: SubmitState;
  submittedId: string | null;
  submitError: string | null;
}

/**
 * Catches render-time errors in its subtree and logs full diagnostic detail
 * (message, stack, component stack, route) to the console so you can copy/paste
 * the exact failure. Also offers a "Submit diagnostics" button that POSTs the
 * full report (error + component stack + snapshot) to the backend for later
 * debugging.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    componentStack: null,
    capturedContext: null,
    submitState: "idle",
    submittedId: null,
    submitError: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    let context: Record<string, unknown> | null = null;
    try {
      context = this.props.getContext?.() ?? null;
    } catch (ctxErr) {
      context = { __getContextError: String(ctxErr) };
    }
    this.setState({ componentStack: info.componentStack ?? null, capturedContext: context });
    const payload = {
      label: this.props.label ?? "ErrorBoundary",
      route: typeof window !== "undefined" ? window.location.pathname + window.location.search : "ssr",
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: info.componentStack,
      context,
      time: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "ssr",
    };
    // eslint-disable-next-line no-console
    console.group(`🛑 [${payload.label}] render error @ ${payload.route}`);
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line no-console
    console.error("Component stack:", info.componentStack);
    if (context) {
      // eslint-disable-next-line no-console
      console.error("React context snapshot:", context);
    }
    // eslint-disable-next-line no-console
    console.error("Diagnostics:", payload);
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  reset = () => this.setState({
    error: null,
    componentStack: null,
    capturedContext: null,
    submitState: "idle",
    submittedId: null,
    submitError: null,
  });

  submit = async () => {
    const { error, componentStack, capturedContext } = this.state;
    if (!error) return;
    this.setState({ submitState: "submitting", submitError: null });
    try {
      const id = await submitCrashReport({
        label: this.props.label ?? "ErrorBoundary",
        errorName: error.name,
        message: error.message,
        stack: error.stack ?? null,
        componentStack: componentStack,
        context: capturedContext ?? {},
      });
      this.setState({ submitState: "submitted", submittedId: id });
    } catch (e) {
      this.setState({
        submitState: "error",
        submitError: e instanceof Error ? e.message : String(e),
      });
    }
  };

  render() {
    const { error, submitState, submittedId, submitError } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset, this.submit, submitState);
    return (
      <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="font-semibold text-destructive">Something went wrong on this page.</p>
        <p className="mt-1 text-muted-foreground">
          The full error has been logged to your browser console (open DevTools → Console).
        </p>
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-[11px]">
          {error.message}
        </pre>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={this.reset}
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Try again
          </button>
          <button
            onClick={this.submit}
            disabled={submitState === "submitting" || submitState === "submitted"}
            className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {submitState === "submitting"
              ? "Submitting…"
              : submitState === "submitted"
                ? "Submitted ✓"
                : submitState === "error"
                  ? "Retry submit"
                  : "Submit diagnostics"}
          </button>
          {submitState === "submitted" && submittedId && (
            <span className="text-[11px] text-muted-foreground">Report ID: {submittedId.slice(0, 8)}</span>
          )}
          {submitState === "error" && submitError && (
            <span className="text-[11px] text-destructive">{submitError}</span>
          )}
        </div>
      </div>
    );
  }
}
