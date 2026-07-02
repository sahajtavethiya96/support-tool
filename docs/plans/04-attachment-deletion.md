# Plan: Attachment deletion

**Already fully spec'd** in `docs/file-uploads.md`:
- Route: `DELETE /api/tickets/{id}/attachments/{attachmentId}` — Agent/Admin only.
- Deletion order: `storage.delete(storageKey)` first, then delete the DB row
  (log-and-proceed if storage delete fails — "orphaned storage files are
  acceptable — unrecoverable attachments are worse").

This plan is the smallest of the batch — no schema change, the API contract
is already written, only the route + a UI affordance are missing.

## Goal

An agent/admin can remove a single attachment (ticket-level or on a
specific comment) from the ticket detail page. Customers **cannot** delete
attachments (not in scope per the doc — agent/admin only).

## API

`app/api/tickets/[id]/attachments/[attachmentId]/route.ts`:

```ts
export async function DELETE(request, { params }) {
  const session = await requireAgentSession(request); // mirror pattern in app/api/tickets/[id]/route.ts
  if (!session) return 401;

  const { id: ticketId, attachmentId } = await params;

  const [attachment] = await db.select().from(ticketAttachments)
    .where(and(eq(ticketAttachments.id, attachmentId), eq(ticketAttachments.ticketId, ticketId)))
    .limit(1);
  if (!attachment) return 404;

  await storage.delete(attachment.storageKey).catch((err) => {
    console.error("[attachment delete] storage cleanup failed", err);
    // proceed anyway — per docs/file-uploads.md
  });

  await db.delete(ticketAttachments).where(eq(ticketAttachments.id, attachmentId));

  await db.insert(ticketActivity).values({
    id: createId(),
    ticketId,
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email,
    actorRole: session.user.role,
    action: "attachment_deleted",
    metadata: { filename: attachment.filename },
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}
```

New `ticketActivity.action` value: `"attachment_deleted"` — add its label to
whatever switch/map renders activity entries in the ticket sidebar
(currently in `app/(agent)/tickets/[ticketId]/_components/ticket-info-sidebar.tsx`,
look for `ACTION_LABELS`).

## UI

`components/common/ticket-attachments.tsx` is shared between the agent and
customer ticket pages. Add an optional prop:

```ts
interface Props {
  items: AttachmentItem[];
  className?: string;
  onDelete?: (attachmentId: string) => void; // only passed on the agent page
}
```

- Image thumbnails: small ✕ overlay in the top-right corner of the
  thumbnail (visible on hover, like the existing expand-icon overlay),
  calls `onDelete`.
- File cards: a trash icon button next to the download icon.
- Confirm via the existing `Lightbox`-adjacent pattern is overkill for a
  single attachment — use a lightweight inline confirm (e.g. the icon
  becomes a "confirm?" state for 3 seconds, or a tiny popover) rather than
  a full modal Dialog, since this is a low-stakes, easily-avoidable action
  and a full-screen dialog for every attachment removal is heavy UX. If you'd
  rather match the "always use a Dialog" convention strictly for
  consistency, use the shadcn `Dialog` instead — flag your preference.
- On the **agent** ticket detail page only, pass `onDelete` that calls the
  new `DELETE` route then `router.refresh()`. The **customer** page never
  passes `onDelete`, so the component renders exactly as it does today
  there — no behavior change for customers.

## Task checklist

- [ ] `app/api/tickets/[id]/attachments/[attachmentId]/route.ts` — `DELETE`
- [ ] Add `"attachment_deleted"` to the activity label map
- [ ] `TicketAttachments` — optional `onDelete` prop + delete affordance
- [ ] Wire `onDelete` only in `app/(agent)/tickets/[ticketId]/page.tsx`
- [ ] Manual test: delete an image attachment, confirm the file is gone
      from `./uploads/tickets/{id}/...` and the thumbnail disappears;
      confirm the customer-facing ticket page has no delete UI at all

## Out of scope

- Customer-initiated attachment deletion (not documented, not planned).
- Bulk attachment deletion (single-attachment only; if bulk ticket actions
  from [03-bulk-actions.md](./03-bulk-actions.md) later need it, revisit).
