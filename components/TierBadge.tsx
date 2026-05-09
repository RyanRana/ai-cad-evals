import type { Tier } from "@/lib/types";

const COPY: Record<Tier, { label: string; long: string }> = {
  S: { label: "S · Production-Ready", long: "BREP-native, ≥75 L2, ≥70 L3, ≥70 BREP fidelity, p5 ≥ 50" },
  A: { label: "A · Engineering-Capable", long: "≥65 overall with passable BREP roundtrip" },
  B: { label: "B · Engineering-Aided", long: "≥45 overall, useful as a starting point" },
  C: { label: "C · Conceptual", long: "≥25 overall, sketch-quality output" },
  D: { label: "D · Non-CAD Asset", long: "Generates 3D shapes, not for engineering use" },
};

const COLOR: Record<Tier, string> = {
  S: "bg-[var(--foreground)] text-[var(--background)]",
  A: "border border-[var(--foreground)]",
  B: "border border-[var(--muted)] text-[var(--muted)]",
  C: "border border-[var(--border)] text-[var(--muted)]",
  D: "border border-dashed border-[var(--border)] text-[var(--muted)]",
};

export function TierBadge({ tier, full = false }: { tier: Tier; full?: boolean }) {
  const c = COPY[tier];
  return (
    <span title={c.long} className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono tracking-wide ${COLOR[tier]}`}>
      {full ? c.label : `Tier ${tier}`}
    </span>
  );
}
