// Lightweight client-side error logger.
// Captures uncaught errors, unhandled promise rejections, and lets you
// manually log diagnostic details. Everything goes to console.error with a
// recognizable prefix so it's easy to grep in devtools.

type LogContext = Record<string, unknown>;

const PREFIX = "[client-error]";

export function logClientError(label: string, error: unknown, context?: LogContext) {
  const err = error instanceof Error ? error : new Error(String(error));
  const payload = {
    label,
    route: typeof window !== "undefined" ? window.location.pathname + window.location.search : "ssr",
    name: err.name,
    message: err.message,
    stack: err.stack,
    context,
    time: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "ssr",
  };
  // eslint-disable-next-line no-console
  console.group(`${PREFIX} ${label}`);
  // eslint-disable-next-line no-console
  console.error(err);
  if (context) {
    // eslint-disable-next-line no-console
    console.error("Context:", context);
  }
  // eslint-disable-next-line no-console
  console.error("Diagnostics:", payload);
  // eslint-disable-next-line no-console
  console.groupEnd();
}

let installed = false;
export function installGlobalErrorLogger() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    logClientError("window.error", e.error ?? e.message, {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    logClientError("unhandledrejection", e.reason);
  });
}
