import { createId } from "@paralleldrive/cuid2";
import { verification } from "@/db/schema/auth";
import { db } from "@/lib/db";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Mints a token in the exact shape Better Auth's own `POST /reset-password`
 * endpoint expects (`verification.identifier = "reset-password:<token>"`,
 * `value = userId`) — so an invited user who has no `credential` account yet
 * can land on our own `/reset-password?token=...` page and have that same
 * endpoint create their password account, no separate invite-token system
 * needed. This is a documented, stable row shape (see
 * node_modules/better-auth/dist/api/routes/password.mjs), not an internal
 * implementation detail we're reaching past — but it does mean this must be
 * revisited if a future Better Auth upgrade changes that identifier format.
 *
 * Uses a longer 7-day expiry than a live "forgot password" request (Better
 * Auth's default is 1 hour) since this doubles as an account-activation
 * link — an invitee may not check email the same day.
 */
export async function createPasswordSetupToken(
  userId: string
): Promise<string> {
  const token = createId();
  const now = new Date();

  await db.insert(verification).values({
    id: createId(),
    identifier: `reset-password:${token}`,
    value: userId,
    expiresAt: new Date(now.getTime() + SEVEN_DAYS_MS),
    createdAt: now,
    updatedAt: now,
  });

  return token;
}
