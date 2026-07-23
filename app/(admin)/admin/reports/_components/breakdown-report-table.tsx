interface Row {
  label: string;
  count: number;
  share?: number;
}

interface Props {
  csvHref: string;
  description?: string;
  rows: Row[];
  title: string;
}

/** Shared shape for the By Category / By Priority / By Tag reports — label,
 * count, and an optional share-of-total column (tags omit share since a
 * ticket can have multiple tags, so shares wouldn't sum to 100%). */
export function BreakdownReportTable({ title, description, rows, csvHref }: Props) {
  const showShare = rows.some((r) => r.share !== undefined);

  return (
    <section className="bg-card rounded-xl border border-border shadow-soft">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <a
          className="text-xs font-medium text-foreground hover:underline shrink-0"
          download
          href={csvHref}
        >
          Download CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No tickets in this range.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tickets
                </th>
                {showShare && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Share
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr className="hover:bg-accent/30 transition-colors" key={r.label}>
                  <td className="px-6 py-3 text-foreground font-medium">
                    {r.label}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{r.count}</td>
                  {showShare && (
                    <td className="px-6 py-3 text-muted-foreground">
                      {r.share !== undefined ? `${(r.share * 100).toFixed(1)}%` : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
