"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SearchableSelect } from "@/components/common/searchable-select";
import { PAGE_SIZE_OPTIONS } from "./page-size-options";

const OPTIONS = PAGE_SIZE_OPTIONS.map((n) => ({
  value: String(n),
  label: `${n} / page`,
}));

export function PageSizeSelect({ pageSize }: { pageSize: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", value);
    params.delete("page"); // reset pagination when the page size changes
    router.push(`/tickets?${params.toString()}`);
  }

  return (
    <SearchableSelect
      onValueChange={handleChange}
      options={OPTIONS}
      triggerClassName="h-8 w-28 text-xs"
      value={String(pageSize)}
    />
  );
}
