"use client";

import {
  ChatCircleDotsIcon,
  MagnifyingGlassIcon,
  UserIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SearchableSelect } from "@/components/common/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/lib/ticket-config";
import { cn } from "@/lib/utils";

interface Props {
  categories: TicketCategory[];
  priorities: TicketPriority[];
  statuses: TicketStatus[];
}

export function TicketFilters({ statuses, categories, priorities }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = searchParams.get("status") ?? "all";
  const category = searchParams.get("category") ?? "all";
  const priority = searchParams.get("priority") ?? "all";
  const awaiting = searchParams.get("awaiting") === "1";
  const mine = searchParams.get("mine") === "1";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === "all") {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      }
      params.delete("page"); // reset pagination on filter change
      router.push(`/tickets?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    // Already in sync with the URL — do nothing. Without this guard, each
    // router.push() yields a new searchParams (and thus a new updateParams),
    // which re-triggers this effect and causes an infinite navigation loop.
    const current = searchParams.get("q") ?? "";
    if (q === current) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      updateParams({ q });
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [q, searchParams, updateParams]);

  const statusMap = Object.fromEntries(statuses.map((s) => [s.slug, s.label]));
  const categoryMap = Object.fromEntries(
    categories.map((c) => [c.slug, c.label])
  );
  const priorityMap = Object.fromEntries(
    priorities.map((p) => [p.slug, p.label])
  );

  const activeFilters = [
    status !== "all" && { key: "status", label: statusMap[status] ?? status },
    category !== "all" && {
      key: "category",
      label: categoryMap[category] ?? category,
    },
    priority !== "all" && {
      key: "priority",
      label: priorityMap[priority] ?? priority,
    },
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-56">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            className={cn("h-10 pl-9", q && "pr-9")}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tickets, customers…"
            value={q}
          />
          {q && (
            <button
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={() => setQ("")}
              type="button"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <SearchableSelect
          onValueChange={(v) => updateParams({ status: v })}
          options={[
            { value: "all", label: "All Statuses" },
            ...statuses.map((s) => ({ value: s.slug, label: s.label })),
          ]}
          placeholder="All Statuses"
          searchPlaceholder="Search status…"
          triggerClassName="w-40"
          value={status}
        />

        {/* Category filter */}
        <SearchableSelect
          onValueChange={(v) => updateParams({ category: v })}
          options={[
            { value: "all", label: "All Categories" },
            ...categories.map((c) => ({ value: c.slug, label: c.label })),
          ]}
          placeholder="All Categories"
          searchPlaceholder="Search category…"
          triggerClassName="w-44"
          value={category}
        />

        {/* Priority filter */}
        <SearchableSelect
          onValueChange={(v) => updateParams({ priority: v })}
          options={[
            { value: "all", label: "All Priorities" },
            ...priorities.map((p) => ({ value: p.slug, label: p.label })),
          ]}
          placeholder="All Priorities"
          searchPlaceholder="Search priority…"
          triggerClassName="w-40"
          value={priority}
        />

        {/* Assigned to me toggle */}
        <button
          aria-pressed={mine}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 h-10 text-sm font-medium transition-colors",
            mine
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
          onClick={() => updateParams({ mine: mine ? "" : "1" })}
          type="button"
        >
          <UserIcon className="size-4" weight={mine ? "fill" : "regular"} />
          Assigned to me
        </button>

        {/* Awaiting reply toggle */}
        <button
          aria-pressed={awaiting}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 h-10 text-sm font-medium transition-colors",
            awaiting
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
          onClick={() => updateParams({ awaiting: awaiting ? "" : "1" })}
          type="button"
        >
          <ChatCircleDotsIcon
            className="size-4"
            weight={awaiting ? "fill" : "regular"}
          />
          Awaiting reply
        </button>
      </div>

      {/* Active filter chips */}
      {(activeFilters.length > 0 || awaiting || mine) && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((f) => (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-medium text-foreground"
              key={f.key}
            >
              {f.label}
              <button
                className="ml-0.5 hover:text-foreground/60"
                onClick={() => updateParams({ [f.key]: "all" })}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <Button
            className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setQ("");
              updateParams({
                q: "",
                status: "all",
                category: "all",
                priority: "all",
                awaiting: "",
                mine: "",
              });
            }}
            size="sm"
            variant="ghost"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
