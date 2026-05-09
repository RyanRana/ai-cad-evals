// 4-axis radar showing per-layer capability for one agent.
// Layers: L1 geometry, L2 engineering, L3 manufacturing, L4 cognition.
export function LayerRadar({
  values,
  size = 280,
  label,
}: {
  values: { axis: string; value: number; ref?: number }[]; // value 0..100
  size?: number;
  label?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 36;
  const N = values.length;
  const angles = values.map((_, i) => -Math.PI / 2 + (i / N) * 2 * Math.PI);
  const point = (i: number, frac: number) => {
    const ang = angles[i];
    const rr = r * frac;
    return [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)];
  };
  const polyPath = (frac: (i: number) => number) =>
    values.map((_, i) => {
      const [x, y] = point(i, frac(i));
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      {/* concentric grid */}
      {[0.25, 0.5, 0.75, 1.0].map((f) => (
        <polygon
          key={f}
          points={values.map((_, i) => point(i, f).map((n) => n.toFixed(1)).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={f === 1 ? 0.4 : 0.12}
          strokeDasharray={f === 1 ? "" : "2 3"}
        />
      ))}
      {/* spokes */}
      {values.map((v, i) => {
        const [x, y] = point(i, 1);
        const [tx, ty] = point(i, 1.18);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeOpacity="0.18" />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontFamily="ui-monospace, SFMono-Regular" fill="currentColor" opacity="0.85">{v.axis}</text>
          </g>
        );
      })}
      {/* reference (e.g. human baseline) */}
      {values.some((v) => v.ref !== undefined) && (
        <path d={polyPath((i) => Math.min(1, (values[i].ref ?? 0) / 100))} fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 3" />
      )}
      {/* agent value */}
      <path d={polyPath((i) => Math.min(1, values[i].value / 100))} fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeOpacity="0.95" strokeWidth="1.4" />
      {/* center label */}
      {label && (
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontFamily="ui-monospace, SFMono-Regular" fill="currentColor" opacity="0.7">{label}</text>
      )}
    </svg>
  );
}
