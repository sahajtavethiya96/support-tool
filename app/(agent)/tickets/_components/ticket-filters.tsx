"use client";

import {
  ChatCircleDotsIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  UserIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { SearchableSelect } from "@/components/common/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/lib/ticket-config";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "last_day", label: "Last One Day" },
  { value: "last_week", label: "Last 1 Week" },
  { value: "this_month", label: "This Month" },
];
const RANGE_LABEL = Object.fromEntries(
  RANGE_OPTIONS.map((o) => [o.value, o.label])
);

interface Props {
  categories: TicketCategory[];
  priorities: TicketPriority[];
  statuses: TicketStatus[];
}

export function TicketFilters({ statuses, categories, priorities }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = searchParams.get("status") ?? "all";
  const category = searchParams.get("category") ?? "all";
  const priority = searchParams.get("priority") ?? "all";
  const range = searchParams.get("range") ?? "all";
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
    range !== "all" && {
      key: "range",
      label: RANGE_LABEL[range] ?? range,
    },
    mine && { key: "mine", label: "Assigned to me" },
    awaiting && { key: "awaiting", label: "Awaiting reply" },
  ].filter(Boolean) as Array<{ key: string; label: string }>;

  const activeCount = activeFilters.length;

  function clearAll() {
    setQ("");
    updateParams({
      q: "",
      status: "all",
      category: "all",
      priority: "all",
      range: "all",
      awaiting: "",
      mine: "",
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
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

        {/* Filters popover */}
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                activeCount > 0
                  ? "border-primary/30 bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              type="button"
            >
              <FunnelIcon className="size-4" />
              Filters
              {activeCount > 0 && (
                <span className="inline-flex size-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xs font-semibold">
                  {activeCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                Filters
              </span>
              {activeCount > 0 && (
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={clearAll}
                  type="button"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Status
                </span>
                <SearchableSelect
                  onValueChange={(v) => updateParams({ status: v })}
                  options={[
                    { value: "all", label: "All Statuses" },
                    ...statuses.map((s) => ({
                      value: s.slug,
                      label: s.label,
                    })),
                  ]}
                  placeholder="All Statuses"
                  searchPlaceholder="Search status…"
                  triggerClassName="w-full"
                  value={status}
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Category
                </span>
                <SearchableSelect
                  onValueChange={(v) => updateParams({ category: v })}
                  options={[
                    { value: "all", label: "All Categories" },
                    ...categories.map((c) => ({
                      value: c.slug,
                      label: c.label,
                    })),
                  ]}
                  placeholder="All Categories"
                  searchPlaceholder="Search category…"
                  triggerClassName="w-full"
                  value={category}
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Priority
                </span>
                <SearchableSelect
                  onValueChange={(v) => updateParams({ priority: v })}
                  options={[
                    { value: "all", label: "All Priorities" },
                    ...priorities.map((p) => ({
                      value: p.slug,
                      label: p.label,
                    })),
                  ]}
                  placeholder="All Priorities"
                  searchPlaceholder="Search priority…"
                  triggerClassName="w-full"
                  value={priority}
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Date Range
                </span>
                <SearchableSelect
                  onValueChange={(v) => updateParams({ range: v })}
                  options={RANGE_OPTIONS}
                  placeholder="All Time"
                  searchPlaceholder="Search range…"
                  triggerClassName="w-full"
                  value={range}
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  className="flex items-center gap-1.5 text-sm text-foreground"
                  onClick={() => updateParams({ mine: mine ? "" : "1" })}
                  type="button"
                >
                  <UserIcon className="size-4 text-muted-foreground" />
                  Assigned to me
                </button>
                <Switch
                  checked={mine}
                  onCheckedChange={(v) => updateParams({ mine: v ? "1" : "" })}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  className="flex items-center gap-1.5 text-sm text-foreground"
                  onClick={() =>
                    updateParams({ awaiting: awaiting ? "" : "1" })
                  }
                  type="button"
                >
                  <ChatCircleDotsIcon className="size-4 text-muted-foreground" />
                  Awaiting reply
                </button>
                <Switch
                  checked={awaiting}
                  onCheckedChange={(v) =>
                    updateParams({ awaiting: v ? "1" : "" })
                  }
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((f) => (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-medium text-foreground"
              key={f.key}
            >
              {f.label}
              <button
                className="ml-0.5 hover:text-foreground/60"
                onClick={() => updateParams({ [f.key]: "" })}
                type="button"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
          <Button
            className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={clearAll}
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
