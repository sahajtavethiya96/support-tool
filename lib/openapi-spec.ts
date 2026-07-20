// OpenAPI 3.1 specification for the public API (app/api/v1/*).
//
// This is the canonical machine-readable contract. It is rendered by the
// Scalar reference at /admin/api-keys/docs, downloadable from
// GET /api/admin/api-keys/openapi (importable into Postman and most other
// tooling), and it must be kept in sync with docs/api.md and the route
// implementations when the API changes.
//
// Hand-authored on purpose: the surface is five operations, so a generator
// pipeline (zod-to-openapi etc.) would be more machinery than value. Revisit
// if the v1 surface grows.

const ERROR_SCHEMA = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "string",
      description: "Human-readable message describing what went wrong.",
    },
  },
} as const;

const TICKET_SUMMARY_SCHEMA = {
  type: "object",
  required: [
    "id",
    "ticketNumber",
    "subject",
    "status",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: {
      type: "string",
      description: "Ticket id (cuid2). Use it for the other ticket endpoints.",
      examples: ["cku1a2b3c4d5e6f"],
    },
    ticketNumber: {
      type: "integer",
      description: "Human-friendly sequential number, as shown to agents.",
      examples: [1042],
    },
    subject: { type: "string", examples: ["Cannot log in"] },
    status: {
      type: "string",
      description:
        "Status slug. The set is deployment-specific and admin-configurable — resolve labels via `GET /api/v1/config` instead of hardcoding.",
      examples: ["in_progress"],
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

/**
 * Build the OpenAPI document with this instance's own base URL as the
 * default server — same pattern as the Postman collection route.
 */
export function buildOpenApiSpec(baseUrl: string): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Support Tool API",
      version: "1.0.0",
      summary: "Create and look up support tickets from your own backend.",
      description: [
        "Support Tool exposes a small REST API so your own website's backend can create tickets without sending customers through the customer portal form.",
        "",
        "This is a **server-to-server** API: your backend calls it with a secret API key. Don't call it directly from a customer's browser — the key would be exposed to anyone who opens your page's network tab.",
        "",
        "## Authentication",
        "",
        "Generate a key from `/admin/api-keys` (admin only). You'll see the raw key exactly once, at creation — copy it somewhere safe immediately. Support Tool only ever stores a hash of it; if you lose it, revoke it and create a new one. Send it as a bearer token on every request. A missing, invalid, or revoked key gets a `401`.",
        "",
        "## Rate limits",
        "",
        "Ticket creation is limited to **100 requests per minute per key**. A `429` means you've hit it — back off and retry after a moment.",
        "",
        "## Errors",
        "",
        'Every error response is `{ "error": "<message>" }` with an appropriate HTTP status (`400` validation, `401` auth, `404` not found, `429` rate limited, `500` server error).',
        "",
        "## Not supported yet",
        "",
        "File attachments, posting replies through the API, webhooks, and a client-side/embeddable widget. See the ticket's `portalUrl` for everything the API doesn't cover — the customer can reply and track the ticket there with zero extra work on your end.",
      ].join("\n"),
    },
    servers: [
      {
        url: baseUrl,
        description: "This Support Tool instance",
      },
    ],
    security: [{ apiKey: [] }],
    tags: [
      {
        name: "Configuration",
        description:
          "Deployment-specific slugs (categories, priorities, statuses). Fetch once and cache — admins can rename or reorder them at runtime.",
      },
      {
        name: "Tickets",
        description: "Create tickets and read their status and conversation.",
      },
    ],
    paths: {
      "/api/v1/config": {
        get: {
          tags: ["Configuration"],
          operationId: "getConfig",
          summary: "Get categories, priorities and statuses",
          description:
            "The current valid category, priority, and status slugs — fetch this once (and cache it) to build a ticket form or interpret a `status` value, instead of hardcoding slugs an admin could rename or reorder later. Arrays are pre-sorted in display order (the same order agents see in the app).",
          responses: {
            "200": {
              description: "Current configuration.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Config" },
                  example: {
                    categories: [{ slug: "bug", label: "Bug", color: "red" }],
                    priorities: [
                      {
                        slug: "normal",
                        label: "Normal",
                        color: "slate",
                        isDefault: true,
                      },
                    ],
                    statuses: [
                      {
                        slug: "open",
                        label: "Open",
                        color: "blue",
                        isDefault: true,
                        isClosedState: false,
                      },
                    ],
                    customFields: [
                      {
                        key: "order_id",
                        label: "Order ID",
                        type: "text",
                        required: false,
                      },
                    ],
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/v1/tickets": {
        post: {
          tags: ["Tickets"],
          operationId: "createTicket",
          summary: "Create a ticket",
          description: [
            "Create a ticket on behalf of a customer. The customer gets the standard confirmation email, which links to the returned `portalUrl` — they can reply and track the ticket there without any extra work on your end.",
            "",
            "**Editor-agnostic by design.** Ticket descriptions are rich text internally, but you don't need to speak the internal format. Send plain text (the default), or set `descriptionFormat: \"html\"` and send whatever your own editor exports (Quill, TipTap, TinyMCE, CKEditor, Lexical, Slate…). HTML is parsed strictly through Support Tool's own schema — any tag or attribute it doesn't recognize (scripts, event handlers, unknown elements) is simply dropped, never stored or trusted as-is.",
          ].join("\n"),
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateTicketRequest" },
                examples: {
                  plainText: {
                    summary: "Plain text (default)",
                    value: {
                      name: "Jane Doe",
                      email: "jane@example.com",
                      subject: "Cannot log in",
                      description: "I get an error when I try to sign in.",
                      category: "bug",
                    },
                  },
                  html: {
                    summary: "HTML from your own editor",
                    value: {
                      name: "Jane Doe",
                      email: "jane@example.com",
                      subject: "Cannot log in",
                      description:
                        "<p>I get an error when I try to sign in.</p><p><strong>It started this morning.</strong></p>",
                      descriptionFormat: "html",
                      category: "bug",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Ticket created.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CreateTicketResponse" },
                  example: {
                    id: "cku1a2b3c4d5e6f",
                    ticketNumber: 1042,
                    status: "open",
                    portalUrl:
                      "https://support.example.com/ticket/cku1a2b3c4d5e6f?token=...",
                  },
                },
              },
            },
            "400": {
              description:
                "Validation failed. The message says which field: name must be 2–100 characters, email must be valid, subject 5–200 characters, description 10–5000 characters (measured after formatting is stripped), `category`/`priority` must match a configured slug, and the body must be valid JSON.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                  example: { error: "Subject must be 5–200 characters." },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "429": {
              description:
                "Rate limited — more than 100 ticket creations in a minute on this key. Back off and retry.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                  example: {
                    error: "Too many requests. Please try again later.",
                  },
                },
              },
            },
            "500": {
              description: "Unexpected server error. Nothing was created.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                  example: { error: "Failed to create ticket." },
                },
              },
            },
          },
        },
        get: {
          tags: ["Tickets"],
          operationId: "listTicketsByEmail",
          summary: "List a customer's tickets",
          description:
            'List a customer\'s tickets, most recent first — e.g. to show "Your Tickets" on your own site. Returns up to 50; there is no pagination yet. Matches on exact, case-sensitive equality against the email the ticket was created with — an empty `tickets` array just means no match, not an error.',
          parameters: [
            {
              name: "email",
              in: "query",
              required: true,
              description: "Customer email the tickets were created with.",
              schema: { type: "string", format: "email" },
              example: "jane@example.com",
            },
          ],
          responses: {
            "200": {
              description: "The customer's tickets (possibly empty).",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["tickets"],
                    properties: {
                      tickets: {
                        type: "array",
                        maxItems: 50,
                        items: { $ref: "#/components/schemas/TicketSummary" },
                      },
                    },
                  },
                  example: {
                    tickets: [
                      {
                        id: "cku1a2b3c4d5e6f",
                        ticketNumber: 1042,
                        subject: "Cannot log in",
                        status: "in_progress",
                        createdAt: "2026-07-01T10:00:00.000Z",
                        updatedAt: "2026-07-02T09:15:00.000Z",
                      },
                    ],
                  },
                },
              },
            },
            "400": {
              description: "The `email` query parameter is missing.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                  example: { error: "Query parameter 'email' is required." },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/v1/tickets/{id}": {
        get: {
          tags: ["Tickets"],
          operationId: "getTicket",
          summary: "Get a ticket's status",
          description:
            'Look up a ticket\'s current status — e.g. to show "In Progress" on your own site without redirecting to the portal. Any active API key can read any ticket on your instance; there is no per-key scoping, since a self-hosted deployment belongs to one owner.',
          parameters: [{ $ref: "#/components/parameters/TicketId" }],
          responses: {
            "200": {
              description: "The ticket.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TicketSummary" },
                  example: {
                    id: "cku1a2b3c4d5e6f",
                    ticketNumber: 1042,
                    subject: "Cannot log in",
                    status: "in_progress",
                    createdAt: "2026-07-01T10:00:00.000Z",
                    updatedAt: "2026-07-02T09:15:00.000Z",
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/api/v1/tickets/{id}/comments": {
        get: {
          tags: ["Tickets"],
          operationId: "getTicketComments",
          summary: "Get a ticket's conversation",
          description: [
            "Read the conversation thread — e.g. to show ticket replies on your own site, not just its status. Only public replies are returned; internal agent notes never are (same rule the customer portal itself enforces). Comments are ordered oldest first.",
            "",
            "Replies are stored as rich text internally — `content` is that flattened to plain text; `html` renders the same content with formatting intact, safe to insert into a page (it is generated from Support Tool's own stored document, not arbitrary external HTML). Use whichever fits where you're displaying it.",
          ].join("\n"),
          parameters: [{ $ref: "#/components/parameters/TicketId" }],
          responses: {
            "200": {
              description: "The public conversation, oldest first.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["comments"],
                    properties: {
                      comments: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Comment" },
                      },
                    },
                  },
                  example: {
                    comments: [
                      {
                        id: "ckv2b3c4d5e6f7g",
                        authorName: "Alex (Support)",
                        authorRole: "agent",
                        content:
                          "Thanks for reaching out — looking into this now.",
                        html: "<p>Thanks for reaching out — looking into this now.</p>",
                        createdAt: "2026-07-01T11:30:00.000Z",
                      },
                    ],
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          description:
            "An API key generated at `/admin/api-keys`, e.g. `stk_live_xxxxxxxxxxxxxxxxxxxxxxxx`. Sent as `Authorization: Bearer <key>`.",
        },
      },
      parameters: {
        TicketId: {
          name: "id",
          in: "path",
          required: true,
          description:
            "The ticket id (cuid2) returned when the ticket was created.",
          schema: { type: "string" },
          example: "cku1a2b3c4d5e6f",
        },
      },
      responses: {
        Unauthorized: {
          description: "The API key is missing, invalid, or revoked.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { error: "Invalid or revoked API key." },
            },
          },
        },
        NotFound: {
          description: "No ticket with that id exists.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Error" },
              example: { error: "Not found." },
            },
          },
        },
      },
      schemas: {
        Error: ERROR_SCHEMA,
        TicketSummary: TICKET_SUMMARY_SCHEMA,
        CreateTicketRequest: {
          type: "object",
          required: ["name", "email", "subject", "description", "category"],
          properties: {
            name: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              description: "Customer's name.",
              examples: ["Jane Doe"],
            },
            email: {
              type: "string",
              format: "email",
              description:
                "Customer's email. The confirmation email (with the portal link) goes here.",
              examples: ["jane@example.com"],
            },
            subject: {
              type: "string",
              minLength: 5,
              maxLength: 200,
              examples: ["Cannot log in"],
            },
            description: {
              type: "string",
              description:
                "The ticket body: plain text by default, or HTML when `descriptionFormat` is `html`. Length limits (10–5000) are measured on the visible text after formatting is stripped.",
              examples: ["I get an error when I try to sign in."],
            },
            descriptionFormat: {
              type: "string",
              enum: ["text", "html"],
              default: "text",
              description:
                "How to interpret `description`. With `html`, unrecognized tags and attributes are dropped during conversion — send whatever your editor exports.",
            },
            category: {
              type: "string",
              description:
                "A category slug from `GET /api/v1/config` — the set is deployment-specific, don't hardcode it.",
              examples: ["bug"],
            },
            priority: {
              type: "string",
              description:
                "Optional priority slug from `GET /api/v1/config`. Falls back to the platform's default priority when omitted.",
            },
            customFields: {
              type: "object",
              description:
                "`{ \"<key>\": <value> }` map for admin-defined custom fields (see `GET /api/v1/config`'s `customFields`). Required fields are only enforced if this object is included at all — omit it entirely to skip custom fields, so adding a required one later can't break an integration that never sends it.",
              additionalProperties: true,
              examples: [{ order_id: "A-1042", plan: "Pro" }],
            },
          },
        },
        CreateTicketResponse: {
          type: "object",
          required: ["id", "ticketNumber", "status", "portalUrl"],
          properties: {
            id: { type: "string", description: "Ticket id (cuid2)." },
            ticketNumber: { type: "integer" },
            status: {
              type: "string",
              description: "The deployment's default (initial) status slug.",
            },
            portalUrl: {
              type: "string",
              format: "uri",
              description:
                "Tokenized customer portal link for this ticket — the same link the confirmation email contains. The customer can reply and track the ticket there; no account needed.",
            },
          },
        },
        Comment: {
          type: "object",
          required: [
            "id",
            "authorName",
            "authorRole",
            "content",
            "html",
            "createdAt",
          ],
          properties: {
            id: { type: "string", description: "Comment id (cuid2)." },
            authorName: { type: "string", examples: ["Alex (Support)"] },
            authorRole: {
              type: "string",
              enum: ["customer", "agent", "admin"],
            },
            content: {
              type: "string",
              description: "The reply flattened to plain text.",
            },
            html: {
              type: "string",
              description:
                "The same reply rendered as HTML (generated from Support Tool's own stored document — only tags its editor can produce ever appear).",
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Config: {
          type: "object",
          required: ["categories", "priorities", "statuses", "customFields"],
          properties: {
            categories: {
              type: "array",
              description: "In display order.",
              items: {
                type: "object",
                required: ["slug", "label", "color"],
                properties: {
                  slug: { type: "string", examples: ["bug"] },
                  label: { type: "string", examples: ["Bug"] },
                  color: { type: "string", examples: ["red"] },
                },
              },
            },
            priorities: {
              type: "array",
              description: "In display order.",
              items: {
                type: "object",
                required: ["slug", "label", "color", "isDefault"],
                properties: {
                  slug: { type: "string", examples: ["normal"] },
                  label: { type: "string", examples: ["Normal"] },
                  color: { type: "string", examples: ["slate"] },
                  isDefault: {
                    type: "boolean",
                    description:
                      "Used when a ticket is created without an explicit priority.",
                  },
                },
              },
            },
            statuses: {
              type: "array",
              description: "In display order.",
              items: {
                type: "object",
                required: [
                  "slug",
                  "label",
                  "color",
                  "isDefault",
                  "isClosedState",
                ],
                properties: {
                  slug: { type: "string", examples: ["open"] },
                  label: { type: "string", examples: ["Open"] },
                  color: { type: "string", examples: ["blue"] },
                  isDefault: {
                    type: "boolean",
                    description: "The status new tickets start in.",
                  },
                  isClosedState: {
                    type: "boolean",
                    description:
                      "Whether this status counts as closed/resolved.",
                  },
                },
              },
            },
            customFields: {
              type: "array",
              description:
                "Admin-defined custom fields, in display order (empty if none configured). Send matching values in `POST /api/v1/tickets`'s `customFields`.",
              items: {
                type: "object",
                required: ["key", "label", "type", "required"],
                properties: {
                  key: {
                    type: "string",
                    description: "Stable machine key — the JSON key to send.",
                    examples: ["order_id"],
                  },
                  label: { type: "string", examples: ["Order ID"] },
                  type: {
                    type: "string",
                    enum: ["text", "number", "date", "checkbox", "select"],
                  },
                  options: {
                    type: "array",
                    items: { type: "string" },
                    description: "Only present when `type` is `select`.",
                  },
                  required: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
  };
}
