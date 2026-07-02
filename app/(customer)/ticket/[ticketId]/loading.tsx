import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerTicketLoading() {
  return (
    <div className="min-h-screen bg-public">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sand sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-6">
        {/* Sidebar: other open tickets */}
        <aside className="lg:w-72 shrink-0 space-y-2">
          <Skeleton className="h-3 w-28" />
          <div className="bg-white rounded-xl border border-sand shadow-soft overflow-hidden divide-y divide-sand">
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="px-4 py-3 space-y-2" key={i}>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-4 w-14 rounded-md" />
                </div>
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* Ticket header */}
          <div className="bg-white rounded-xl border border-sand shadow-soft p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-6 w-20 rounded-md shrink-0" />
            </div>
          </div>

          {/* Original description */}
          <div className="bg-white rounded-xl border border-sand shadow-soft p-6 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/6" />
          </div>

          {/* Comments */}
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              className="bg-white rounded-xl border border-sand shadow-soft p-5 space-y-3"
              key={i}
            >
              <div className="flex items-center gap-2 mb-1">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}

          {/* Reply form (Tiptap editor + toolbar) */}
          <div className="bg-white rounded-xl border border-sand shadow-soft p-6 space-y-4">
            <Skeleton className="h-4 w-24" />
            <div className="rounded-md border border-sand overflow-hidden">
              <div className="flex gap-1 border-b border-sand px-2 py-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton className="size-6 rounded" key={i} />
                ))}
              </div>
              <Skeleton className="h-24 w-full rounded-none" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
