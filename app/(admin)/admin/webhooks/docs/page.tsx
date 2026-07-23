import { ArrowLeftIcon, FileCodeIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ScalarReference } from "@/components/common/scalar-reference";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/authz";
import { env } from "@/lib/env";
import { buildWebhooksOpenApiSpec } from "@/lib/webhooks-openapi-spec";

export const metadata = { title: "Webhooks Docs" };

// Interactive webhooks reference rendered by Scalar from the OpenAPI spec in
// lib/webhooks-openapi-spec.ts — the single source of truth for the payload
// contract. Mirrors /admin/api-keys/docs's pattern exactly, but documents
// requests Support Tool SENDS rather than ones it receives (no "Test
// Request" client makes sense here, so no preferredSecurityScheme).
export default async function WebhooksDocsPage() {
  await requireAdmin();

  const spec = buildWebhooksOpenApiSpec(env.NEXT_PUBLIC_APP_URL);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="p-6 pb-4 space-y-4 border-b border-border">
        <Link
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          href="/admin/webhooks"
        >
          <ArrowLeftIcon className="size-3.5" />
          Webhooks
        </Link>

        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Webhooks Reference
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Every event your endpoint can subscribe to, its payload shape,
              and how to verify a delivery's signature.
            </p>
          </div>
          <Button
            asChild
            size="sm"
            title="The canonical machine-readable contract — importable into most API tooling that understands OpenAPI 3.1's `webhooks` keyword"
            variant="outline"
          >
            <a download href="/api/admin/webhooks/openapi">
              <FileCodeIcon className="size-4" />
              OpenAPI Spec
            </a>
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <ScalarReference spec={spec} />
      </div>
    </div>
  );
}
