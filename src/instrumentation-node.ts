/**
 * Node.js-only instrumentation. Loaded dynamically from
 * `instrumentation.ts` so the Edge bundler never has to analyse these
 * `process.on` / `process.memoryUsage` calls.
 */
export function registerNodeInstrumentation(): void {
  // Guard #1: unhandled Promise rejections. Log loudly but keep the
  // process alive — the agent graph has several async side-effects
  // (embedding API, LLM calls) whose failure shouldn't crash the
  // whole web server.
  process.on("unhandledRejection", (reason) => {
    const msg =
      reason instanceof Error
        ? reason.stack ?? reason.message
        : String(reason);
    console.error("[instrumentation] unhandledRejection:", msg);
  });

  // Guard #2: uncaught exceptions. Same rationale — a throw in a
  // background node (outside of a try/catch we control) would
  // otherwise terminate the Node process.
  process.on("uncaughtException", (err) => {
    console.error(
      "[instrumentation] uncaughtException:",
      err.stack ?? err.message,
    );
  });

  // Observability hook — print peak memory every 60s in dev so we
  // can spot slow leaks before they OOM. Cheap: single RSS read.
  if (process.env.NODE_ENV !== "production") {
    setInterval(() => {
      const m = process.memoryUsage();
      const rssMb = Math.round(m.rss / 1024 / 1024);
      const heapMb = Math.round(m.heapUsed / 1024 / 1024);
      if (rssMb > 3000) {
        console.warn(
          `[instrumentation] memory high — rss=${rssMb}MB heap=${heapMb}MB`,
        );
      }
    }, 60_000).unref();
  }
}
