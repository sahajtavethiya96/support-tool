export async function userInvitedTemplate(props: {
  inviteeName: string;
  role: string;
  signInUrl: string;
  appName: string;
  /** When set (password login is enabled), the primary CTA sets up a
   * password instead of linking straight to /login — a fresh invite has no
   * credential account yet, so a bare sign-in link would leave the invitee
   * with no way in unless another method (magic link/Google) is enabled. */
  passwordSetupUrl?: string;
}) {
  const { inviteeName, role, signInUrl, appName, passwordSetupUrl } = props;
  const roleLabel = role === "admin" ? "Admin" : "Agent";
  const ctaUrl = passwordSetupUrl ?? signInUrl;
  const ctaLabel = passwordSetupUrl
    ? "Set Your Password"
    : `Sign In to ${appName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited</title>
</head>
<body style="margin:0;padding:0;background:#F7F9FB;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FB;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#384959;padding:32px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${appName}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#384959;">You've been invited!</p>
              <p style="margin:0 0 24px;font-size:15px;color:#6A89A7;line-height:1.6;">
                Hi ${inviteeName}, you've been added to ${appName} as an <strong>${roleLabel}</strong>. ${passwordSetupUrl ? "Set a password below to access your account." : "Sign in below to access your account."}
              </p>

              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td>
                    <a href="${ctaUrl}" style="display:inline-block;background:#384959;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:13px;color:#6A89A7;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0;font-size:12px;color:#384959;word-break:break-all;">
                <a href="${ctaUrl}" style="color:#384959;">${ctaUrl}</a>
              </p>
              ${
                passwordSetupUrl
                  ? `<p style="margin:16px 0 0;font-size:12px;color:#6A89A7;">This link expires in 7 days.</p>`
                  : ""
              }
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #BDDDFC;">
              <p style="margin:0;font-size:12px;color:#6A89A7;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `You've been invited to ${appName} as ${roleLabel}.

Hi ${inviteeName},

${passwordSetupUrl ? "Set a password here" : "Sign in here"}: ${ctaUrl}
${passwordSetupUrl ? "This link expires in 7 days.\n" : ""}
If you weren't expecting this, you can safely ignore this email.`;

  return { html, text };
}
