# Plan: Canned / saved replies (macros)

Not previously documented — a new feature area. Agents type the same
answers repeatedly ("Please share a screenshot", "Thanks, we're on it").
Canned responses let them save a reply once and insert it into any ticket
with two clicks.

## Goal

Any agent/admin can save, search, and insert reusable rich-text reply
templates from the reply editor's toolbar — on **agent replies only**, not
internal notes' distinct meaning changes nothing, and not the customer
reply form.

## Scope decisions (defaults — flag if you want different)

- **Who can manage them:** any agent or admin (team-shared, flat list — no
  personal/private responses, no folders/categories for v1). Matches how
  the rest of this tool treats agents as one trusted team, and keeps the
  schema simple. If you'd rather restrict creation/editing to admins only
  (like statuses/categories), say so — it's a one-line auth check change.
- **Where content is authored:** using the same `RichTextEditor` /
  Tiptap-JSON format as ticket replies (`ticketComments.content`) — so a
  saved response is literally reusable comment content, no format
  conversion needed at insert time.
- **Insert behavior:** inserts at the cursor in the reply editor (doesn't
  replace what the agent already typed) — lets an agent type a quick
  lead-in, then insert a canned block below it.

## Schema

`db/schema/canned-responses.ts`:

```ts
export const cannedResponses = pgTable(
  "canned_responses",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(), // Tiptap JSON — same shape as ticketComments.content
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    createdByName: text("created_by_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("canned_responses_title_idx").on(t.title),
  ]
);
```

No `isShared`/`isPrivate` flag per the scope decision above — everything is
team-visible. Add one later if personal drafts turn out to matter.

## API — `app/api/canned-responses/`

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/canned-responses` | agent/admin | list all, optional `?q=` title search |
| POST | `/api/canned-responses` | agent/admin | `{ title, content }` |
| PATCH | `/api/canned-responses/{id}` | agent/admin | `{ title?, content? }` — any agent can edit any response per the scope decision |
| DELETE | `/api/canned-responses/{id}` | agent/admin | |

Validation: `title` 2–100 chars, `content` non-empty (reuse
`isRichTextEmpty()` from `lib/rich-text.ts`). No activity-log entry needed
(not ticket-scoped); a lightweight `audit()` call on delete is enough
(`action: "canned_response.deleted"`) since it's a shared team resource
someone might want to trace.

## UI

### 1. Management page

`app/(agent)/canned-responses/page.tsx` — **not** under `/admin`, since any
agent manages these. Add a sidebar nav item in
`components/agent/sidebar.tsx` (top-level `navItems`, not the admin-only
section) — icon suggestion: `ChatTextIcon` or `NotepadIcon`.

Structure mirrors `app/(admin)/admin/ticket-config/_components/statuses-manager.tsx`:
- List of existing responses (title + truncated preview + updated date +
  edit/delete icon buttons), card list with `shadow-soft` styling matching
  the rest of the app.
- "Add" button → `Dialog` with a `Label`, `Input` for title, and the shared
  `RichTextEditor` for content (same component used for replies — gives
  agents the full toolbar + `/` slash menu for formatting the template).
- Edit → same dialog, pre-filled.
- Delete → `Dialog` confirmation (per `CLAUDE.md` — never `window.confirm()`).

### 2. Insert picker in the reply editor

Extend `components/common/rich-text-editor.tsx`'s `Toolbar`:
- New optional prop on `RichTextEditor`: `cannedResponses?: { id: string; title: string; content: string }[]`.
- When provided (and non-empty), render one more `ToolbarButton` at the end
  of the toolbar (after the existing divider) — icon `ChatTextIcon`, title
  "Insert canned response".
- Clicking it opens a small `Popover` (same primitive used by
  `SearchableSelect`) with a search input + filtered list of titles —
  visually reuse the `SlashList` card styling from
  `components/common/slash-command.tsx` (bordered popover, `bg-popover`,
  hover row highlight) for consistency, but this is a plain click-driven
  Popover, not a `/`-triggered Suggestion — no need to touch the Tiptap
  extension itself.
- Selecting an item: parse its `content` (Tiptap JSON), then
  `editor.chain().focus().insertContent(parsedDoc.content).run()` —
  **insert the parsed document's `content` array**, not the whole `doc`
  node, since `insertContent` expects a content fragment, not another
  top-level document. (This is the one implementation detail worth calling
  out up front — easy to get wrong.)

### 3. Wiring

- `app/(agent)/tickets/[ticketId]/_components/agent-reply-form.tsx`:
  fetch canned responses once on mount (or receive as a prop from the
  server-rendered parent page, cheaper — the ticket detail page already
  does several `Promise.all` fetches, add `getCannedResponses()` there and
  pass down), pass to `<RichTextEditor cannedResponses={...} />`.
- `app/(customer)/ticket/[ticketId]/reply-form.tsx`: **do not** pass the
  prop — customers never see this button.

## Task checklist

- [ ] `db/schema/canned-responses.ts` + export from `db/schema/index.ts`
- [ ] `pnpm db:generate` + review + `pnpm db:migrate`
- [ ] `app/api/canned-responses/route.ts` (GET/POST) +
      `app/api/canned-responses/[id]/route.ts` (PATCH/DELETE)
- [ ] `app/(agent)/canned-responses/page.tsx` + manager component
- [ ] Sidebar nav item
- [ ] `RichTextEditor` — optional `cannedResponses` prop + picker Popover
- [ ] Wire into `agent-reply-form.tsx` only
- [ ] Manual test: create a canned response with a bullet list + bold text,
      insert it into a ticket reply, confirm formatting round-trips
      correctly in the sent comment

## Out of scope

- Variables/placeholders (e.g. `{{customer_name}}` auto-fill) — clean v2
  addition once the base feature exists.
- Per-agent private responses, folders/categories, usage analytics.
- Keyboard-shortcut / `/`-triggered insertion (mouse-driven picker only for v1).
