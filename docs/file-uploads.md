# File Uploads

## Overview

Customers and agents can attach files to tickets and comments. Files are stored via the driver-switched adapter in `lib/storage.ts` — local disk by default, or S3/Cloudflare R2 via [files-sdk](https://files-sdk.dev) when configured. See `STORAGE_DRIVER` below.

---

## Rules

| Rule | Value |
|------|-------|
| Allowed types | JPG, JPEG, PNG, PDF, ZIP, TXT |
| Max file size | 10 MB per file |
| Max attachments per ticket | 5 total (across the ticket itself + all comments) |
| Max attachments per comment | 5, subject to the ticket-level limit |

The 5-file limit is enforced at the ticket level, not per upload action. If a ticket already has 3 attachments, the next upload can only add 2 more.

---

## Validation

Validation is enforced **both client-side and server-side**. Client-side validation gives immediate feedback; server-side validation is the authoritative check.

### Allowed MIME Types

```
image/jpeg
image/png
application/pdf
application/zip
text/plain
```

### Checks (server-side)

1. File size ≤ 10 MB.
2. MIME type is in the allowed list (checked from `Content-Type` — not just file extension).
3. Total attachments on the ticket after this upload ≤ 5.
4. The customer token (or agent session) is valid for the ticket.

If any check fails, return `400` with a descriptive `{ error: string }`.

---

## Storage

Files are stored via the driver-switched adapter in `lib/storage.ts`. All
three drivers implement the same interface (`upload`, `download`, `delete`,
`url`) so nothing else in the app changes when you switch drivers.

### Storage Key Format

```
tickets/{ticketId}/{uuid}/{originalFilename}
```

Example: `tickets/cm3abc123/cm9xyz456/screenshot.png`

The `uuid` segment ensures no filename collisions if the same filename is uploaded multiple times.

### `STORAGE_DRIVER` — choosing a driver

Set via env var (see `.env.example`). Validated at boot in `lib/env.ts` — an
`s3`/`r2` driver missing its required config throws immediately on startup,
not on first upload attempt.

| `STORAGE_DRIVER` | Backend | Required env vars |
|---|---|---|
| `local` (default) | Local disk | none |
| `s3` | AWS S3, or any S3-compatible provider | `S3_BUCKET`, `S3_REGION` (+ AWS credentials — see below) |
| `r2` | Cloudflare R2 | `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` |

Optional for either cloud driver: `STORAGE_PUBLIC_BASE_URL` (a CDN/custom
domain bound to the bucket). Support Tool never needs it — see "Serving
files" below — it only matters if you also point other tooling at the
bucket directly.

#### `local` (local disk, default)

- Files stored in `./uploads/` at the project root — `/app/uploads` inside
  the Docker image (`Dockerfile` sets `WORKDIR /app`).
- **In Docker, this directory MUST be a persistent volume, or every
  redeploy wipes all uploaded files** (the container filesystem resets
  from the image each time). `docker-compose.yml` and
  `docker-compose.external-db.yml` already mount one — pinned to the
  literal name `support_tool_uploads` (not left to Compose's default
  `<project>_<volume>` auto-naming), because some deploy tools don't keep
  the compose project name stable across redeploys, which silently
  creates a fresh, empty volume each time and orphans the old one.
- If you deploy via a platform that generates its own Compose invocation
  (Dokploy, Coolify, etc.) rather than running `docker compose up -d`
  against these files directly, verify on the host that the SAME volume
  name is reused across deploys: `docker volume ls`, then
  `docker volume inspect support_tool_uploads` should show the same
  volume before and after a redeploy, with `Mountpoint` contents that
  persist.

#### `s3` / `r2` (cloud object storage)

- Implemented via [files-sdk](https://files-sdk.dev) (`files-sdk/s3` /
  `files-sdk/r2`), dynamically imported only when selected — the default
  `local` path never loads it, so there's no added cold-start cost for
  deployments that don't use it.
- S3 credentials come from the standard AWS credential chain
  (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars, an IAM role,
  or a shared profile) — not a Support Tool-specific variable.
- R2 credentials (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`) are read
  directly by the adapter under those exact names.
- Survives host loss and works across multiple app replicas — no volume
  to manage, unlike `local`.
- Any other S3-compatible provider (MinIO, DigitalOcean Spaces, Backblaze
  B2, Wasabi, …) also works through the `s3` driver by pointing it at a
  custom endpoint — see [files-sdk's S3 adapter docs](https://files-sdk.dev/adapters/s3)
  if you need that; `lib/storage.ts` would need one extra option passed
  through (`endpoint`) to expose it — not wired up today since no request
  for it yet.

### Serving files

Regardless of driver, `storage.url(key)` always returns
`/api/files/{key}` — never a direct or signed cloud URL. `GET
/api/files/[...key]` calls `storage.download()` under the hood (works
identically for every driver) and streams the bytes back. This is
deliberate, not a limitation:

- Keeps `storage.url()` **synchronous** — callers build it inline in
  `.map()` (e.g. `items.map(a => ({ url: storage.url(a.storageKey) }))`)
  without awaiting per attachment.
- Keeps ticket-attachment access control in Support Tool's own route
  rather than handing out cloud URLs (signed or public) directly.

### DB Storage

- The `ticket_attachments` table stores the **storage key**, never a full URL.
- Serving URLs are generated on demand via `storage.url(key)` — see above.
- Never persist URLs in the database.

---

## Upload Flow

### Customer Upload (during ticket creation)

1. Customer selects files in the create ticket form.
2. Files are uploaded via `POST /api/tickets/{id}/attachments` immediately on form submit (multipart/form-data).
3. Server validates and stores each file, returns `storageKey`.
4. `ticket_attachments` records are created.

### Agent/Customer Upload (on comment)

1. Files are selected in the reply form.
2. Submitted as multipart/form-data alongside the comment content.
3. Server creates the comment first, then creates attachment records linked to `commentId`.

---

## Deletion

When an attachment is deleted (admin action):

1. `storage.delete(storageKey)` is called first.
2. If storage delete fails: log the error but proceed (orphaned storage files are acceptable — unrecoverable attachments are worse).
3. `ticket_attachments` record is deleted from DB.

When a ticket is deleted (admin spam deletion):

1. Fetch all `ticket_attachments.storageKey` for the ticket.
2. Delete each file from storage.
3. Then delete all DB records (cascade handles tickets → comments → attachments).

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/tickets/{id}/attachments` | Customer (token) or Agent | Upload attachment(s) |
| GET | `/api/files/[...key]` | Public | Serve file from storage |
| DELETE | `/api/tickets/{id}/attachments/{attachmentId}` | Agent/Admin | Delete attachment |

---

## UI Notes

- The file input uses shadcn `Button` styled as a file picker — not a native `<input type="file">` left unstyled.
- Show a file list below the picker with: filename, file size (human-readable), a remove button.
- Show a progress indicator during upload.
- Show clear error messages for each failure type:
  - "File too large. Maximum size is 10 MB."
  - "File type not allowed. Accepted types: JPG, PNG, PDF, ZIP, TXT."
  - "Maximum 5 attachments per ticket."
- Allowed types and size limit are shown as helper text below the file picker (always visible, not only on error).
