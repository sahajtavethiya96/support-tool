"use client";

import {
  ChatCircleIcon,
  LockSimpleIcon,
  PaperclipIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/components/common/rich-text-editor";
import { Button } from "@/components/ui/button";
import { isRichTextEmpty } from "@/lib/rich-text";

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
    } catch {
      setError("Network error. Please try again.");
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit} ref={formRef}>
      {/* Toggle: Reply / Internal Note */}
      <div className="flex gap-1 p-1 bg-accent rounded-lg border border-border w-fit">
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            isInternal
              ? "text-muted-foreground hover:text-foreground"
              : "bg-card text-foreground shadow-sm border border-border"
          }`}
          onClick={() => setIsInternal(false)}
          type="button"
        >
          <ChatCircleIcon className="size-3.5" />
          Reply to Customer
        </button>
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            isInternal
              ? "bg-amber-100 text-amber-800 shadow-sm border border-amber-200"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setIsInternal(true)}
          type="button"
        >
          <LockSimpleIcon className="size-3.5" />
          Internal Note
        </button>
      </div>

      <RichTextEditor
        cannedResponses={cannedResponses}
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

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              className="flex items-center gap-2 rounded-md bg-accent border border-border px-3 py-2 text-xs"
              key={i}
            >
              <PaperclipIcon className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-foreground truncate flex-1">{f.name}</span>
              <span className="text-muted-foreground shrink-0">
                {(f.size / 1024).toFixed(0)} KB
              </span>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => removeFile(i)}
                type="button"
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        {maxNewFiles > 0 ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            <PaperclipIcon className="size-3.5" />
            Attach file
            <input
              accept=".jpg,.jpeg,.png,.pdf,.zip,.txt"
              className="hidden"
              disabled={submitting}
              multiple
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
          </label>
        ) : (
          <span className="text-xs text-muted-foreground">
            Attachment limit reached
          </span>
        )}

        <Button
          className={
            isInternal
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          }
          disabled={submitting || isRichTextEmpty(content)}
          type="submit"
        >
          {submitting ? "Sending…" : isInternal ? "Add Note" : "Send Reply"}
        </Button>
      </div>
    </form>
  );
}
