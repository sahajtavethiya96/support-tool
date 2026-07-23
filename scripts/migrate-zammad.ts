/**
 * One-off migration: Zammad → Support Tool.
 *
 * Pulls every ticket (its opening message, the full reply thread, and all
 * attachments) out of a Zammad instance over its REST API and writes them
 * straight into this app's Postgres + file storage — preserving original
 * timestamps, sender roles, internal-note flags, and "awaiting reply" state.
 *
 * Why a direct DB seed instead of POSTing to /api/v1/tickets:
 *   the public API stamps createdAt = now and auto-assigns ticket numbers, so
 *   it can't reproduce historical timestamps. Inserting directly lets us keep
 *   Zammad's created_at on every ticket and comment.
 *
 * WHAT IS AND ISN'T PRESERVED
 *   ✓ subject, opening message, full conversation, attachments (bytes copied)
 *   ✓ customer name + email (stored inline on the ticket — the Support Tool has
 *     no separate customer table; only agents are `user` rows)
 *   ✓ created_at on ticket + every comment, open/closed status, priority
 *   ✓ internal notes stay internal (isInternal), awaitingReply/pendingReplies
 *   ✓ tags — joined into this app's shared, case-INSENSITIVE tag pool
 *     (lib/tags.ts lowercases), so Zammad's "DTM" lands as "dtm" and any
 *     case variants of one tag collapse into a single shared row
 *   ✗ Zammad's ticket NUMBER (this app assigns its own serial; the original is
 *     recorded in a `zammad_migrated` activity row's metadata)
 *   ~ agent ACCOUNTS — run scripts/migrate-zammad-users.ts FIRST (creates a
 *     Support Tool `user` per Zammad agent/admin) and this script links every
 *     reply's authorId/uploadedById to that account by email as it migrates.
 *     If a reply's author has no matching account yet, it just keeps their
 *     name/role as plain text (authorId stays null) — safe either order, but
 *     users-then-tickets gets more replies linked without a second pass.
 *
 * IDEMPOTENT / RESUMABLE
 *   Each migrated ticket gets a `ticket_activity` row (action "zammad_migrated",
 *   metadata { zammadTicketId }). On every run that set is loaded first and
 *   already-migrated tickets are skipped, so re-running never duplicates. A
 *   checkpoint file on the uploads volume speeds up resume after a crash.
 *
 * RUN IT — see the block comment at the bottom of this file, or scripts/README.
 *   Must run where process.cwd()/uploads is the SAME volume the app serves from
 *   (i.e. inside the `app` container), so migrated files are actually reachable.
 *
 * Required env: ZAMMAD_BASE_URL, ZAMMAD_API_TOKEN  (+ the app's own DATABASE_URL etc.)
 * Optional env:
 *   MIGRATION_DEFAULT_CATEGORY  category slug for imported tickets (default "issue")
 *   MIGRATION_ZAMMAD_SEARCH     Zammad search query to restrict the export
 *                               (e.g. 'tags:DTM') — omit to export ALL tickets
 *   MIGRATION_PER_PAGE          page size when listing Zammad tickets (default 100)
 *   MIGRATION_LIMIT             stop after seeing this many Zammad tickets
 *                               (oldest-first, since listing is sorted created_at
 *                               asc) — e.g. 100 to migrate just the first batch.
 *                               Omit for no limit.
 *   MIGRATION_DRY_RUN           "1" → read + log only, write nothing
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import {
  ticketActivity,
  ticketAttachments,
  ticketComments,
  tickets,
  ticketTags,
  user,
} from "@/db/schema";
import { findOrCreateCustomer } from "@/lib/customers";
import { db, dbClient } from "@/lib/db";
import {
  htmlToRichTextJson,
  isRichTextEmpty,
  textToRichTextJson,
} from "@/lib/rich-text";
import { storage } from "@/lib/storage";
import { getOrCreateTagId, normalizeTagName } from "@/lib/tags";
import {
  getDefaultPriority,
  getDefaultStatus,
  getTicketCategories,
  getTicketPriorities,
  getTicketStatuses,
} from "@/lib/ticket-config";

// Host/dev runs load .env via `tsx --env-file=.env` (see the migrate:zammad
// script in package.json) — it must happen before this file's first import,
// since @/lib/db reads process.env.DATABASE_URL at module load time, and ESM
// imports are hoisted ahead of any top-level statement placed here.

// ── Config ──────────────────────────────────────────────────────────────────
const ZAMMAD_BASE_URL = (process.env.ZAMMAD_BASE_URL ?? "").replace(/\/+$/, "");
const ZAMMAD_API_TOKEN = process.env.ZAMMAD_API_TOKEN ?? "";
const DEFAULT_CATEGORY = process.env.MIGRATION_DEFAULT_CATEGORY ?? "issue";
const ZAMMAD_SEARCH = process.env.MIGRATION_ZAMMAD_SEARCH ?? "";
const PER_PAGE = Number(process.env.MIGRATION_PER_PAGE ?? "100") || 100;
const LIMIT = process.env.MIGRATION_LIMIT
  ? Number(process.env.MIGRATION_LIMIT)
  : null;
const DRY_RUN = process.env.MIGRATION_DRY_RUN === "1";

const CHECKPOINT_FILE = path.join(
  process.cwd(),
  "uploads",
  ".zammad-migration-state.json"
);

if (!(ZAMMAD_BASE_URL && ZAMMAD_API_TOKEN)) {
  console.error(
    "Missing ZAMMAD_BASE_URL and/or ZAMMAD_API_TOKEN. See the header of this file."
  );
  process.exit(1);
}

// ── Zammad REST client (global fetch) ─────────────────────────────────────────
const ZAMMAD_HEADERS = {
  Authorization: `Token token=${ZAMMAD_API_TOKEN}`,
  "Content-Type": "application/json",
};

async function zammadGet<T>(
  pathname: string,
  params?: Record<string, string | number>
): Promise<T> {
  const url = new URL(`${ZAMMAD_BASE_URL}/api/v1${pathname}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: ZAMMAD_HEADERS });
  if (!res.ok) {
    throw new Error(`Zammad GET ${pathname} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function zammadGetBinary(pathname: string): Promise<Buffer> {
  const res = await fetch(`${ZAMMAD_BASE_URL}/api/v1${pathname}`, {
    headers: { Authorization: ZAMMAD_HEADERS.Authorization },
  });
  if (!res.ok) {
    throw new Error(`Zammad GET ${pathname} → ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Zammad's tag API — GET only, matches the read-only contract of this whole
// script. Returns [] (and logs) rather than throwing on any failure (older
// Zammad versions or tokens without tag read access shouldn't abort a
// ticket's migration over a non-essential field).
async function getZammadTags(ticketId: number): Promise<string[]> {
  try {
    const res = await zammadGet<{ tags?: string[] }>("/tags", {
      object: "Ticket",
      o_id: ticketId,
    });
    return res.tags ?? [];
  } catch (err) {
    console.warn(
      `    ! could not fetch tags for Zammad ticket ${ticketId}: ${(err as Error).message}`
    );
    return [];
  }
}

// ── Zammad shapes (only the fields we read) ───────────────────────────────────
interface ZUser {
  email?: string;
  firstname?: string;
  id: number;
  lastname?: string;
  login?: string;
}
interface ZTicket {
  close_at?: string | null;
  created_at: string;
  customer_id: number;
  id: number;
  number: string;
  // Assigned agent. Stock Zammad reserves id 1 for the "-" placeholder
  // owner (unassigned) — treated as null below, same as omitted/0.
  owner_id?: number;
  priority_id: number;
  state_id: number;
  title: string;
  updated_at: string;
}
interface ZAttachment {
  filename: string;
  id: number;
  preferences?: { "Content-Type"?: string };
  size?: string;
}
interface ZArticle {
  attachments?: ZAttachment[];
  body?: string;
  content_type?: string;
  created_at: string;
  created_by_id: number;
  from?: string;
  id: number;
  internal: boolean;
  sender_id: number;
  ticket_id: number;
}

// ── Caches / lookup maps built once from Zammad ───────────────────────────────
const userCache = new Map<number, ZUser>();
async function getZUser(id: number): Promise<ZUser | null> {
  if (!id) {
    return null;
  }
  const cached = userCache.get(id);
  if (cached) {
    return cached;
  }
  try {
    const u = await zammadGet<ZUser>(`/users/${id}`);
    userCache.set(id, u);
    return u;
  } catch {
    return null;
  }
}

// Zammad user id → this app's user id, resolved by email (null if the
// Zammad user has no email or no matching Support Tool account — e.g. the
// scripts/migrate-zammad-users.ts migration hasn't been run yet, in which
// case comments/attachments just keep authorId/uploadedById null, same as
// before this lookup existed).
const localUserIdByZammadUserId = new Map<number, string | null>();
async function resolveLocalAuthorId(
  zammadUserId: number
): Promise<string | null> {
  const cached = localUserIdByZammadUserId.get(zammadUserId);
  if (cached !== undefined) {
    return cached;
  }
  const zUser = await getZUser(zammadUserId);
  const email = (zUser?.email ?? "").trim().toLowerCase();
  let localId: string | null = null;
  if (email) {
    const [row] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    localId = row?.id ?? null;
  }
  localUserIdByZammadUserId.set(zammadUserId, localId);
  return localId;
}

function zUserName(u: ZUser | null): string {
  if (!u) {
    return "";
  }
  const name = `${u.firstname ?? ""} ${u.lastname ?? ""}`.trim();
  return name || u.email || u.login || "";
}

// Zammad "senders" (Agent / Customer / System) — id → name.
let senderNameById = new Map<number, string>();
async function loadSenders() {
  try {
    const rows = await zammadGet<Array<{ id: number; name: string }>>(
      "/ticket_article_senders"
    );
    senderNameById = new Map(rows.map((r) => [r.id, r.name]));
  } catch {
    // Fall back to the stock Zammad ids: 1 Agent, 2 Customer, 3 System.
    senderNameById = new Map([
      [1, "Agent"],
      [2, "Customer"],
      [3, "System"],
    ]);
  }
}

// Zammad state id → this app's status slug. Closed/merged → the closed slug,
// everything else → the default (open) slug.
let statusSlugByStateId = new Map<number, string>();
async function loadStateMap(openSlug: string, closedSlug: string) {
  try {
    const rows =
      await zammadGet<Array<{ id: number; name: string }>>("/ticket_states");
    statusSlugByStateId = new Map(
      rows.map((s) => [s.id, /clos|merg/i.test(s.name) ? closedSlug : openSlug])
    );
  } catch {
    // Stock Zammad: 4 = closed, 5 = merged.
    statusSlugByStateId = new Map([
      [4, closedSlug],
      [5, closedSlug],
    ]);
  }
}
function statusForState(stateId: number, openSlug: string): string {
  return statusSlugByStateId.get(stateId) ?? openSlug;
}

// Zammad priority id → this app's priority slug (matched by name).
let prioritySlugById = new Map<number, string>();
async function loadPriorityMap(validSlugs: Set<string>, defaultSlug: string) {
  const pick = (name: string): string => {
    const n = name.toLowerCase();
    if (/urgent|emergenc/.test(n) && validSlugs.has("urgent")) {
      return "urgent";
    }
    if (/high/.test(n) && validSlugs.has("high")) {
      return "high";
    }
    if (/low/.test(n) && validSlugs.has("low")) {
      return "low";
    }
    if (/normal|medium/.test(n) && validSlugs.has("normal")) {
      return "normal";
    }
    return defaultSlug;
  };
  try {
    const rows =
      await zammadGet<Array<{ id: number; name: string }>>(
        "/ticket_priorities"
      );
    prioritySlugById = new Map(rows.map((p) => [p.id, pick(p.name)]));
  } catch {
    prioritySlugById = new Map([
      [1, validSlugs.has("low") ? "low" : defaultSlug],
      [2, defaultSlug],
      [3, validSlugs.has("high") ? "high" : defaultSlug],
    ]);
  }
}
function priorityForId(id: number, defaultSlug: string): string {
  return prioritySlugById.get(id) ?? defaultSlug;
}

// ── Content conversion ────────────────────────────────────────────────────────
// Zammad article bodies are usually text/html; store them as the same Tiptap
// JSON document the app's own editor produces. Empty bodies fall back to a
// caller-supplied placeholder so notNull columns are satisfied.
function articleToRichText(article: ZArticle, fallbackPlain: string): string {
  const body = article.body ?? "";
  const isHtml = (article.content_type ?? "").toLowerCase().includes("html");
  let json = body.trim()
    ? isHtml
      ? htmlToRichTextJson(body)
      : textToRichTextJson(body)
    : "";
  if (!json || isRichTextEmpty(json)) {
    json = textToRichTextJson(fallbackPlain);
  }
  return json;
}

// ── Zammad ticket listing (paginated) ─────────────────────────────────────────
async function* iterateZammadTickets(): AsyncGenerator<ZTicket> {
  let page = 1;
  for (;;) {
    const batch = ZAMMAD_SEARCH
      ? await zammadGet<ZTicket[]>("/tickets/search", {
          query: ZAMMAD_SEARCH,
          page,
          per_page: PER_PAGE,
          sort_by: "created_at",
          order_by: "asc",
        })
      : await zammadGet<ZTicket[]>("/tickets", {
          page,
          per_page: PER_PAGE,
          sort_by: "created_at",
          order_by: "asc",
        });
    if (!Array.isArray(batch) || batch.length === 0) {
      return;
    }
    for (const t of batch) {
      yield t;
    }
    if (batch.length < PER_PAGE) {
      return;
    }
    page += 1;
  }
}

// ── Checkpoint (resume-after-crash cache; DB is the source of truth) ──────────
interface Checkpoint {
  done: Record<string, string>; // zammadTicketId → new ticketId
  failed: Record<string, string>; // zammadTicketId → error
}
async function loadCheckpoint(): Promise<Checkpoint> {
  try {
    const raw = await fs.readFile(CHECKPOINT_FILE, "utf8");
    return JSON.parse(raw) as Checkpoint;
  } catch {
    return { done: {}, failed: {} };
  }
}
async function saveCheckpoint(cp: Checkpoint): Promise<void> {
  if (DRY_RUN) {
    return;
  }
  await fs.mkdir(path.dirname(CHECKPOINT_FILE), { recursive: true });
  await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// Authoritative already-migrated set: every migrated ticket left a
// `zammad_migrated` activity row carrying its source Zammad id.
async function loadMigratedZammadIds(): Promise<Set<string>> {
  const rows = await db
    .select({ metadata: ticketActivity.metadata })
    .from(ticketActivity)
    .where(eq(ticketActivity.action, "zammad_migrated"));
  const ids = new Set<string>();
  for (const r of rows) {
    const zid = (r.metadata as { zammadTicketId?: string | number } | null)
      ?.zammadTicketId;
    if (zid != null) {
      ids.add(String(zid));
    }
  }
  return ids;
}

// ── Per-ticket migration ──────────────────────────────────────────────────────
interface StagedAttachment {
  commentId: string | null;
  createdAt: Date;
  filename: string;
  fileSize: number;
  id: string;
  mimeType: string;
  storageKey: string;
  ticketId: string;
  uploadedById: string | null;
  uploadedByName: string;
  uploadedByRole: string;
}

async function migrateOneTicket(
  zTicket: ZTicket,
  cfg: {
    openSlug: string;
    validCategory: string;
    defaultPriority: string;
  }
): Promise<{
  ticketId: string;
  comments: number;
  attachments: number;
  tags: number;
}> {
  const ticketId = createId();

  // Articles = the whole conversation, oldest first.
  const articles = (
    await zammadGet<ZArticle[]>(`/ticket_articles/by_ticket/${zTicket.id}`)
  )
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Normalized + deduped up front: this app's tag pool is case-insensitive
  // (lib/tags.ts lowercases), so Zammad's "Billing" and "billing" resolve to
  // the SAME tag row — and ticket_tags has a UNIQUE (ticket_id, tag_id) index
  // that a duplicate would trip, failing the whole ticket's transaction.
  const tagNames = [
    ...new Set((await getZammadTags(zTicket.id)).map(normalizeTagName)),
  ].filter(Boolean);

  // Customer identity lives inline on the ticket.
  const customer = await getZUser(zTicket.customer_id);
  const customerEmail = (customer?.email ?? "").trim();
  const customerName =
    zUserName(customer) || customerEmail.split("@")[0] || "Customer";

  // Assignee — same email-matched lookup used for comment authors. Only
  // resolves to a real agent if scripts/migrate-zammad-users.ts already
  // created their account; otherwise the ticket lands unassigned, same as
  // if owner_id were absent.
  const assignedAgentId =
    zTicket.owner_id && zTicket.owner_id > 1
      ? await resolveLocalAuthorId(zTicket.owner_id)
      : null;

  const opening = articles[0];
  const rest = articles.slice(1);

  const descriptionPlainFallback = zTicket.title || "(no content)";
  const description = opening
    ? articleToRichText(opening, descriptionPlainFallback)
    : textToRichTextJson(descriptionPlainFallback);

  // Resolve a display role/name/local-user-id for an article. authorId is
  // only ever non-null when scripts/migrate-zammad-users.ts has already run
  // and created a Support Tool account matching this Zammad author's email —
  // run that script FIRST so replies link to a real user as they're migrated,
  // rather than relying on the separate name-matching backfill it also does.
  const roleFor = async (
    article: ZArticle
  ): Promise<{
    role: "customer" | "agent";
    name: string;
    authorId: string | null;
  }> => {
    const senderName = senderNameById.get(article.sender_id) ?? "Agent";
    if (senderName === "Customer") {
      return { role: "customer", name: customerName, authorId: null };
    }
    const author = await getZUser(article.created_by_id);
    const name =
      zUserName(author) ||
      (article.from ?? "").replace(/<[^>]*>/g, "").trim() ||
      "Support Agent";
    const authorId = await resolveLocalAuthorId(article.created_by_id);
    return { role: "agent", name, authorId };
  };

  // Stage comment rows (everything after the opening article) + track the
  // awaiting-reply bookkeeping the app maintains on every reply.
  const openingMeta = opening
    ? await roleFor(opening)
    : { role: "customer" as const, name: customerName, authorId: null };

  const commentRows: Array<typeof ticketComments.$inferInsert> = [];
  // Opening message counts as the first customer message → pendingReplies 1.
  let pending = openingMeta.role === "customer" ? 1 : 0;

  // Mirrors the activity rows the live app writes on ticket creation and on
  // every reply (app/api/tickets/[id]/comments/route.ts, lib/tickets/create-ticket.ts)
  // — without these, the ticket list's "Updated By" column (which reads the
  // latest agent/admin ticketActivity row) has nothing to show for migrated
  // tickets, even ones with real agent replies.
  const activityRows: Array<typeof ticketActivity.$inferInsert> = [
    {
      id: createId(),
      ticketId,
      actorId: openingMeta.authorId,
      actorName: openingMeta.name,
      actorRole: openingMeta.role,
      action: "ticket_created",
      createdAt: new Date(zTicket.created_at),
    },
  ];

  const stagedAttachments: StagedAttachment[] = [];

  // Opening-message attachments belong to the ticket, not to a comment
  // (comment_id IS NULL) — matching how the app models the opening message.
  if (opening?.attachments?.length) {
    for (const att of opening.attachments) {
      const staged = await stageAttachment(
        ticketId,
        null,
        opening,
        att,
        openingMeta
      );
      if (staged) {
        stagedAttachments.push(staged);
      }
    }
  }

  for (const article of rest) {
    const meta = await roleFor(article);
    const content = articleToRichText(article, "(no content)");

    // Drop empty, non-internal system chatter (e.g. Zammad state-change notes
    // with no body) — they'd show as blank bubbles.
    if (isRichTextEmpty(content) && !article.internal) {
      continue;
    }

    const commentId = createId();
    commentRows.push({
      id: commentId,
      ticketId,
      authorId: meta.authorId,
      authorName: meta.name,
      authorRole: meta.role,
      content,
      isInternal: article.internal,
      createdAt: new Date(article.created_at),
      updatedAt: new Date(article.created_at),
    });
    activityRows.push({
      id: createId(),
      ticketId,
      actorId: meta.authorId,
      actorName: meta.name,
      actorRole: meta.role,
      action: article.internal ? "internal_note_added" : "comment_added",
      createdAt: new Date(article.created_at),
    });

    // Only PUBLIC messages affect awaiting-reply state.
    if (!article.internal) {
      pending = meta.role === "customer" ? pending + 1 : 0;
    }

    if (article.attachments?.length) {
      for (const att of article.attachments) {
        const staged = await stageAttachment(
          ticketId,
          commentId,
          article,
          att,
          meta
        );
        if (staged) {
          stagedAttachments.push(staged);
        }
      }
    }
  }

  const createdAt = new Date(zTicket.created_at);
  const lastActivityAt = new Date(zTicket.updated_at ?? zTicket.created_at);
  const status = statusForState(zTicket.state_id, cfg.openSlug);
  const isClosed = status !== cfg.openSlug; // openSlug is the only non-closed default
  const closedAt = zTicket.close_at
    ? new Date(zTicket.close_at)
    : isClosed
      ? lastActivityAt
      : null;

  if (DRY_RUN) {
    console.log(
      `  [dry-run] would import Zammad #${zTicket.number} → "${zTicket.title}" ` +
        `(${customerEmail || "no-email"}, ${status}, assignee: ${assignedAgentId ?? "none"}, ` +
        `${commentRows.length} comments, ${stagedAttachments.length} attachments, ${tagNames.length} tags)`
    );
    // Roll back the files we uploaded while staging during a dry run.
    for (const a of stagedAttachments) {
      await storage.delete(a.storageKey).catch(() => undefined);
    }
    return {
      ticketId,
      comments: commentRows.length,
      attachments: stagedAttachments.length,
      tags: tagNames.length,
    };
  }

  // Find-or-create every tag and the customer BEFORE opening the ticket's
  // transaction, and never inside it: both write through the global `db`
  // handle, so from inside tx they'd run on a *different* pooled connection —
  // outside the transaction, invisible to it, and able to deadlock against it.
  // Resolving first also means these rows can't disagree with the tx: they're
  // committed up front, and the tx only inserts rows that reference them. A
  // tag/customer left behind by a rolled-back ticket is harmless — shared
  // pool, not ticket-owned.
  const tagIds = await Promise.all(tagNames.map(getOrCreateTagId));
  const customerRecord = await findOrCreateCustomer(
    customerName,
    customerEmail || "unknown@migrated.local"
  );

  try {
    await db.transaction(async (tx) => {
      await tx.insert(tickets).values({
        id: ticketId,
        subject: zTicket.title || "(no subject)",
        description,
        category: cfg.validCategory,
        status,
        priority: priorityForId(zTicket.priority_id, cfg.defaultPriority),
        customerId: customerRecord.id,
        customerToken: createId(),
        assignedAgentId,
        source: "portal",
        awaitingReply: pending > 0,
        pendingReplies: pending,
        closedAt,
        createdAt,
        updatedAt: lastActivityAt,
      });

      if (commentRows.length > 0) {
        await tx.insert(ticketComments).values(commentRows);
      }
      if (stagedAttachments.length > 0) {
        await tx.insert(ticketAttachments).values(
          stagedAttachments.map((a) => ({
            id: a.id,
            ticketId: a.ticketId,
            commentId: a.commentId,
            filename: a.filename,
            storageKey: a.storageKey,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
            uploadedById: a.uploadedById,
            uploadedByName: a.uploadedByName,
            uploadedByRole: a.uploadedByRole,
            createdAt: a.createdAt,
          }))
        );
      }

      if (tagIds.length > 0) {
        await tx.insert(ticketTags).values(
          tagIds.map((tagId) => ({
            id: createId(),
            ticketId,
            tagId,
            // Same as every other row here: keep the ticket's own date rather
            // than defaulting to now(), so the import carries no "today" stamps.
            createdAt,
          }))
        );
      }

      // Reconstructed creation/reply activity trail (see activityRows above)
      // + the idempotency marker + audit trail of where this ticket came from.
      await tx.insert(ticketActivity).values([
        ...activityRows,
        {
          id: createId(),
          ticketId,
          actorId: null,
          actorName: "Zammad Migration",
          actorRole: "system",
          action: "zammad_migrated",
          metadata: {
            zammadTicketId: zTicket.id,
            zammadNumber: zTicket.number,
          },
          createdAt,
        },
      ]);
    });
  } catch (err) {
    // Insert failed — remove the files we already uploaded for this ticket.
    for (const a of stagedAttachments) {
      await storage.delete(a.storageKey).catch(() => undefined);
    }
    throw err;
  }

  return {
    ticketId,
    comments: commentRows.length,
    attachments: stagedAttachments.length,
    tags: tagIds.length,
  };
}

// Download a Zammad attachment and store it under this ticket's prefix,
// returning a DB-ready row. Returns null (and logs) on any download failure so
// a single bad attachment never aborts the whole ticket.
async function stageAttachment(
  ticketId: string,
  commentId: string | null,
  article: ZArticle,
  att: ZAttachment,
  by: { role: "customer" | "agent"; name: string; authorId: string | null }
): Promise<StagedAttachment | null> {
  try {
    const buffer = await zammadGetBinary(
      `/ticket_attachment/${article.ticket_id}/${article.id}/${att.id}`
    );
    if (buffer.length === 0) {
      return null;
    }
    const mimeType = (
      att.preferences?.["Content-Type"] ?? "application/octet-stream"
    )
      .split(";")[0]
      .trim();
    const ext = att.filename.includes(".")
      ? att.filename.split(".").pop()
      : "bin";
    const storageKey = `tickets/${ticketId}/${createId()}.${ext}`;

    if (!DRY_RUN) {
      await storage.upload(storageKey, buffer, mimeType);
    }

    return {
      id: createId(),
      ticketId,
      commentId,
      filename: att.filename,
      storageKey,
      fileSize: buffer.length,
      mimeType,
      uploadedById: by.authorId,
      uploadedByName: by.name,
      uploadedByRole: by.role,
      createdAt: new Date(article.created_at),
    };
  } catch (err) {
    console.warn(
      `    ! skipped attachment "${att.filename}" on Zammad article ${article.id}: ${(err as Error).message}`
    );
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\nZammad → Support Tool migration${DRY_RUN ? " (DRY RUN — no writes)" : ""}`
  );
  console.log(`  source:   ${ZAMMAD_BASE_URL}`);
  console.log(
    `  filter:   ${ZAMMAD_SEARCH ? `search "${ZAMMAD_SEARCH}"` : "ALL tickets"}`
  );
  if (LIMIT == null) {
    console.log("");
  } else {
    console.log(`  limit:    first ${LIMIT} ticket(s) seen (oldest-first)\n`);
  }

  // Resolve this app's config → the slugs we'll map Zammad values onto.
  const [statuses, priorities, categories, defaultStatus, defaultPriority] =
    await Promise.all([
      getTicketStatuses(),
      getTicketPriorities(),
      getTicketCategories(),
      getDefaultStatus(),
      getDefaultPriority(),
    ]);

  const openSlug = defaultStatus?.slug ?? "open";
  const closedSlug = statuses.find((s) => s.isClosedState)?.slug ?? "closed";
  const defaultPrioritySlug = defaultPriority?.slug ?? "normal";
  const prioritySlugs = new Set(priorities.map((p) => p.slug));

  const categorySlugs = new Set(categories.map((c) => c.slug));
  const validCategory = categorySlugs.has(DEFAULT_CATEGORY)
    ? DEFAULT_CATEGORY
    : (categories[0]?.slug ?? "issue");
  if (validCategory !== DEFAULT_CATEGORY) {
    console.warn(
      `  ⚠ category "${DEFAULT_CATEGORY}" not found — using "${validCategory}" instead.\n`
    );
  }

  await Promise.all([
    loadSenders(),
    loadStateMap(openSlug, closedSlug),
    loadPriorityMap(prioritySlugs, defaultPrioritySlug),
  ]);

  const checkpoint = await loadCheckpoint();
  const alreadyMigrated = await loadMigratedZammadIds();
  for (const id of Object.keys(checkpoint.done)) {
    alreadyMigrated.add(id);
  }

  let seen = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  let totalComments = 0;
  let totalAttachments = 0;
  let totalTags = 0;

  for await (const zTicket of iterateZammadTickets()) {
    if (LIMIT != null && seen >= LIMIT) {
      break;
    }
    seen += 1;
    const zid = String(zTicket.id);
    if (alreadyMigrated.has(zid)) {
      skipped += 1;
      continue;
    }

    try {
      const result = await migrateOneTicket(zTicket, {
        openSlug,
        validCategory,
        defaultPriority: defaultPrioritySlug,
      });
      migrated += 1;
      totalComments += result.comments;
      totalAttachments += result.attachments;
      totalTags += result.tags;
      checkpoint.done[zid] = result.ticketId;
      delete checkpoint.failed[zid];
      if (!DRY_RUN) {
        console.log(
          `  ✓ #${zTicket.number} → ${result.ticketId} ` +
            `(${result.comments} comments, ${result.attachments} attachments, ${result.tags} tags)`
        );
      }
    } catch (err) {
      failed += 1;
      checkpoint.failed[zid] = (err as Error).message;
      console.error(
        `  ✗ #${zTicket.number} (Zammad id ${zid}): ${(err as Error).message}`
      );
    }

    // Persist progress every ticket so a crash resumes almost exactly.
    await saveCheckpoint(checkpoint);
  }

  console.log("\n──────── Summary ────────");
  console.log(`  Zammad tickets seen:   ${seen}`);
  console.log(`  migrated:              ${migrated}`);
  console.log(`  skipped (already done):${skipped}`);
  console.log(`  failed:                ${failed}`);
  console.log(`  comments imported:     ${totalComments}`);
  console.log(`  attachments imported:  ${totalAttachments}`);
  console.log(`  tags imported:         ${totalTags}`);
  if (failed > 0) {
    console.log(
      `\n  ${failed} ticket(s) failed — see ${CHECKPOINT_FILE} (.failed). Re-run to retry only those.`
    );
  }
  console.log("");
}

main()
  .then(async () => {
    await dbClient.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("\nMigration aborted:", err);
    await dbClient.end().catch(() => undefined);
    process.exit(1);
  });

/*
 * ──────────────────────────── HOW TO RUN ────────────────────────────
 *
 * The migration MUST write into the same uploads volume the app serves from
 * (support_tool_uploads → /app/uploads), so run it INSIDE the app container.
 *
 * 1) DRY RUN first (reads Zammad, writes nothing — verify counts & mapping):
 *
 *    docker compose exec \
 *      -e ZAMMAD_BASE_URL="https://your-zammad.example.com" \
 *      -e ZAMMAD_API_TOKEN="your-admin-api-token" \
 *      -e MIGRATION_DRY_RUN=1 \
 *      app pnpm migrate:zammad
 *
 * 2) REAL run (safe to re-run — already-migrated tickets are skipped):
 *
 *    docker compose exec \
 *      -e ZAMMAD_BASE_URL="https://your-zammad.example.com" \
 *      -e ZAMMAD_API_TOKEN="your-admin-api-token" \
 *      app pnpm migrate:zammad
 *
 *    Optional: only DTM tickets →  -e MIGRATION_ZAMMAD_SEARCH="tags:DTM"
 *              different category →  -e MIGRATION_DEFAULT_CATEGORY="general_query"
 *              first 100 tickets only →  -e MIGRATION_LIMIT=100
 *
 * Not using Docker (host / dev, with the app's .env present and uploads/ here):
 *    ZAMMAD_BASE_URL=... ZAMMAD_API_TOKEN=... pnpm migrate:zammad
 */
