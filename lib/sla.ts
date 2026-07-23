import { sql, type SQL } from "drizzle-orm";
import { tickets } from "@/db/schema/tickets";

/** Elapsed/target ratio at which a live metric turns from green to yellow. */
export const WARNING_THRESHOLD = 0.8;

export type WaitState = "waiting_for_agent" | "waiting_for_customer" | "resolved";

export type MetricStatus = "met" | "on_track" | "warning" | "breached";

/** "45m", "2h 15m", "1d 4h", "3d" — shared by the admin policy form (minutes
 * → seconds) and the ticking SLA badges (live elapsed/remaining seconds). */
export function formatDuration(totalSeconds: number): string {
  const abs = Math.max(0, Math.round(totalSeconds));
  if (abs < 60) {
    return `${abs}s`;
  }
  const days = Math.floor(abs / 86_400);
  const hours = Math.floor((abs % 86_400) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

export interface SlaMetricSnapshot {
  label: "First response" | "Next response" | "Resolution";
  targetSeconds: number;
  /** Elapsed seconds as of `asOf`. When `live`, the caller re-derives the
   * current value via `getLiveElapsedSeconds()` instead of re-fetching. */
  elapsedSeconds: number;
  /** ISO instant `elapsedSeconds` is valid at. */
  asOf: string;
  /** True while this metric's elapsed time keeps advancing in real time. */
  live: boolean;
  /** Final outcome once `!live` (already responded / ticket resolved). */
  frozen?: "met" | "breached";
}

export interface SlaSnapshot {
  waitState: WaitState;
  /** When the CURRENT wait state began — null once resolved. */
  waitingSince: string | null;
  createdAt: string;
  /** Null only when no SLA policy applies at all (e.g. none configured yet). */
  firstResponse: SlaMetricSnapshot | null;
  /** Null before the first response happens, or while waiting on the
   * customer (nothing is currently due from the agent). */
  nextResponse: SlaMetricSnapshot | null;
  resolution: SlaMetricSnapshot | null;
}

export interface SlaPolicyTargets {
  firstResponseMinutes: number;
  nextResponseMinutes: number;
  resolutionMinutes: number;
}

export interface SlaTicketState {
  createdAt: Date;
  closedAt: Date | null;
  awaitingReply: boolean;
  waitingSince: Date | null;
  firstRespondedAt: Date | null;
  slaActiveSeconds: number;
}

function secondsBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}

export function resolveWaitState(
  ticket: Pick<SlaTicketState, "closedAt" | "awaitingReply">
): WaitState {
  if (ticket.closedAt) {
    return "resolved";
  }
  return ticket.awaitingReply ? "waiting_for_agent" : "waiting_for_customer";
}

/**
 * Builds the full SLA snapshot for one ticket against one resolved policy.
 * Pure function — no DB/React — so it's reused identically by the ticket
 * list query, the detail page, and the client-side ticking badge (via
 * getLiveElapsedSeconds/getMetricStatus below).
 */
export function computeSlaSnapshot(
  ticket: SlaTicketState,
  policy: SlaPolicyTargets | null,
  now: Date
): SlaSnapshot {
  const waitState = resolveWaitState(ticket);
  const nowIso = now.toISOString();

  const base = {
    waitState,
    waitingSince: ticket.waitingSince ? ticket.waitingSince.toISOString() : null,
    createdAt: ticket.createdAt.toISOString(),
  };

  if (!policy) {
    return { ...base, firstResponse: null, nextResponse: null, resolution: null };
  }

  // First response — elapsed is frozen the moment firstRespondedAt is set;
  // otherwise it's still climbing (unless the ticket got resolved without
  // ever getting one, in which case it's frozen at the resolution time).
  const firstResponseLive = !ticket.firstRespondedAt && waitState !== "resolved";
  const firstResponseElapsed = secondsBetween(
    ticket.createdAt,
    ticket.firstRespondedAt ?? now
  );
  const firstResponseTarget = policy.firstResponseMinutes * 60;
  const firstResponse: SlaMetricSnapshot = {
    label: "First response",
    targetSeconds: firstResponseTarget,
    elapsedSeconds: firstResponseElapsed,
    asOf: nowIso,
    live: firstResponseLive,
    frozen: firstResponseLive
      ? undefined
      : firstResponseElapsed <= firstResponseTarget
        ? "met"
        : "breached",
  };

  // Next response — only relevant once the first response has happened, the
  // ticket is still open, and the ball is currently in the agent's court.
  let nextResponse: SlaMetricSnapshot | null = null;
  if (ticket.firstRespondedAt && waitState === "waiting_for_agent") {
    const since = ticket.waitingSince ?? ticket.createdAt;
    nextResponse = {
      label: "Next response",
      targetSeconds: policy.nextResponseMinutes * 60,
      elapsedSeconds: secondsBetween(since, now),
      asOf: nowIso,
      live: true,
    };
  }

  // Resolution — accumulated active seconds, plus the live in-progress span
  // while currently waiting on the agent. Frozen once resolved.
  const since = ticket.waitingSince ?? ticket.createdAt;
  const liveSpanSeconds =
    waitState === "waiting_for_agent" ? secondsBetween(since, now) : 0;
  const resolutionElapsed = ticket.slaActiveSeconds + liveSpanSeconds;
  const resolutionTarget = policy.resolutionMinutes * 60;
  // Only "live" (still advancing) while actively waiting on the agent —
  // paused (waiting on the customer) and resolved are both non-advancing,
  // just with different reasons, so both render as a frozen snapshot.
  const resolutionLive = waitState === "waiting_for_agent";
  const resolution: SlaMetricSnapshot = {
    label: "Resolution",
    targetSeconds: resolutionTarget,
    elapsedSeconds: resolutionElapsed,
    asOf: nowIso,
    live: resolutionLive,
    frozen: resolutionLive
      ? undefined
      : resolutionElapsed <= resolutionTarget
        ? "met"
        : "breached",
  };

  return { ...base, firstResponse, nextResponse, resolution };
}

/** Re-derives a live metric's current elapsed seconds — the one thing that
 * changes between server render and each client tick. No-op for frozen ones. */
export function getLiveElapsedSeconds(
  metric: SlaMetricSnapshot,
  nowMs: number
): number {
  if (!metric.live) {
    return metric.elapsedSeconds;
  }
  const asOfMs = new Date(metric.asOf).getTime();
  return metric.elapsedSeconds + Math.max(0, (nowMs - asOfMs) / 1000);
}

export function getMetricStatus(
  metric: SlaMetricSnapshot,
  nowMs: number
): MetricStatus {
  if (!metric.live) {
    return metric.frozen ?? "met";
  }
  if (metric.targetSeconds <= 0) {
    return "on_track";
  }
  const ratio = getLiveElapsedSeconds(metric, nowMs) / metric.targetSeconds;
  if (ratio >= 1) {
    return "breached";
  }
  if (ratio >= WARNING_THRESHOLD) {
    return "warning";
  }
  return "on_track";
}

export interface SlaTransitionPatch {
  waitingSince?: Date | null;
  slaActiveSeconds?: SQL<unknown>;
}

/**
 * The single place that encodes the SLA pause/resume rule. Every route that
 * mutates `tickets.awaitingReply` calls this and merges the result into its
 * existing `.update(tickets).set({...})` — no timer math duplicated anywhere.
 *
 * - mode "reply": a customer or agent reply flips (or doesn't flip)
 *   awaitingReply. No-ops if `nextAwaitingReply` matches the current value
 *   (e.g. a customer's second follow-up before the agent replies) — the
 *   response clock stays pinned to the first unanswered message.
 * - mode "closing": ticket is being closed. Flushes any in-progress active
 *   span into slaActiveSeconds, then stops the clock (waitingSince: null).
 * - mode "reopening": ticket is being reopened from "resolved". Always
 *   (re)starts the clock at `now`, regardless of direction — there's no
 *   in-progress span to flush since it was already stopped at close.
 *   slaActiveSeconds carries forward unchanged (Resolution SLA tracks total
 *   active time across the ticket's whole lifetime, including reopens).
 */
export function computeSlaTransition(
  current: { awaitingReply: boolean; waitingSince: Date | null },
  nextAwaitingReply: boolean,
  now: Date,
  mode: "reply" | "closing" | "reopening" = "reply"
): SlaTransitionPatch {
  if (mode === "reopening") {
    return { waitingSince: now };
  }

  if (mode === "closing") {
    if (current.awaitingReply && current.waitingSince) {
      const elapsed = secondsBetween(current.waitingSince, now);
      return {
        waitingSince: null,
        slaActiveSeconds: sql`${tickets.slaActiveSeconds} + ${elapsed}`,
      };
    }
    return { waitingSince: null };
  }

  // mode === "reply"
  if (current.awaitingReply === nextAwaitingReply) {
    return {};
  }
  if (nextAwaitingReply) {
    return { waitingSince: now };
  }
  const elapsed = current.waitingSince
    ? secondsBetween(current.waitingSince, now)
    : 0;
  return {
    waitingSince: now,
    slaActiveSeconds: sql`${tickets.slaActiveSeconds} + ${elapsed}`,
  };
}
