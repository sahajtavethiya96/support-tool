# Support Tool — Claude Code Context

## What this project is

Support Tool is an open-source, self-hosted customer support ticketing system. Teams deploy it to handle support tickets from customers. Inspired by tools like Freshdesk and Crisp — but fully self-hosted.

Full feature specs live in `docs/`. Read the relevant doc before implementing any feature.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Auth | Better Auth (Admin Plugin + Email/Password + Magic Link + Google OAuth) |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui |
| Icons | Phosphor Icons (`@phosphor-icons/react`) |
| IDs | cuid2 (`@paralleldrive/cuid2`) |
| State | SWR (server) — no Zustand needed |
| Background Jobs | pg-boss |
| Email | Nodemailer (SMTP) via pg-boss queue + react-email templates |
| File Storage | files-sdk (local `fs` adapter in dev → S3/R2/GCS in prod) |

---

## Project Structure

```
app/
├── (auth)/                ← login for agents/admins (unauthenticated layout)
├── (orbit)/               ← platform admin panel (Better Auth Orbit)
├── (customer)/            ← customer portal (no login — token-gated)
├── (agent)/               ← agent + admin portal (authenticated)
├── (admin)/               ← admin-only pages (authenticated, admin role)
└── api/                   ← API route handlers
components/
├── ui/                    ← shadcn/ui primitives
└── common/                ← shared app components
config/
├── platform.ts            ← PRODUCT_NAME and other platform constants
db/
├── schema/                ← Drizzle table definitions (one file per domain)
└── migrations/            ← generated SQL migrations
docs/                      ← feature specs (read before implementing)
lib/
├── auth.ts                ← Better Auth server instance
├── auth-client.ts         ← Better Auth client
├── db.ts                  ← Drizzle client singleton
├── storage.ts             ← files-sdk adapter (local → S3/R2/GCS)
├── email/                 ← email templates + enqueue helper
├── worker/                ← pg-boss queue handlers
└── utils.ts               ← shared utilities
scripts/
├── make-admin.ts          ← promote a user to admin
└── worker.ts              ← worker entry point
```

---

## Key Decisions & Conventions

### Auth — Two Separate Flows

There are two completely separate auth flows in this app:

1. **Agents and Admins** — full Better Auth session via email/password, magic link, or Google OAuth (if configured). Each method is admin-toggleable at runtime (`/admin/appearance`, `platform_settings` table) and enforced server-side in `lib/auth.ts`'s `hooks.before`. Access `/login`. Role stored in `user.role`.
2. **Customers** — no account required. They submit a ticket with name + email. Access their tickets via a secure link emailed to them. No session, no password.

Never redirect customers to the agent login page and vice versa.

### Color System

The entire UI uses 4 brand colors (`bark`, `sand`, `stone`, `cream`) as Tailwind v4 utility classes. They are runtime-overridable via `ThemeProvider` — **do not hardcode hex values anywhere**.

**How it works:**

```css
/* app/globals.css */
@theme inline {
  --color-cream: var(--brand-cream);  /* Tailwind utility points to runtime var */
  --color-sand:  var(--brand-sand);
  --color-stone: var(--brand-stone);
  --color-bark:  var(--brand-bark);
}

:root {
  --brand-cream: #BDDDFC;  /* default palette — ThemeProvider overwrites these */
  --brand-sand:  #88BDF2;
  --brand-stone: #6A89A7;
  --brand-bark:  #384959;
}
```

- `bark` on white = ~8:1 contrast (AAA) — use for all primary text and labels.
- `stone` on cream = ~3:1 — use only for captions and timestamps (never body text or labels).
- Never use semantic colors (red, amber, blue) for layout — only for status badges and errors.

#### Dark mode: use semantic tokens in the agent/admin UI

Dark mode applies **only to the agent + admin portals** (the customer portal has no `ThemeProvider` and is always light). The raw brand utilities (`bg-cream`, `text-bark`, `bg-white`, `bg-bark`) are **static — they do NOT flip in dark mode**. So in the agent/admin UI (and any shared component used there), build surfaces from **semantic shadcn tokens**, which are defined for both modes and equal the brand colors in light:

| Instead of (static) | Use (adapts to dark) |
|---|---|
| `bg-white` | `bg-card` |
| `bg-cream` | `bg-accent` |
| `text-bark` | `text-foreground` |
| `text-stone` | `text-muted-foreground` |
| `border-sand` | `border-border` |
| `bg-bark` / `text-cream` (buttons, avatars) | `bg-primary` / `text-primary-foreground` |
| `ring-bark` | `ring-ring` |
| sidebar chrome | `bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-accent`, `border-sidebar-border`, `border-sidebar-primary` |

- The **customer portal** (`app/(customer)/`) still uses the brand utilities directly — it's light-only, so that's fine.
- **Dark palette** lives in the `.dark` block of `app/globals.css` (3-layer surfaces: `--sidebar` darkest < `--surface`/`--background` < `--card`; brand accent kept, not grayscaled). Per-preset accent overrides live in `DARK_THEME_VARS` in `theme-provider.tsx`.
- Because light-mode semantic tokens already equal the brand palette, converting a brand utility to its semantic token leaves light mode visually unchanged.

### Theme System

Admins can change the platform color theme and appearance mode (light/dark/auto) from `/admin/appearance`. The selection is persisted to the `platform_settings` DB table and applied at runtime — no CSS recompilation needed.

- **`components/theme/theme-provider.tsx`** — `ThemeProvider` context wraps both `(agent)` and `(admin)` layouts. On mount it reads `localStorage` for instant hydration, then the server-rendered initial props take over. `applyThemeToDOM()` writes `--brand-*` vars + shadcn tokens (`--primary`, `--sidebar`, etc.) to `document.documentElement.style`.
- **`lib/settings.ts`** — `getPlatformSettings()` reads the single `platform_settings` row (id `"default"`).
- **`app/api/admin/settings/route.ts`** — `GET` (any agent/admin) + `PATCH` (admin only) for theme + appearanceMode.
- **6 presets:** `default`, `ocean`, `forest`, `sunset`, `indigo`, `slate` — each defines both light and dark variant CSS vars.
- **localStorage keys:** `support_tool_theme`, `support_tool_appearance` — cached for instant re-hydration without a DB round-trip.
- **Pattern for new themes:** add a new preset object to `LIGHT_THEME_VARS` and `DARK_THEME_VARS` in `theme-provider.tsx`, then add it to the swatch list in `appearance-settings-form.tsx`.

### UI Components

- **Always use shadcn/ui components** — never build custom UI primitives.
- If a shadcn component is not installed, add it with `npx shadcn@latest add <component>`.
- Custom components are only acceptable for app-specific composite UI that has no shadcn equivalent.
- **Icons:** use `@phosphor-icons/react` — not Lucide, not Heroicons.

### Rich Text (Descriptions & Replies)

Ticket **descriptions** (submit form) and **replies** (both customer and agent) use a shared **Tiptap** editor — not a plain `Textarea`.

- **Compose:** `components/common/rich-text-editor.tsx` — editable editor + brand-themed toolbar (bold, italic, underline, strike, inline code, bullet/numbered lists, code block, quote). Pass `tone="warning"` for agent internal notes. Pasted URLs auto-link.
- **Display:** `components/common/rich-text-content.tsx` — renders content **read-only through Tiptap** (`editable: false`). Never render description/reply content as raw HTML — this keeps it XSS-safe by construction, so no sanitizer is needed.
- **Shared config:** `components/common/rich-text-extensions.ts` — one extension set for both, so compose and display always match.
- **Storage:** `tickets.description` and reply `content` (`ticketComments.content`) are both stored as **Tiptap JSON**. Legacy rows may be plain text — every reader tolerates both.
- **Previews/emails/notifications/push:** never send raw JSON to a text context. Flatten with `richTextToPlainText()` from `lib/rich-text.ts`; validate emptiness with `isRichTextEmpty()`.
- **Styling:** rendered rich text uses the scoped `.tiptap-content` styles in `app/globals.css` (brand-aligned) — there is no `@tailwindcss/typography` plugin.
- **Public API:** `POST /api/v1/tickets` accepts `description` as plain text (default) or HTML (`descriptionFormat: "html"`), converted server-side to Tiptap JSON via `textToRichTextJson()`/`htmlToRichTextJson()` in `lib/rich-text.ts` — external callers never need to speak Tiptap's JSON shape directly.

### IDs

- All entity IDs use **cuid2** via `createId()` from `@paralleldrive/cuid2`.
- Never use `crypto.randomUUID()` or `Math.random()`.

### Confirmation Dialogs

- **Never use `window.confirm()`** — always use a shadcn `Dialog` with Cancel + destructive action buttons.
- Standard layout: centered icon in a colored circle, bold title, muted description, full-width Cancel + action buttons.

### UI Consistency

- **Border radius:** Cards, modals, dialogs, popovers → `rounded-xl`. Buttons → `rounded-md`. Inputs → `rounded-md`.
- **Spacing:** Consistent `p-6` inside cards. Section gaps use `space-y-6`.
- Before shipping UI, verify every interactive element has correct border radius, hover states, and focus rings.

### File Storage

- File storage is via **files-sdk** (`lib/storage.ts`) — unified adapter layer.
- **Local dev:** `fs` adapter stores files in `./uploads/` and serves them via `/api/files/[...key]`.
- **Production:** swap to S3/R2/GCS by setting `STORAGE_DRIVER` env var — no app code changes.
- DB stores the **storage key** (e.g. `tickets/{ticketId}/{uuid}/{filename}`) — never a full URL.
- Always delete the storage file before deleting the DB record.
- Generate serving URLs on demand via `storage.url(key)` — never persist URLs.

### Database

- Drizzle ORM. Schema files in `db/schema/`, migrations in `db/migrations/`.
- All IDs are cuid2 strings.
- All tables have `createdAt` and `updatedAt`.
- Hard deletes are immediate (no soft deletes in MVP).

### API

- REST API under `/api/`.
- Always return `{ error: string }` on failure with the correct HTTP status.
- Never expose internal error messages to the client.
- All agent/admin API routes check session first, return 401 if missing.
- Customer-facing API routes verify ticket access tokens instead of sessions.

### Routing

- Customer portal: `/(customer)/` — no auth guard, token-based ticket access
- Agent portal: `/(agent)/` — requires session with `role: agent` or `role: admin`
- Admin pages: `/(admin)/` — requires session with `role: admin`

---

## Feature Docs (read before implementing)

| Feature | Doc |
|---------|-----|
| Authentication | `docs/authentication.md` |
| Customer Portal | `docs/customer-portal.md` |
| Agent Portal | `docs/agent-portal.md` |
| Admin Portal | `docs/admin-portal.md` |
| Tickets | `docs/tickets.md` |
| Public API | `docs/api.md` |
| File Uploads | `docs/file-uploads.md` |
| Email Notifications | `docs/email-notifications.md` |
| Permission Model | `docs/permission-model.md` |
| Dashboard | `docs/dashboard.md` |
| Database Schema | `docs/database-schema.md` |
| Design System | `docs/design-system.md` |
| Development Plan | `docs/development-plan.md` |
| Commands | `docs/commands.md` |

---

## Development Plan

Phases are in `docs/development-plan.md`. Work through them in order. Do not skip phases.
