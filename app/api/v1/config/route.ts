import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { getCustomFields } from "@/lib/custom-fields";
import {
  getTicketCategories,
  getTicketPriorities,
  getTicketStatuses,
} from "@/lib/ticket-config";

// GET /api/v1/config — public API, authenticated with an API key. The
// current valid category/priority/status slugs, so integrators can build a
// ticket form (or interpret a status value) without asking an admin what's
// configured — and without hardcoding slugs that break silently if an
// admin renames or reorders them later. Arrays are pre-sorted in display
// order (same order agents see in the app).
export async function GET(request: NextRequest) {
  try {
    await requireApiKey(request);
  } catch (e) {
    return e as Response;
  }

  const [categories, priorities, statuses, customFields] = await Promise.all([
    getTicketCategories(),
    getTicketPriorities(),
    getTicketStatuses(),
    getCustomFields(),
  ]);

  return NextResponse.json({
    categories: categories.map((c) => ({
      slug: c.slug,
      label: c.label,
      color: c.color,
    })),
    priorities: priorities.map((p) => ({
      slug: p.slug,
      label: p.label,
      color: p.color,
      isDefault: p.isDefault,
    })),
    statuses: statuses.map((s) => ({
      slug: s.slug,
      label: s.label,
      color: s.color,
      isDefault: s.isDefault,
      isClosedState: s.isClosedState,
    })),
    customFields: customFields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      options: f.options ?? undefined,
      required: f.required,
    })),
  });
}
