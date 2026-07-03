import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/authz";
import { env } from "@/lib/env";

// GET /api/admin/api-keys/postman — downloads a ready-to-import Postman
// collection for the public API (app/api/v1/*), pre-filled with this
// instance's own base_url. No secrets in the file — the api_key variable
// is a placeholder the admin fills in with a real key from /admin/api-keys.
export async function GET(request: NextRequest) {
  try {
    requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  const baseUrl = env.NEXT_PUBLIC_APP_URL;

  const collection = {
    info: {
      name: "Support Tool API",
      description:
        "Create and look up tickets via the Support Tool public API. " +
        "Set the `api_key` collection variable to a key generated at " +
        "/admin/api-keys before sending requests. See docs/api.md.",
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: {
      type: "bearer",
      bearer: [{ key: "token", value: "{{api_key}}", type: "string" }],
    },
    variable: [
      { key: "base_url", value: baseUrl, type: "string" },
      {
        key: "api_key",
        value: "sk_live_xxxxxxxxxxxxxxxxxxxxxxxx",
        type: "string",
      },
      { key: "ticket_id", value: "", type: "string" },
      { key: "customer_email", value: "jane@example.com", type: "string" },
    ],
    item: [
      {
        name: "Get Config (categories, priorities, statuses)",
        request: {
          method: "GET",
          url: {
            raw: "{{base_url}}/api/v1/config",
            host: ["{{base_url}}"],
            path: ["api", "v1", "config"],
          },
        },
      },
      {
        name: "Create Ticket",
        request: {
          method: "POST",
          header: [{ key: "Content-Type", value: "application/json" }],
          body: {
            mode: "raw",
            raw: JSON.stringify(
              {
                name: "Jane Doe",
                email: "jane@example.com",
                subject: "Cannot log in",
                description: "I get an error when I try to sign in.",
                category: "bug",
              },
              null,
              2
            ),
          },
          url: {
            raw: "{{base_url}}/api/v1/tickets",
            host: ["{{base_url}}"],
            path: ["api", "v1", "tickets"],
          },
        },
        event: [
          {
            listen: "test",
            script: {
              type: "text/javascript",
              exec: [
                "if (pm.response.code === 201) {",
                "  const body = pm.response.json();",
                "  pm.collectionVariables.set('ticket_id', body.id);",
                "}",
              ],
            },
          },
        ],
      },
      {
        name: "Get Ticket Status",
        request: {
          method: "GET",
          url: {
            raw: "{{base_url}}/api/v1/tickets/{{ticket_id}}",
            host: ["{{base_url}}"],
            path: ["api", "v1", "tickets", "{{ticket_id}}"],
          },
        },
      },
      {
        name: "Get Ticket Comments",
        request: {
          method: "GET",
          url: {
            raw: "{{base_url}}/api/v1/tickets/{{ticket_id}}/comments",
            host: ["{{base_url}}"],
            path: ["api", "v1", "tickets", "{{ticket_id}}", "comments"],
          },
        },
      },
      {
        name: "List Tickets by Email",
        request: {
          method: "GET",
          url: {
            raw: "{{base_url}}/api/v1/tickets?email={{customer_email}}",
            host: ["{{base_url}}"],
            path: ["api", "v1", "tickets"],
            query: [{ key: "email", value: "{{customer_email}}" }],
          },
        },
      },
    ],
  };

  return NextResponse.json(collection, {
    headers: {
      "Content-Disposition":
        'attachment; filename="support-tool-api.postman_collection.json"',
    },
  });
}
