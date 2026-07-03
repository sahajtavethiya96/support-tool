"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GoToPage({ totalPages }: { totalPages: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");

  function go() {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) {
      return;
    }
    const target = Math.min(Math.max(1, n), totalPages);
    const params = new URLSearchParams(searchParams.toString());
    if (target > 1) {
      params.set("page", String(target));
    } else {
      params.delete("page");
    }
    router.push(`/tickets?${params.toString()}`);
    setValue("");
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground shrink-0">Go to page</span>
      <Input
        className="h-8 w-16 text-xs text-center px-1"
        max={totalPages}
        min={1}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            go();
          }
        }}
        type="number"
        value={value}
      />
      <Button
        className="h-8 border-border text-foreground hover:bg-accent"
        disabled={!value}
        onClick={go}
        size="sm"
        variant="outline"
      >
        Go
      </Button>
    </div>
  );
}
