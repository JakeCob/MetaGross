/**
 * Next.js instrumentation hook — runs once when the server process
 * boots in ANY runtime (nodejs or edge).
 *
 * The Node-only guards live in a separate file so the Edge bundler
 * never sees `process.on` / `process.memoryUsage` and can tree-shake
 * this file down to a no-op. Doing the runtime check in the same file
 * doesn't help because the bundler statically analyses both branches.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeInstrumentation } = await import(
      "./instrumentation-node"
    );
    registerNodeInstrumentation();
  }
}
