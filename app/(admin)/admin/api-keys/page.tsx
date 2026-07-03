import { listApiKeys } from "@/lib/api-keys";
import { requireAdmin } from "@/lib/authz";
import { ApiKeysManager } from "./_components/api-keys-manager";

export const metadata = { title: "API Keys" };

export default async function ApiKeysPage() {
  await requireAdmin();
  const keys = await listApiKeys();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <ApiKeysManager
        initialKeys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          createdByName: k.createdByName,
          lastUsedAt: k.lastUsedAt,
          revokedAt: k.revokedAt,
          createdAt: k.createdAt,
        }))}
      />
    </div>
  );
}
