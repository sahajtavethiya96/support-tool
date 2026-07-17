"use client";

import {
  LockSimpleIcon,
  PaperclipIcon,
  PaperPlaneTiltIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/components/common/rich-text-editor";
import { Button } from "@/components/ui/button";
import { isRichTextEmpty } from "@/lib/rich-text";
import { scrollChatToBottom } from "@/lib/scroll-chat";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/zip",
  "text/plain",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface Props {
  cannedResponses?: { id: string; title: string; content: string }[];
  ticketId: string;
  totalAttachments: number;
}

export function AgentReplyForm({
  ticketId,
  totalAttachments,
  cannedResponses,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);

  const [isInternal, setIsInternal] = useState(false);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const maxNewFiles = Math.max(0, 5 - totalAttachments);

  // Object URLs for image thumbnails in the compose box — created when the
  // file list changes and revoked on cleanup so they never leak.
  const [previews, setPreviews] = useState<Map<File, string>>(new Map());
  useEffect(() => {
    const map = new Map<File, string>();
    for (const f of files) {
      if (f.type.startsWith("image/")) {
        map.set(f, URL.createObjectURL(f));
      }
    }
    setPreviews(map);
    return () => {
      for (const url of map.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [files]);

  function addFiles(newFiles: File[]) {
    const combined = [...files, ...newFiles];
    if (combined.length > maxNewFiles) {
      setError(`Only ${maxNewFiles} more file(s) allowed.`);
      return;
    }
    const oversized = combined.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setError(`"${oversized.name}" exceeds 10 MB.`);
      return;
    }
    const badType = combined.find((f) => !ALLOWED_TYPES.has(f.type));
    if (badType) {
      setError(`"${badType.name}" is not an allowed type.`);
      return;
    }
    setFiles(combined);
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    addFiles(selected);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }

  function handleEnterSubmit() {
    if (!submitting) {
      formRef.current?.requestSubmit();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isRichTextEmpty(content)) {
      setError("Write something before sending.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append("content", content);
      body.append("isInternal", String(isInternal));
      files.forEach((f) => body.append("attachments", f));

      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const msg = data.error ?? "Failed to send.";
        setError(msg);
        toast.error(msg);
        return;
      }
      setContent("");
      setFiles([]);
      editorRef.current?.focus();
      toast.success(
        isInternal ? "Internal note added." : "Reply sent to customer."
      );
      router.refresh();
      scrollChatToBottom();
    } catch {
      setError("Network error. Please try again.");
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit} ref={formRef}>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Slack-style compose box: text input on top (with its own formatting
          toolbar), a divided action bar at the bottom — attach + internal-note
          toggle on the left, send on the right. */}
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card transition-[color,border-color,box-shadow] focus-within:ring-2",
          isInternal
            ? "border-amber-200 bg-amber-50 focus-within:border-amber-400 focus-within:ring-amber-400/20"
            : "border-input focus-within:border-ring focus-within:ring-ring/20"
        )}
      >
        <RichTextEditor
          cannedResponses={cannedResponses}
          className="rounded-none border-0 bg-transparent focus-within:ring-0"
          compact
          disabled={submitting}
          onChange={setContent}
          onFilesDropped={maxNewFiles > 0 ? addFiles : undefined}
          onSubmit={handleEnterSubmit}
          placeholder={
            isInternal
              ? "Write an internal note (only visible to agents)…"
              : "Write a reply to the customer…"
          }
          ref={editorRef}
          tone={isInternal ? "warning" : "default"}
          value={content}
        />

        {/* Uploaded files — thumbnails inside the box (Slack-style): image
            previews for images, a compact icon card for everything else. */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pb-2">
            {files.map((f, i) => {
              const preview = previews.get(f);
              return (
                <div
                  className="group relative"
                  key={`${f.name}-${f.size}-${f.lastModified}`}
                >
                  {preview ? (
                    // biome-ignore lint/performance/noImgElement: local object-URL preview of a not-yet-uploaded file, not a remote asset
                    <img
                      alt={f.name}
                      className="size-16 rounded-lg border border-border object-cover"
                      src={preview}
                    />
                  ) : (
                    <div className="flex size-16 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-accent px-1.5 text-center">
                      <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="w-full truncate text-2xs text-muted-foreground">
                        {f.name}
                      </span>
                    </div>
                  )}
                  <button
                    aria-label={`Remove ${f.name}`}
                    className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform hover:scale-110"
                    onClick={() => removeFile(i)}
                    type="button"
                  >
                    <XIcon className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom action bar */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex items-center gap-0.5">
            {/* Attach */}
            <label
              className={cn(
                "flex size-8 items-center justify-center rounded-md transition-colors",
                maxNewFiles > 0 && !submitting
                  ? "text-foreground hover:bg-accent cursor-pointer"
                  : "text-muted-foreground/40 cursor-not-allowed"
              )}
              title={
                maxNewFiles > 0 ? "Attach file" : "Attachment limit reached"
              }
            >
              <PaperclipIcon className="size-4" />
              <input
                accept=".jpg,.jpeg,.png,.pdf,.zip,.txt"
                className="hidden"
                disabled={submitting || maxNewFiles === 0}
                multiple
                onChange={handleFileChange}
                ref={fileInputRef}
                type="file"
              />
            </label>

            {/* Internal-note toggle */}
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                isInternal
                  ? "bg-amber-100 text-amber-800"
                  : "text-foreground hover:bg-accent"
              )}
              onClick={() => setIsInternal((v) => !v)}
              onMouseDown={(e) => e.preventDefault()}
              title="Toggle internal note — only visible to agents"
              type="button"
            >
              <LockSimpleIcon className="size-3.5" />
              Internal note
            </button>
          </div>

          {/* Send */}
          <Button
            className={cn(
              "size-8 shrink-0 rounded-lg p-0",
              isInternal
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            )}
            disabled={submitting || isRichTextEmpty(content)}
            title={isInternal ? "Add note" : "Send reply"}
            type="submit"
          >
            <PaperPlaneTiltIcon className="size-4" weight="fill" />
          </Button>
        </div>
      </div>
    </form>
  );
}
