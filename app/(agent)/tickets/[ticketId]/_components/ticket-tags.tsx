"use client";

import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Tag {
  id: string;
  name: string;
}

interface Props {
  initialTags: Tag[];
  ticketId: string;
}

export function TicketTags({ ticketId, initialTags }: Props) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Tag[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          setResults((await res.json()) as Tag[]);
        }
      } catch {
        // Autocomplete is best-effort — a failed search just shows no matches.
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [open, query]);

  const attachedNames = new Set(tags.map((t) => t.name.toLowerCase()));
  const suggestions = results.filter(
    (t) => !attachedNames.has(t.name.toLowerCase())
  );
  const normalizedQuery = query.trim().toLowerCase();
  const canCreate =
    normalizedQuery.length > 0 &&
    !suggestions.some((t) => t.name.toLowerCase() === normalizedQuery) &&
    !attachedNames.has(normalizedQuery);

  async function addTag(name: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast.error(data?.error ?? "Failed to add tag.");
        return;
      }
      const updated = (await res.json()) as Tag[];
      setTags(updated);
      setOpen(false);
      setQuery("");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTag(tag: Tag) {
    const previous = tags;
    setTags(tags.filter((t) => t.id !== tag.id));
    try {
      const res = await fetch(`/api/tickets/${ticketId}/tags/${tag.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setTags(previous);
        toast.error("Failed to remove tag.");
        return;
      }
      router.refresh();
    } catch {
      setTags(previous);
      toast.error("Network error.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          className="inline-flex items-center gap-1 rounded border border-border bg-accent px-2 py-1 text-xs font-medium text-foreground"
          key={tag.id}
        >
          {tag.name}
          <button
            aria-label={`Remove tag ${tag.name}`}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => removeTag(tag)}
            type="button"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}

      <Popover
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setQuery("");
          }
        }}
        open={open}
      >
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-stone transition-colors cursor-pointer"
            type="button"
          >
            <PlusIcon className="size-3" />
            Add tag
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <div className="border-b border-border px-2.5">
            <input
              autoFocus
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              disabled={busy}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) {
                  e.preventDefault();
                  addTag(query);
                }
              }}
              placeholder="Search or create a tag…"
              value={query}
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {canCreate && (
              <button
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent/60 transition-colors"
                disabled={busy}
                onClick={() => addTag(query)}
                type="button"
              >
                <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">Create "{query.trim()}"</span>
              </button>
            )}
            {suggestions.map((tag) => (
              <button
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent/60 transition-colors"
                disabled={busy}
                key={tag.id}
                onClick={() => addTag(tag.name)}
                type="button"
              >
                <span className="truncate">{tag.name}</span>
              </button>
            ))}
            {!canCreate && suggestions.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {query ? "No matches" : "No tags yet"}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
