# Plan: Password reset

**Shipped** (self-service path, #1 below). Also reused for admin-driven
invites (`docs/authentication.md` § 2, "Inviting a New Agent/Admin") — an
invited user has no `credential` account yet, so the invite email's
password-setup link is minted the same way (`lib/password-setup-token.ts`)
and lands on the same `/reset-password` page. #2 (admin-initiated reset for
an already-existing, locked-out user) is not built — see Out of scope.

## Why this exists

Password login (`lib/auth.ts`'s `emailAndPassword`) shipped with no reset
flow. Today, a user who forgets their password has **no self-service way
back in** — the only option is an admin re-running `pnpm create:admin` for
a *different* email, which doesn't help them recover their existing
account. This plan closes that gap.

## Two complementary paths (build both, or start with #1)

### 1. Self-service "Forgot password?" (primary)

Better Auth's `emailAndPassword` core config already supports this via a
`sendResetPassword` callback plus two endpoints it registers automatically:
`requestPasswordReset` (client: `authClient.requestPasswordReset(...)`) and
`resetPassword` (client: `authClient.resetPassword(...)`). No plugin
needed — same shape as the existing magic-link mechanism, so it can mirror
that implementation closely.

### 2. Admin-initiated reset (secondary, smaller effort)

The Better Auth Admin Plugin already exposes `POST /admin/set-user-password`
(`auth.api.setUserPassword`) — lets an admin set a new password for any
user directly, no email round-trip. Useful as a fallback when SMTP isn't
configured (the same self-hosted constraint that motivated password login
in the first place) and as a fast path for support. This could ship as a
single button on the user-detail view in `/admin/users` or `/orbit` with
minimal new code — worth doing even if #1 is deferred further.

---

## Schema

None — `verification` table (Better Auth's) already stores reset tokens
the same way it stores magic-link tokens. No migration needed.

## API / Server wiring

`lib/auth.ts` — add to the existing `emailAndPassword` block:

```ts
emailAndPassword: {
  enabled: true,
  requireEmailVerification: false,
  minPasswordLength: 8,
  sendResetPassword: async ({ user, url }) => {
    const { html, text } = await resetPasswordTemplate({
      email: user.email,
      resetUrl: url,
    });
    await enqueueEmail({
      to: user.email,
      subject: `Reset your ${PRODUCT_NAME} password`,
      html,
      text,
    });
    await audit({
      action: "auth.password_reset_requested",
      actorEmail: user.email,
      description: `Password reset requested for ${user.email}`,
      entityType: "user",
      metadata: { email: user.email },
    });
  },
},
```

New email template `lib/email/templates/reset-password.tsx` — copy
`magic-link.tsx` structure exactly (same `EmailLayout`, same brand styling),
swap copy to "Reset your password" / "This link expires in 1 hour" (Better
Auth's reset-token default TTL — confirm exact value before writing copy).

**Toggle enforcement**: extend the existing `hooks.before` middleware in
`lib/auth.ts` to also gate `/request-password-reset` and `/reset-password`
behind `passwordLoginEnabled` — if password login is disabled, reset should
be blocked too (there's nothing to reset into).

**Rate limiting / enumeration**: mirror the magic-link pattern — the
request-reset UI should always show the same generic message
("If that email has an account, we've sent a reset link") regardless of
whether the email exists, matching the existing magic-link anti-enumeration
behavior documented in `docs/authentication.md` § 8.

## UI

- **Login form** (`app/(auth)/_components/auth-form.tsx`): add a "Forgot
  password?" link under the password field, visible only in `mode ===
  "password"`. Links to a new `/forgot-password` page (simple email-only
  form, same visual shell as the existing login card).
- **New page** `/reset-password?token=...` — the link Better Auth emails
  points here. Form: new password + confirm, calls
  `authClient.resetPassword({ newPassword, token })`, then redirects to
  `/login` with a success toast/message on completion. Handle the
  expired/invalid-token case the same way the existing magic-link failure
  state does (`docs/authentication.md` § 2, "On failure").
- **Admin path** (if building #2): a "Reset password" button + confirm
  dialog (per `CLAUDE.md`'s "never `window.confirm()`" convention) on each
  user row in `/admin/users`, calling `auth.api.setUserPassword` server-side
  via a new `PATCH`/`POST` route, admin-only. Generates a random temporary
  password shown once to the admin to relay out-of-band (not emailed —
  avoids depending on SMTP, consistent with why password login exists).

## Task checklist

- [x] `lib/email/components/reset-password.tsx` + `lib/email/templates/reset-password.ts` (mirrors `magic-link.tsx`/`.ts`)
- [x] `lib/auth.ts` — `sendResetPassword` callback + audit call
- [x] `lib/auth.ts` — extend `hooks.before` to gate reset endpoints on `passwordLoginEnabled`
- [x] `app/(auth)/forgot-password/page.tsx` — request form
- [x] `app/(auth)/reset-password/page.tsx` — new-password form, token from search params
- [x] `auth-form.tsx` — "Forgot password?" link (password mode only)
- [x] Update `docs/authentication.md` § 2 "Password Rules" — remove the
      "no self-service reset yet" caveat once shipped
- [x] Manual test: request reset for a real inbox (dev SMTP-less console
      log), click the link, set a new password, confirm old password no
      longer works and new one does
- [x] Manual test: request reset for a non-existent email — confirm the
      same generic success message shows (no enumeration leak)
- [x] Reused for admin-invite password setup (`lib/password-setup-token.ts`,
      `app/api/users/route.ts`) — not part of the original plan, but the
      same primitive turned out to also close the invite-flow gap
- [ ] (#2, not built) `/admin/users` reset-password button + route + dialog
      for an admin directly resetting an existing user's password

## Out of scope

- 2FA/TOTP recovery codes (separate, larger feature — not related to this)
- "Change password while logged in" (account settings) — different flow,
  could be a fast follow once reset exists, reusing `resetPassword`'s
  underlying hashing but via `authClient.changePassword` instead (no email
  needed since the user is already authenticated)
