import type { Agent } from "@/lib/types";

// Simple SVG Pareto chart for capability vs $/task. Front-of-Pareto
// points are filled, dominated points are hollow. Log scale on cost.
export function ParetoChart({
  points,
  paretoIds,
  width = 720,
  height = 320,
}: {
  points: { agent: Agent; capability: number; cost: number; tier?: string }[];
  paretoIds: Set<string>;
  width?: number;
  height?: number;
}) {
  const padding = { top: 16, right: 16, bottom: 36, left: 44 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;

  const maxCap = 100;
  const minLogCost = Math.log10(0.01);
  const maxLogCost = Math.log10(Math.max(0.5, ...points.map((p) => p.cost), 10));

  const xOf = (cap: number) => padding.left + (cap / maxCap) * w;
  const yOf = (cost: number) => {
    const lc = Math.max(minLogCost, Math.log10(Math.max(0.005, cost)));
    return padding.top + ((lc - minLogCost) / (maxLogCost - minLogCost)) * h;
  };

  // Pareto path: sort points on the front by capability ascending, plot a step.
  const front = [...points]
    .filter((p) => paretoIds.has(p.agent.id))
    .sort((a, b) => a.capability - b.capability);
  const frontPath = front.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.capability).toFixed(1)} ${yOf(p.cost).toFixed(1)}`).join(" ");

  const xTicks = [25, 50, 75, 100];
  const yTicks = [0.01, 0.1, 1, 10];

  return (
    <svg width={width} height={height} className="block max-w-full" viewBox={`0 0 ${width} ${height}`}>
      {/* axes */}
      <line x1={padding.left} y1={padding.top + h} x2={padding.left + w} y2={padding.top + h} stroke="currentColor" strokeOpacity="0.4" />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + h} stroke="currentColor" strokeOpacity="0.4" />

      {/* gridlines + tick labels */}
      {xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={xOf(t)} y1={padding.top} x2={xOf(t)} y2={padding.top + h} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 3" />
          <text x={xOf(t)} y={padding.top + h + 14} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, SFMono-Regular" fill="currentColor" opacity="0.55">{t}</text>
        </g>
      ))}
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={padding.left} y1={yOf(t)} x2={padding.left + w} y2={yOf(t)} stroke="currentColor" strokeOpacity="0.08" strokeDasharray="2 3" />
          <text x={padding.left - 6} y={yOf(t) + 3} textAnchor="end" fontSize="9" fontFamily="ui-monospace, SFMono-Regular" fill="currentColor" opacity="0.55">{t < 1 ? `$${t.toFixed(2)}` : `$${t.toFixed(0)}`}</text>
        </g>
      ))}

      {/* x-axis title */}
      <text x={padding.left + w / 2} y={padding.top + h + 30} textAnchor="middle" fontSize="10" fontFamily="ui-monospace, SFMono-Regular" fill="currentColor" opacity="0.7">capability score (composite, 0–100) →</text>
      {/* y-axis title */}
      <text x={12} y={padding.top + h / 2} textAnchor="middle" fontSize="10" fontFamily="ui-monospace, SFMono-Regular" fill="currentColor" opacity="0.7" transform={`rotate(-90, 12, ${padding.top + h / 2})`}>↑ cost per task ($, log)</text>

      {/* pareto front */}
      {front.length >= 2 && (
        <path d={frontPath} fill="none" stroke="currentColor" strokeWidth="1.25" strokeOpacity="0.55" strokeDasharray="3 3" />
      )}

      {/* points */}
      {points.map((p) => {
        const isFront = paretoIds.has(p.agent.id);
        const cx = xOf(p.capability);
        const cy = yOf(p.cost);
        return (
          <g key={p.agent.id}>
            <circle cx={cx} cy={cy} r={isFront ? 5 : 3.5} fill={isFront ? "currentColor" : "transparent"} stroke="currentColor" strokeWidth={isFront ? 0 : 1.25} />
            <text x={cx + 8} y={cy + 3} fontSize="10" fontFamily="ui-monospace, SFMono-Regular" fill="currentColor" opacity={isFront ? 1 : 0.55}>{shortName(p.agent.name)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function shortName(name: string) {
  return name
    .replace("Claude Opus 4.7 → CadQuery", "Opus→CQ")
    .replace("Claude Opus 4.7 → OpenSCAD", "Opus→SCAD")
    .replace("Claude Sonnet 4.6 → CadQuery", "Sonnet→CQ")
    .replace("Claude Haiku 4.5 → CadQuery", "Haiku→CQ")
    .replace("OpenAI o4 (reasoning) → CadQuery", "o4→CQ")
    .replace("GPT-5 → CadQuery", "GPT-5→CQ")
    .replace("GPT-5 Mini → OpenSCAD", "GPT-5m→SCAD")
    .replace("Gemini 2.5 Pro → OpenSCAD", "Gemini→SCAD")
    .replace("Gemini 2.5 Flash → CadQuery", "Flash→CQ")
    .replace("DeepSeek R1 (reasoning) → CadQuery", "DSR1→CQ")
    .replace("Llama 3.3 70B → OpenSCAD", "Llama→SCAD")
    .replace("Qwen3 Coder → CadQuery", "Qwen→CQ")
    .replace("Hunyuan3D-2", "Hunyuan3D")
    .replace("CAD-Coder R1", "CADCoder")
    .replace("Zoo Text-to-CAD", "Zoo")
    .replace("Adam (CADcrush)", "Adam")
    .replace("Trellis 3D", "Trellis")
    .replace("Spline AI", "Spline")
    .replace("DeepCAD", "DeepCAD")
    .replace("Human Baseline (Mech-E)", "Human");
}
