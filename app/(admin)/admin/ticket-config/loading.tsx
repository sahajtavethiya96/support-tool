export default function TicketConfigLoading() {
  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      <div className="space-y-2">
        <div className="h-7 w-40 bg-accent/40 rounded-md animate-pulse" />
        <div className="h-4 w-72 bg-accent/30 rounded-md animate-pulse" />
      </div>

      {/* Statuses skeleton */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 bg-accent/40 rounded-md animate-pulse" />
          <div className="h-9 w-28 bg-accent/30 rounded-md animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="flex items-center gap-3" key={i}>
              <div className="size-5 rounded-full bg-accent/40 animate-pulse" />
              <div className="h-4 w-24 bg-accent/30 rounded-md animate-pulse" />
              <div className="h-4 w-20 bg-accent/20 rounded-md animate-pulse ml-2" />
              <div className="ml-auto flex gap-2">
                <div className="h-8 w-14 bg-accent/30 rounded-md animate-pulse" />
                <div className="h-8 w-14 bg-accent/30 rounded-md animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Categories skeleton */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 bg-accent/40 rounded-md animate-pulse" />
          <div className="h-9 w-32 bg-accent/30 rounded-md animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="flex items-center gap-3" key={i}>
              <div className="size-5 rounded-full bg-accent/40 animate-pulse" />
              <div className="h-4 w-28 bg-accent/30 rounded-md animate-pulse" />
              <div className="ml-auto flex gap-2">
                <div className="h-8 w-14 bg-accent/30 rounded-md animate-pulse" />
                <div className="h-8 w-14 bg-accent/30 rounded-md animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Priorities skeleton */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 bg-accent/40 rounded-md animate-pulse" />
          <div className="h-9 w-28 bg-accent/30 rounded-md animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="flex items-center gap-3" key={i}>
              <div className="size-5 rounded-full bg-accent/40 animate-pulse" />
              <div className="h-4 w-24 bg-accent/30 rounded-md animate-pulse" />
              <div className="ml-auto flex gap-2">
                <div className="h-8 w-14 bg-accent/30 rounded-md animate-pulse" />
                <div className="h-8 w-14 bg-accent/30 rounded-md animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
