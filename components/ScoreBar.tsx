export function ScoreBar({ value, max = 100, ciLow, ciHigh }: { value: number; max?: number; ciLow?: number; ciHigh?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const lo = ciLow !== undefined ? Math.max(0, Math.min(100, (ciLow / max) * 100)) : null;
  const hi = ciHigh !== undefined ? Math.max(0, Math.min(100, (ciHigh / max) * 100)) : null;
  return (
    <div className="relative h-1.5 w-full bg-[var(--border)] rounded-sm overflow-visible">
      {lo !== null && hi !== null && (
        <div
          className="absolute h-1.5 bg-[var(--foreground)]/15 rounded-sm"
          style={{ left: `${lo}%`, width: `${Math.max(0.5, hi - lo)}%` }}
        />
      )}
      <div className="absolute h-1.5 bg-[var(--foreground)] rounded-sm" style={{ width: `${pct}%` }} />
    </div>
  );
}
