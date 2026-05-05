export function shouldCacheCompiledGraph(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "production";
}
