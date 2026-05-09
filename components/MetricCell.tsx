export function MetricCell({
  value,
  unit,
  good,
  format = "auto",
}: {
  value: number | boolean | null | undefined;
  unit?: string;
  good?: boolean;
  format?: "auto" | "pct" | "fixed3" | "fixed1" | "int";
}) {
  if (value === null || value === undefined) return <span className="text-[var(--muted)] tabular-nums">—</span>;
  let text: string;
  if (typeof value === "boolean") text = value ? "✓" : "×";
  else if (format === "pct") text = `${(value * 100).toFixed(1)}%`;
  else if (format === "fixed3") text = value.toFixed(3);
  else if (format === "fixed1") text = value.toFixed(1);
  else if (format === "int") text = `${Math.round(value)}`;
  else text = value.toFixed(2);
  const cls = good === undefined ? "" : good ? "text-[var(--good)]" : "text-[var(--bad)]";
  return (
    <span className={`tabular-nums font-mono text-[12.5px] ${cls}`}>
      {text}
      {unit && <span className="text-[var(--muted)] ml-0.5">{unit}</span>}
    </span>
  );
}
