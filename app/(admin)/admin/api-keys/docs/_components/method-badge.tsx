const COLORS: Record<string, string> = {
  GET: "bg-blue-50 border-blue-200 text-blue-700",
  POST: "bg-green-50 border-green-200 text-green-700",
};

export function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold font-mono ${COLORS[method]}`}
    >
      {method}
    </span>
  );
}
