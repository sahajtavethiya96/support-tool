import {
  ArrowLeftIcon,
  DownloadSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/authz";
import { CodeBlock } from "./_components/code-block";
import { MethodBadge } from "./_components/method-badge";

export const metadata = { title: "API Docs" };

const CURL_CONFIG = `curl https://support.example.com/api/v1/config \\
  -H "Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx"`;

const RESPONSE_CONFIG = `{
  "categories": [{ "slug": "bug", "label": "Bug", "color": "red" }],
  "priorities": [
    { "slug": "normal", "label": "Normal", "color": "slate", "isDefault": true }
  ],
  "statuses": [
    {
      "slug": "open",
      "label": "Open",
      "color": "blue",
      "isDefault": true,
      "isClosedState": false
    }
  ]
}`;

const CURL_CREATE = `curl -X POST https://support.example.com/api/v1/tickets \\
  -H "Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "subject": "Cannot log in",
    "description": "I get an error when I try to sign in.",
    "category": "bug"
  }'`;

const JS_CREATE = `// Plain text (default) — descriptionFormat omitted
await fetch("https://support.example.com/api/v1/tickets", {
  method: "POST",
  headers: {
    Authorization: "Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Jane Doe",
    email: "jane@example.com",
    subject: "Cannot log in",
    description: "I get an error when I try to sign in.",
    category: "bug",
  }),
});

// HTML from your own editor
await fetch("https://support.example.com/api/v1/tickets", {
  method: "POST",
  headers: {
    Authorization: "Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Jane Doe",
    email: "jane@example.com",
    subject: "Cannot log in",
    description: "<p>I get an error when I try to sign in.</p><p><strong>It started this morning.</strong></p>",
    descriptionFormat: "html",
    category: "bug",
  }),
});`;

const RESPONSE_CREATE = `{
  "id": "cku1a2b3c4d5e6f",
  "ticketNumber": 1042,
  "status": "open",
  "portalUrl": "https://support.example.com/ticket/cku1a2b3c4d5e6f?token=..."
}`;

const CURL_GET = `curl https://support.example.com/api/v1/tickets/cku1a2b3c4d5e6f \\
  -H "Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx"`;

const RESPONSE_GET = `{
  "id": "cku1a2b3c4d5e6f",
  "ticketNumber": 1042,
  "subject": "Cannot log in",
  "status": "in_progress",
  "createdAt": "2026-07-01T10:00:00.000Z",
  "updatedAt": "2026-07-02T09:15:00.000Z"
}`;

const ERROR_EXAMPLE = `{ "error": "Invalid category." }`;

const CURL_COMMENTS = `curl https://support.example.com/api/v1/tickets/cku1a2b3c4d5e6f/comments \\
  -H "Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx"`;

const RESPONSE_COMMENTS = `{
  "comments": [
    {
      "id": "ckv2b3c4d5e6f7g",
      "authorName": "Alex (Support)",
      "authorRole": "agent",
      "content": "Thanks for reaching out — looking into this now.",
      "html": "<p>Thanks for reaching out — looking into this now.</p>",
      "createdAt": "2026-07-01T11:30:00.000Z"
    }
  ]
}`;

const CURL_LIST = `curl "https://support.example.com/api/v1/tickets?email=jane@example.com" \\
  -H "Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx"`;

const RESPONSE_LIST = `{
  "tickets": [
    {
      "id": "cku1a2b3c4d5e6f",
      "ticketNumber": 1042,
      "subject": "Cannot log in",
      "status": "in_progress",
      "createdAt": "2026-07-01T10:00:00.000Z",
      "updatedAt": "2026-07-02T09:15:00.000Z"
    }
  ]
}`;

const PARAMS = [
  { field: "name", required: true, notes: "Customer's name, 2–100 characters" },
  { field: "email", required: true, notes: "Customer's email" },
  { field: "subject", required: true, notes: "5–200 characters" },
  {
    field: "description",
    required: true,
    notes:
      "10–5000 characters (counted after formatting is stripped), see note below",
  },
  {
    field: "descriptionFormat",
    required: false,
    notes: '"text" (default) or "html"',
  },
  {
    field: "category",
    required: true,
    notes: "Must match a category slug configured in /admin/ticket-config",
  },
  {
    field: "priority",
    required: false,
    notes:
      "Must match a priority slug if given; falls back to the platform's default priority",
  },
];

const UNSUPPORTED = [
  "File attachments — create the ticket via the API, then have the customer attach files from the portal link if needed.",
  "Posting additional replies through the API (continuing a conversation from your own widget). When this ships, expect the same descriptionFormat-style text/html input as ticket creation. In the meantime, the html field on GET .../comments is read-only enrichment of our own replies, not something you can send back; send the customer the ticket's portalUrl if they need to keep replying with formatting.",
  "Webhooks — no way yet to get notified when an agent replies or a status changes. Poll GET /api/v1/tickets/:id/comments if you need that today.",
  "A client-side/embeddable widget — the API is designed to be called from your backend, not a browser.",
];

export default async function ApiDocsPage() {
  await requireAdmin();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        href="/admin/api-keys"
      >
        <ArrowLeftIcon className="size-3.5" />
        API Keys
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            API Documentation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create tickets from your own website's backend without sending
            customers through the customer portal form.
          </p>
        </div>
        <Button
          asChild
          className="border-border text-foreground hover:bg-accent rounded-md gap-1.5 shrink-0"
          size="sm"
          variant="outline"
        >
          <a download href="/api/admin/api-keys/postman">
            <DownloadSimpleIcon className="size-4" />
            Postman Collection
          </a>
        </Button>
      </div>

      {/* Warning */}
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <WarningCircleIcon className="size-5 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          This is a <strong>server-to-server</strong> API. Call it from your
          backend — never from a customer's browser, or your key will be exposed
          in the page's network tab.
        </p>
      </div>

      {/* Authentication */}
      <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Authentication
        </h2>
        <p className="text-sm text-muted-foreground">
          Generate a key from{" "}
          <Link className="text-primary underline" href="/admin/api-keys">
            API Keys
          </Link>{" "}
          (admin only). You'll see the raw key exactly once, at creation — copy
          it somewhere safe immediately. Support Tool only stores a hash of it,
          so it can't be shown to you again; if you lose it, revoke it and
          create a new one.
        </p>
        <p className="text-sm text-muted-foreground">
          Send it as a bearer token on every request:
        </p>
        <CodeBlock code="Authorization: Bearer stk_live_xxxxxxxxxxxxxxxxxxxxxxxx" />
        <p className="text-sm text-muted-foreground">
          A missing, invalid, or revoked key gets a{" "}
          <code className="text-xs bg-muted rounded px-1 py-0.5">401</code>.
        </p>
      </section>

      {/* Rate limits + errors */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            Rate Limits
          </h2>
          <p className="text-sm text-muted-foreground">
            100 requests per minute per key. A{" "}
            <code className="text-xs bg-muted rounded px-1 py-0.5">429</code>{" "}
            means you've hit it — back off and retry after a moment.
          </p>
        </section>
        <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-2">
          <h2 className="text-base font-semibold text-foreground">Errors</h2>
          <p className="text-sm text-muted-foreground">
            Every error is shaped the same way, with an appropriate status (400,
            401, 404, 429, 500):
          </p>
          <CodeBlock code={ERROR_EXAMPLE} />
        </section>
      </div>

      {/* Endpoint: config */}
      <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <MethodBadge method="GET" />
          <code className="text-sm font-medium text-foreground">
            /api/v1/config
          </code>
        </div>
        <p className="text-sm text-muted-foreground">
          The current valid category, priority, and status slugs — fetch this
          once (cache it) to build a ticket form or interpret a{" "}
          <code className="text-xs">status</code> value, instead of hardcoding
          slugs an admin could rename or reorder later. Arrays are pre-sorted in
          display order.
        </p>

        <CodeBlock code={CURL_CONFIG} label="cURL" />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Response — 200 OK
          </p>
          <CodeBlock code={RESPONSE_CONFIG} />
        </div>
      </section>

      {/* Endpoint: create ticket */}
      <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <MethodBadge method="POST" />
          <code className="text-sm font-medium text-foreground">
            /api/v1/tickets
          </code>
        </div>
        <p className="text-sm text-muted-foreground">Create a ticket.</p>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-accent/50">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Field
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Required
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {PARAMS.map((p) => (
                <tr key={p.field}>
                  <td className="px-3 py-2 font-mono text-xs text-foreground whitespace-nowrap">
                    {p.field}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.required ? (
                      <span className="text-xs font-medium text-foreground">
                        Yes
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {p.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <WarningCircleIcon className="size-5 shrink-0 text-blue-600" />
          <p className="text-sm text-blue-800">
            <strong>Editor-agnostic by design.</strong> Ticket descriptions are
            rich text internally (same as replies), but you don't need to speak
            our internal format to submit one. Send plain text (the default), or
            set <code className="text-xs">descriptionFormat: "html"</code> and
            send whatever your own editor exports — Quill, TipTap, TinyMCE,
            CKEditor, Lexical, Slate, all of them can export HTML. We convert it
            server-side, safely: your HTML is parsed strictly through Support
            Tool's own schema, so any tag or attribute it doesn't recognize
            (scripts, event handlers, unknown elements) is simply dropped, never
            stored or trusted as-is. If your form is a plain textarea, just send
            plain text — no conversion needed either way.
          </p>
        </div>

        <CodeBlock code={CURL_CREATE} label="cURL" />
        <CodeBlock code={JS_CREATE} label="JavaScript" />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Response — 201 Created
          </p>
          <CodeBlock code={RESPONSE_CREATE} />
        </div>

        <p className="text-sm text-muted-foreground">
          The customer also gets the standard confirmation email, which links to
          the same <code className="text-xs">portalUrl</code> — they can reply
          and track the ticket there without any extra work on your end. Fetch{" "}
          <code className="text-xs">GET /api/v1/config</code> to get the current{" "}
          <code className="text-xs">category</code>/
          <code className="text-xs">priority</code> slugs — the set is
          deployment-specific and admin-configurable, so don't hardcode it.
        </p>
      </section>

      {/* Endpoint: get ticket */}
      <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <MethodBadge method="GET" />
          <code className="text-sm font-medium text-foreground">
            /api/v1/tickets/:id
          </code>
        </div>
        <p className="text-sm text-muted-foreground">
          Look up a ticket's current status — e.g. to show "In Progress" on your
          own site without redirecting to the portal.
        </p>

        <CodeBlock code={CURL_GET} label="cURL" />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Response — 200 OK
          </p>
          <CodeBlock code={RESPONSE_GET} />
        </div>

        <p className="text-sm text-muted-foreground">
          <code className="text-xs bg-muted rounded px-1 py-0.5">404</code> if
          the ticket doesn't exist. Any active API key can read any ticket on
          your instance — there's no per-key scoping, since a self-hosted
          deployment belongs to one owner.
        </p>
      </section>

      {/* Endpoint: get comments */}
      <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <MethodBadge method="GET" />
          <code className="text-sm font-medium text-foreground">
            /api/v1/tickets/:id/comments
          </code>
        </div>
        <p className="text-sm text-muted-foreground">
          Read the conversation thread — e.g. to show ticket replies on your own
          site, not just its status.
        </p>

        <CodeBlock code={CURL_COMMENTS} label="cURL" />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Response — 200 OK
          </p>
          <CodeBlock code={RESPONSE_COMMENTS} />
        </div>

        <p className="text-sm text-muted-foreground">
          Only public replies — internal agent notes are never returned, same
          rule the customer portal itself enforces. Replies are stored as rich
          text internally (bold, lists, links, etc.) —{" "}
          <code className="text-xs">content</code> is that flattened to plain
          text; <code className="text-xs">html</code> renders the same content
          with formatting intact, safe to insert into a page (it's generated
          from our own stored document, not arbitrary external HTML). Use
          whichever fits where you're displaying it.{" "}
          <code className="text-xs bg-muted rounded px-1 py-0.5">404</code> if
          the ticket doesn't exist.
        </p>
      </section>

      {/* Endpoint: list tickets by email */}
      <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <MethodBadge method="GET" />
          <code className="text-sm font-medium text-foreground">
            /api/v1/tickets?email=
          </code>
        </div>
        <p className="text-sm text-muted-foreground">
          List a customer's tickets, most recent first — e.g. to show "Your
          Tickets" on your own site. Returns up to 50; there's no pagination
          yet.
        </p>

        <CodeBlock code={CURL_LIST} label="cURL" />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Response — 200 OK
          </p>
          <CodeBlock code={RESPONSE_LIST} />
        </div>

        <p className="text-sm text-muted-foreground">
          <code className="text-xs bg-muted rounded px-1 py-0.5">400</code> if{" "}
          <code className="text-xs">email</code> is missing. Matches on an
          exact, case-sensitive equality against the email the ticket was
          created with — an empty <code className="text-xs">tickets</code> array
          just means no match, not an error.
        </p>
      </section>

      {/* Not supported yet */}
      <section className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          What's not supported yet
        </h2>
        <ul className="space-y-2">
          {UNSUPPORTED.map((item) => (
            <li className="flex gap-2 text-sm text-muted-foreground" key={item}>
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
