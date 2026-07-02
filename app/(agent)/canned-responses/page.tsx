import { requireAgent } from "@/lib/authz";
import { getCannedResponses } from "@/lib/canned-responses";
import { CannedResponsesManager } from "./_components/canned-responses-manager";

export const metadata = { title: "Canned Responses" };

export default async function CannedResponsesPage() {
  await requireAgent();
  const responses = await getCannedResponses();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <CannedResponsesManager initialResponses={responses} />
    </div>
  );
}
