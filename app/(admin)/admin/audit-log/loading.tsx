import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogLoading() {
  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-56 rounded-md" />
      </div>

      <div>
        <Skeleton className="h-3 w-24 mb-3" />
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="border-b border-border bg-accent/50 px-4 py-3">
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="divide-y divide-border/50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div className="flex items-center gap-4 px-4 py-3.5" key={i}>
                <Skeleton className="h-3 w-24 shrink-0" />
                <Skeleton className="h-3 w-32 shrink-0 hidden sm:block" />
                <Skeleton className="h-5 w-24 rounded-md shrink-0" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
