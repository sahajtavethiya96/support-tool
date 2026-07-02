"use client";

import {
  ChatTextIcon,
  CodeBlockIcon,
  CodeIcon,
  ListBulletsIcon,
  ListNumbersIcon,
  MagnifyingGlassIcon,
  QuotesIcon,
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from "@phosphor-icons/react";
import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  baseRichTextExtensions,
  parseRichTextContent,
} from "./rich-text-extensions";
import { SlashCommand } from "./slash-command";

export interface CannedResponseOption {
  content: string;
  id: string;
  title: string;
}

interface Props {
  /** When provided (agent replies only), shows a toolbar button to insert a saved reply template. */
  cannedResponses?: CannedResponseOption[];
  className?: string;
  disabled?: boolean;
  onChange: (json: string) => void;
  placeholder?: string;
  /** Visual accent — "warning" tints the frame amber (agent internal notes). */
  tone?: "default" | "warning";
  value: string;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      className={cn(
        "flex size-7 items-center justify-center rounded transition-colors disabled:opacity-40",
        active
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function insertCannedResponse(editor: Editor, contentJson: string) {
  const parsed = parseRichTextContent(contentJson);
  if (typeof parsed === "string") {
    editor.chain().focus().insertContent(parsed).run();
    return;
  }
  const doc = parsed as { content?: unknown[] };
  editor
    .chain()
    .focus()
    .insertContent(doc.content ?? [])
    .run();
}

function CannedResponsePicker({
  editor,
  responses,
}: {
  editor: Editor;
  responses: CannedResponseOption[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? responses.filter((r) => r.title.toLowerCase().includes(q))
      : responses;
  }, [responses, query]);

  return (
    <Popover
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setQuery("");
        }
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <button
          className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onMouseDown={(e) => e.preventDefault()}
          title="Insert canned response"
          type="button"
        >
          <ChatTextIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center gap-2 border-b border-border px-2.5">
          <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search responses…"
            value={query}
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No canned responses
            </p>
          ) : (
            filtered.map((r) => (
              <button
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent"
                key={r.id}
                onClick={() => {
                  insertCannedResponse(editor, r.content);
                  setOpen(false);
                  setQuery("");
                }}
                type="button"
              >
                {r.title}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Toolbar({
  editor,
  tone,
  cannedResponses,
}: {
  editor: Editor;
  tone: "default" | "warning";
  cannedResponses?: CannedResponseOption[];
}) {
  const divider = (
    <div
      className={cn(
        "mx-1 h-4 w-px shrink-0",
        tone === "warning" ? "bg-amber-200" : "bg-muted"
      )}
    />
  );
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5",
        tone === "warning" ? "border-amber-200" : "border-border"
      )}
    >
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (Ctrl+B)"
      >
        <TextBIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (Ctrl+I)"
      >
        <TextItalicIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (Ctrl+U)"
      >
        <TextUnderlineIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <TextStrikethroughIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        <CodeIcon className="size-4" />
      </ToolbarButton>
      {divider}
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <ListBulletsIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        <ListNumbersIcon className="size-4" />
      </ToolbarButton>
      {divider}
      <ToolbarButton
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code block"
      >
        <CodeBlockIcon className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
      >
        <QuotesIcon className="size-4" />
      </ToolbarButton>
      {cannedResponses && cannedResponses.length > 0 && (
        <>
          {divider}
          <CannedResponsePicker editor={editor} responses={cannedResponses} />
        </>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write a reply…",
  disabled = false,
  tone = "default",
  className,
  cannedResponses,
}: Props) {
  const editor = useEditor({
    extensions: [
      ...baseRichTextExtensions(),
      Placeholder.configure({ placeholder }),
      SlashCommand,
    ],
    content: parseRichTextContent(value),
    onUpdate: ({ editor }) => onChange(JSON.stringify(editor.getJSON())),
    editorProps: {
      attributes: {
        class: "tiptap-content focus:outline-none min-h-[96px] px-4 py-3",
      },
    },
    immediatelyRender: false,
  });

  // Reflect external resets (e.g. parent clears the field after a successful send).
  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }
    const current = JSON.stringify(editor.getJSON());
    if (value === "" && !editor.isEmpty) {
      editor.commands.clearContent(false);
    } else if (value && value !== current) {
      editor.commands.setContent(parseRichTextContent(value), {
        emitUpdate: false,
      });
    }
  }, [value, editor]);

  // Keep the editor's editable state in sync with `disabled`.
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-md border bg-card overflow-hidden focus-within:ring-1 transition-colors",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 focus-within:border-amber-400 focus-within:ring-amber-400"
          : "border-input focus-within:border-primary focus-within:ring-ring",
        disabled && "opacity-60",
        className
      )}
    >
      <Toolbar cannedResponses={cannedResponses} editor={editor} tone={tone} />
      <EditorContent editor={editor} />
    </div>
  );
}
