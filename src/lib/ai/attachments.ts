/**
 * Server-side attachment sanitizer for /api/agent.
 *
 * Trust nothing the client sends: a malicious user could bypass the
 * UI's file picker and POST any blob. We re-validate MIME type, cap
 * count, and trim raw bytes per attachment before forwarding to the
 * graph.
 */
export interface AgentAttachmentInput {
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface SanitizeOptions {
  /** Max attachments per message. Default 4 — matches the composer cap. */
  maxCount?: number;
  /** Hard cap on raw data URL bytes. Default 8 MB. */
  maxBytesPerItem?: number;
}

const DEFAULT_MAX_COUNT = 4;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Filter, trim, and cap an unknown array from a request body. Returns
 * an array of well-typed attachments (possibly empty). Never throws.
 */
export function sanitizeAgentAttachments(
  raw: unknown,
  opts: SanitizeOptions = {},
): AgentAttachmentInput[] {
  if (!Array.isArray(raw)) return [];
  const maxCount = opts.maxCount ?? DEFAULT_MAX_COUNT;
  const maxBytes = opts.maxBytesPerItem ?? DEFAULT_MAX_BYTES;
  const out: AgentAttachmentInput[] = [];
  for (const a of raw as unknown[]) {
    if (!a || typeof a !== "object") continue;
    const rec = a as Record<string, unknown>;
    if (typeof rec.dataUrl !== "string") continue;
    if (typeof rec.mimeType !== "string") continue;
    if (typeof rec.name !== "string") continue;
    if (!rec.mimeType.startsWith("image/")) continue;
    if (!rec.dataUrl.startsWith("data:image/")) continue;
    out.push({
      name: rec.name,
      mimeType: rec.mimeType,
      dataUrl: rec.dataUrl.slice(0, maxBytes),
    });
    if (out.length >= maxCount) break;
  }
  return out;
}
