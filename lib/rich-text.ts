// Helpers for working with reply content stored as Tiptap JSON.
//
// Replies (customer + agent) are stored as a serialized Tiptap document so they
// can carry basic formatting. Older comments were plain text — every helper here
// gracefully falls back to treating a non-JSON string as plain text.

import { generateHTML, generateJSON } from "@tiptap/html";
import { baseRichTextExtensions } from "@/components/common/rich-text-extensions";

interface TiptapNode {
  content?: TiptapNode[];
  text?: string;
  type?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseDoc(content: string): TiptapNode | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as TiptapNode;
  } catch {
    return null;
  }
}

function collectText(node: TiptapNode, out: string[]): void {
  if (node.text) {
    out.push(node.text);
  }
  if (node.content) {
    for (const child of node.content) {
      collectText(child, out);
    }
  }
  // Block-level nodes imply a line break between them.
  if (
    node.type &&
    ["paragraph", "heading", "listItem", "blockquote"].includes(node.type)
  ) {
    out.push("\n");
  }
}

/**
 * Flatten reply content to plain text for previews, emails, notifications, and
 * push bodies. Accepts Tiptap JSON or a legacy plain-text string.
 */
export function richTextToPlainText(content: string): string {
  const doc = parseDoc(content);
  if (!doc) {
    return content;
  }
  const parts: string[] = [];
  collectText(doc, parts);
  return parts
    .join("")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** True when the reply has no visible text (empty Tiptap doc or blank string). */
export function isRichTextEmpty(content: string): boolean {
  return richTextToPlainText(content).trim().length === 0;
}

/**
 * Renders reply content as sanitized HTML, for contexts that want formatting
 * (bold, lists, links) rather than a plain-text flatten — currently just the
 * public API's comments endpoint. Safe because the source is always OUR OWN
 * stored Tiptap document: `generateHTML` renders strictly through the same
 * schema the editor writes with (baseRichTextExtensions), so only whitelisted
 * tags can ever come out — this is not passing arbitrary/external HTML
 * through, which is why the app avoids `dangerouslySetInnerHTML` everywhere
 * else. Legacy plain-text rows are escaped and wrapped in a <p>.
 */
export function richTextToHtml(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) {
    try {
      const doc = JSON.parse(trimmed);
      return generateHTML(doc, baseRichTextExtensions());
    } catch {
      // fall through to plain-text handling below
    }
  }
  return `<p>${escapeHtml(content).replace(/\n/g, "<br>")}</p>`;
}

/**
 * Wraps plain text into a minimal Tiptap document (one paragraph per line),
 * serialized the same way the editor itself stores content. Used wherever
 * "plain text in" needs to become a proper stored document — the customer
 * portal's plain-text ticket description field is going away in favor of the
 * same rich editor replies use, and the public API accepts plain text as one
 * of its input formats (see htmlToRichTextJson for the other).
 */
export function textToRichTextJson(text: string): string {
  const lines = text.split(/\r\n|\r|\n/);
  return JSON.stringify({
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  });
}

/**
 * Converts an HTML string into a Tiptap document, serialized the same way
 * the editor stores content. Safe to call on *external* HTML (unlike
 * richTextToHtml's direction) because `generateJSON` parses strictly through
 * our own schema (baseRichTextExtensions) — any tag/attribute the schema
 * doesn't recognize (scripts, event handlers, unknown elements) is simply
 * dropped, not stored. This is the one place in the app that's allowed to
 * accept external HTML, precisely because it never trusts it as-is.
 */
export function htmlToRichTextJson(html: string): string {
  return JSON.stringify(generateJSON(html, baseRichTextExtensions()));
}
