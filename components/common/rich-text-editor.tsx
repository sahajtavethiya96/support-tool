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
import { SuggestionPluginKey } from "@tiptap/suggestion";
import type { ReactNode, Ref } from "react";
import { useEffect, useImperativeHandle, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isRichTextEmpty } from "@/lib/rich-text";
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

export interface RichTextEditorHandle {
  focus: () => void;
}

interface Props {
  /** When provided (agent replies only), shows a toolbar button to insert a saved reply template. */
  cannedResponses?: CannedResponseOption[];
  className?: string;
  /** Chat-style compact mode: shorter empty height, toolbar hidden until focused or non-empty. */
  compact?: boolean;
  disabled?: boolean;
  /** Called when the editor loses focus. */
  onBlur?: () => void;
  onChange: (json: string) => void;
  /** When provided, pasting or dropping files onto the editor hands them off here instead of inserting them into the document (there's no image extension — files become attachments, not embedded content). */
  onFilesDropped?: (files: File[]) => void;
  /** Called when the editor gains focus. */
  onFocus?: () => void;
  /** When provided, Enter sends (Shift+Enter still inserts a newline) — pass this on chat-style reply composers, not on template editors like canned responses. */
  onSubmit?: () => void;
  placeholder?: string;
  ref?: Ref<RichTextEditorHandle>;
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
          : "text-foreground hover:bg-accent"
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
  onOpenChange,
}: {
  editor: Editor;
  responses: CannedResponseOption[];
  /** Lifted to the parent editor so its compact-mode toolbar stays mounted
   * while this popover is open — otherwise, opening the popover moves DOM
   * focus onto its content (Radix's default auto-focus), which blurs the
   * Tiptap editor and — in compact mode with no text yet — collapses the
   * whole toolbar the popover lives in, closing it instantly. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState("");

  function setOpen(o: boolean) {
    setOpenState(o);
    onOpenChange?.(o);
  }

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
          className="flex size-7 items-center justify-center rounded text-foreground transition-colors hover:bg-accent"
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
  onCannedPickerOpenChange,
}: {
  editor: Editor;
  tone: "default" | "warning";
  cannedResponses?: CannedResponseOption[];
  onCannedPickerOpenChange?: (open: boolean) => void;
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
          <CannedResponsePicker
            editor={editor}
            onOpenChange={onCannedPickerOpenChange}
            responses={cannedResponses}
          />
        </>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  onFilesDropped,
  onBlur,
  onFocus,
  onSubmit,
  placeholder = "Write a reply…",
  disabled = false,
  tone = "default",
  compact = false,
  className,
  cannedResponses,
  ref,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cannedPickerOpen, setCannedPickerOpen] = useState(false);

  // Assigned right after useEditor() returns — referencing `editor` directly
  // in handleKeyDown below would be circular at the type level (TS7022).
  let currentEditor: Editor | null = null;

  const editor = useEditor({
    extensions: [
      ...baseRichTextExtensions(),
      Placeholder.configure({ placeholder }),
      SlashCommand,
    ],
    content: parseRichTextContent(value),
    // Without this, Toolbar's active-state highlighting lags a render behind.
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChange(JSON.stringify(editor.getJSON())),
    onFocus: () => {
      setFocused(true);
      onFocus?.();
    },
    onBlur: () => {
      setFocused(false);
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: cn(
          "tiptap-content focus:outline-none",
          compact
            ? "min-h-9 max-h-40 overflow-y-auto px-2 py-1.5"
            : "min-h-[96px] px-4 py-3"
        ),
      },
      handleKeyDown: (view, event) => {
        if (event.key !== "Enter" || event.isComposing) {
          return false;
        }
        // Plain Enter sends the message (below), so Shift+Enter stands in
        // for a normal editor's Enter here.
        if (event.shiftKey) {
          if (!onSubmit || !currentEditor) {
            return false;
          }
          if (currentEditor.isActive("listItem")) {
            const isEmptyItem =
              currentEditor.state.selection.$from.parent.content.size === 0;
            // No .focus() — already focused, and chaining it can make
            // .run() falsely return false, letting the default hard-break
            // binding also fire on top of this.
            return isEmptyItem
              ? currentEditor.commands.liftListItem("listItem")
              : currentEditor.commands.splitListItem("listItem");
          }
          // Mirrors Tiptap's own core "Enter" keymap fallback chain.
          return currentEditor.commands.first(({ commands }) => [
            () => commands.newlineInCode(),
            () => commands.createParagraphNear(),
            () => commands.liftEmptyBlock(),
            () => commands.splitBlock(),
          ]);
        }
        if (!onSubmit) {
          return false;
        }
        // Let the "/" command menu handle Enter (select item) while it's open.
        if (SuggestionPluginKey.getState(view.state)?.active) {
          return false;
        }
        onSubmit();
        return true;
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!onFilesDropped || files.length === 0) {
          return false;
        }
        event.preventDefault();
        onFilesDropped(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (!onFilesDropped || files.length === 0) {
          return false;
        }
        event.preventDefault();
        onFilesDropped(files);
        return true;
      },
    },
    immediatelyRender: false,
  });
  currentEditor = editor;

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus("end"),
    }),
    [editor]
  );

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
    // biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop file target, not an interactive control — the toolbar buttons and editable content inside remain independently keyboard-accessible
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: see above
    <div
      className={cn(
        "rounded-md border bg-card overflow-hidden transition-[color,border-color,box-shadow]",
        tone === "warning"
          ? "border-amber-200 bg-amber-50 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20"
          : "border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
        isDragOver && onFilesDropped && "ring-2 ring-primary border-primary",
        disabled && "opacity-60",
        className
      )}
      onDragLeave={() => setIsDragOver(false)}
      onDragOver={(e) => {
        if (onFilesDropped) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDrop={() => setIsDragOver(false)}
    >
      {(!compact || focused || cannedPickerOpen || !isRichTextEmpty(value)) && (
        <Toolbar
          cannedResponses={cannedResponses}
          editor={editor}
          onCannedPickerOpenChange={setCannedPickerOpen}
          tone={tone}
        />
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
