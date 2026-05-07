"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SendIcon, ImageIcon, XIcon } from "lucide-react";

export interface AgentAttachment {
  /** Stable client-side id for keying React lists. */
  id: string;
  /** Original file name — surfaced in the bubble for context. */
  name: string;
  /** MIME type. */
  mimeType: string;
  /** `data:image/png;base64,…` URL — what we send to the model. */
  dataUrl: string;
  /** Bytes (rough — measured from the original File). */
  size: number;
}

interface AgentComposerProps {
  onSend: (message: string, attachments?: AgentAttachment[]) => void;
  disabled: boolean;
  contextType: "match" | "team" | "general";
}

const PLACEHOLDERS: Record<string, string> = {
  match: "Ask about this match…",
  team: "Ask about this team…",
  general: "Ask MetaGross anything…",
};

/** Per-image cap. Anything larger costs too many tokens and trips
 *  rate limits before the model has a chance to reason. */
const MAX_BYTES_PER_IMAGE = 5 * 1024 * 1024; // 5 MB
const MAX_IMAGES_PER_MESSAGE = 4;
const ACCEPT_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Read a File into a `data:` URL so we can ship it inline in the
 *  /api/agent body. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function AgentComposer({
  onSend,
  disabled,
  contextType,
}: AgentComposerProps) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      if (arr.length === 0) return;
      const accepted: AgentAttachment[] = [];
      for (const f of arr) {
        if (!ACCEPT_MIME.includes(f.type)) {
          setAttachError(`Unsupported type: ${f.type || "unknown"}`);
          continue;
        }
        if (f.size > MAX_BYTES_PER_IMAGE) {
          setAttachError(
            `${f.name} is ${(f.size / 1024 / 1024).toFixed(1)} MB — cap is 5 MB`,
          );
          continue;
        }
        try {
          const dataUrl = await readFileAsDataUrl(f);
          accepted.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: f.name || "image",
            mimeType: f.type,
            dataUrl,
            size: f.size,
          });
        } catch (err) {
          console.error("[composer] file read failed", err);
        }
      }
      if (accepted.length === 0) return;
      setAttachments((prev) => {
        const combined = [...prev, ...accepted].slice(
          0,
          MAX_IMAGES_PER_MESSAGE,
        );
        if (
          combined.length === MAX_IMAGES_PER_MESSAGE &&
          prev.length + accepted.length > MAX_IMAGES_PER_MESSAGE
        ) {
          setAttachError(`Capped at ${MAX_IMAGES_PER_MESSAGE} images per message`);
        }
        return combined;
      });
      // Auto-clear the error after a short delay so it doesn't linger.
      setTimeout(() => setAttachError(null), 4000);
    },
    [],
  );

  const handleSend = useCallback(() => {
    const trimmed = message.trim();
    // Allow image-only sends ("here's a screenshot, what do you see?")
    // — supply a default text so downstream nodes that key on a
    // non-empty user message still behave.
    if ((!trimmed && attachments.length === 0) || disabled) return;
    onSend(trimmed || "(see attached image)", attachments);
    setMessage("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [message, attachments, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void addFiles(files);
      }
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const dt = e.dataTransfer;
      if (!dt?.files?.length) return;
      const imgs = Array.from(dt.files).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (imgs.length === 0) return;
      e.preventDefault();
      void addFiles(imgs);
    },
    [addFiles],
  );

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div
      className="flex flex-col gap-2 border-t border-border p-3"
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
      }}
      onDrop={handleDrop}
    >
      {/* Attachment thumbnails — render above the textarea when present. */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="group relative h-16 w-16 overflow-hidden rounded-md border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.dataUrl}
                alt={a.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                aria-label={`Remove ${a.name}`}
                className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {attachError && (
        <div className="text-xs text-destructive">{attachError}</div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_MIME.join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            // Reset so the same file can be picked twice in a row.
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || attachments.length >= MAX_IMAGES_PER_MESSAGE}
          size="icon"
          variant="outline"
          className="shrink-0"
          aria-label="Attach image"
          title="Attach image (or paste a screenshot)"
        >
          <ImageIcon className="size-4" />
        </Button>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={PLACEHOLDERS[contextType]}
          disabled={disabled}
          rows={1}
          className="min-h-[36px] max-h-[160px] flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        />
        <Button
          onClick={handleSend}
          disabled={
            disabled || (!message.trim() && attachments.length === 0)
          }
          size="icon"
          className="shrink-0"
          aria-label="Send message"
          title="Send message"
        >
          <SendIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
