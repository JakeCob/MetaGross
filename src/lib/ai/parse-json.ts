/**
 * Parse a JSON object out of an LLM text response. Models often wrap JSON in a
 * ```json fence or add a stray prose line; strip the fence and, as a fallback,
 * extract the outermost {...} before parsing. Throws a friendly error on
 * malformed output (the caller surfaces "try again").
 */
export function parseJsonResponse<T>(text: string): T {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  try {
    return JSON.parse(s) as T;
  } catch {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(s.slice(first, last + 1)) as T;
      } catch {
        // fall through
      }
    }
    throw new Error("AI response was malformed (not valid JSON). Please try again.");
  }
}
