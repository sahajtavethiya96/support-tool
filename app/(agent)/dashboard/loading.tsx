import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border shadow-soft p-5 space-y-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Volume chart */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-7 w-10 rounded-md" />
            <Skeleton className="h-7 w-10 rounded-md" />
          </div>
        </div>
        <div className="flex items-end gap-1 h-32">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${30 + Math.round(Math.sin(i) * 20 + 30)}%` }}
            />
          ))}
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="flex-1 h-3" />
          ))}
        </div>
      </div>

      {/* Recent tickets table */}
      <div className="bg-card rounded-xl border border-border shadow-soft">
        <div className="px-6 py-4 border-b border-border space-y-1">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-6 py-3 flex items-center gap-6">
              <Skeleton className="h-4 w-10 shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-xs" />
              <Skeleton className="h-5 w-20 rounded-md shrink-0" />
              <Skeleton className="h-4 w-24 shrink-0" />
              <Skeleton className="h-4 w-10 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* My tickets table */}
      <div className="bg-card rounded-xl border border-border shadow-soft">
        <div className="px-6 py-4 border-b border-border space-y-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-6 py-3 flex items-center gap-6">
              <Skeleton className="h-4 w-10 shrink-0" />
              <Skeleton className="h-4 flex-1 max-w-xs" />
              <Skeleton className="h-5 w-20 rounded-md shrink-0" />
              <Skeleton className="h-5 w-20 rounded-md shrink-0" />
              <Skeleton className="h-4 w-10 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
