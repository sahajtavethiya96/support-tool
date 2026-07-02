"use client";

import {
  ChatTextIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RichTextEditor } from "@/components/common/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CannedResponse } from "@/lib/canned-responses";
import { isRichTextEmpty, richTextToPlainText } from "@/lib/rich-text";

interface Props {
  initialResponses: CannedResponse[];
}

type FormState = {
  title: string;
  content: string;
};

const EMPTY_FORM: FormState = { title: "", content: "" };

export function CannedResponsesManager({ initialResponses }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CannedResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CannedResponse | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setForm(EMPTY_FORM);
    setError(null);
    setAddOpen(true);
  }

  function openEdit(response: CannedResponse) {
    setForm({ title: response.title, content: response.content });
    setError(null);
    setEditTarget(response);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const isEdit = editTarget !== null;
      const url = isEdit
        ? `/api/canned-responses/${editTarget.id}`
        : "/api/canned-responses";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        return;
      }
      setAddOpen(false);
      setEditTarget(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/canned-responses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to delete.");
        setDeleting(false);
        return;
      }
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ChatTextIcon className="size-5" />
            Canned Responses
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reusable reply templates any agent can insert into a ticket reply.
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md gap-1.5"
          onClick={openAdd}
          size="sm"
        >
          <PlusIcon className="size-4" />
          Add Response
        </Button>
      </div>

      {initialResponses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <ChatTextIcon className="size-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">
            No canned responses yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add one to reuse it from the reply editor's toolbar.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {initialResponses.map((r) => (
            <div className="flex items-start gap-3 py-3" key={r.id}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {richTextToPlainText(r.content) || "—"}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  className="h-8 border-border text-foreground hover:bg-accent rounded-md"
                  onClick={() => openEdit(r)}
                  size="sm"
                  variant="outline"
                >
                  <PencilSimpleIcon className="size-3.5" />
                </Button>
                <Button
                  className="h-8 border-red-200 text-red-600 hover:bg-red-50 rounded-md"
                  onClick={() => {
                    setError(null);
                    setDeleteTarget(r);
                  }}
                  size="sm"
                  variant="outline"
                >
                  <TrashIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false);
            setEditTarget(null);
          }
        }}
        open={addOpen || editTarget !== null}
      >
        <DialogContent className="rounded-xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editTarget ? "Edit Response" : "Add Response"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editTarget
                ? "Update the title or content."
                : "Create a reusable reply template."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Title
              </Label>
              <Input
                className="rounded-md"
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Password reset steps"
                value={form.title}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Content
              </Label>
              <RichTextEditor
                onChange={(content) => setForm((f) => ({ ...f, content }))}
                placeholder="Write the reply template…"
                value={form.content}
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button
              className="flex-1 border-border text-foreground rounded-md"
              disabled={saving}
              onClick={() => {
                setAddOpen(false);
                setEditTarget(null);
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
              disabled={
                saving || !form.title.trim() || isRichTextEmpty(form.content)
              }
              onClick={handleSave}
            >
              {saving
                ? "Saving…"
                : editTarget
                  ? "Save Changes"
                  : "Add Response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        open={deleteTarget !== null}
      >
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-red-100">
              <TrashIcon className="size-5 text-red-600" />
            </div>
            <DialogTitle className="text-foreground text-center">
              Delete &ldquo;{deleteTarget?.title}&rdquo;?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-center">
              This canned response will be permanently removed for the whole
              team.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-xs text-red-600 text-center">{error}</p>}
          <DialogFooter className="gap-2">
            <Button
              className="flex-1 border-border text-foreground rounded-md"
              disabled={deleting}
              onClick={() => {
                setDeleteTarget(null);
                setError(null);
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-md"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
