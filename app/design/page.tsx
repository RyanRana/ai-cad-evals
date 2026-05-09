import Link from "next/link";

export default function Design() {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-3xl">
      <header className="not-prose mb-12 space-y-4 border-b pb-8">
        <div className="eyebrow">Design note 03 · v0.5 · 2026-05-09</div>
        <h1 className="font-serif text-[38px] md:text-[44px] leading-[1.05] tracking-tight">
          From first principles: judging{" "}
          <span className="italic text-[var(--accent)]">AI CAD agents</span> at research-lab rigor
        </h1>
        <p className="text-[var(--muted)] text-[15px] leading-[1.7] max-w-2xl">
          The v0.4 leaderboard was a single weighted mean over ten categories scored by automatic geometric metrics.
          That number is concise, but it conflates capabilities that need separate judging modalities, hides
          reliability, and is gameable. v0.5 rebuilds scoring on top of an explicit task-space taxonomy, a
          four-layer category hierarchy, a 2PL Item-Response-Theory ability θ, worst-case p5 reporting, a
          (capability, $/task) Pareto frontier, and three pre-baked use-case re-weightings. This page is the
          rationale.
        </p>
      </header>

      <h2 className="text-base font-medium tracking-tight mt-10">1. What is "good at CAD" actually measuring?</h2>
      <p>
        An engineer making a hire decision watches for five orthogonal capabilities, ordered roughly:
      </p>
      <ol className="list-decimal pl-5 text-sm space-y-1.5 leading-relaxed">
        <li><b>Intent → spec.</b> Turning a prompt into a complete, unambiguous specification (dimensions, tolerances, datums, fits). Most evals skip this entirely and hand the agent an over-specified prompt.</li>
        <li><b>Spec → representation.</b> Encoding that spec as a BREP or sketch graph other tools (CAM, FEA, downstream parametric edits) can consume. Mesh-only output passes "looks right" and fails everything past it.</li>
        <li><b>Engineering soundness.</b> Implicit constraints: manufacturability for the chosen process, GD&T, standards compliance, fits, draft, stress-concentration awareness, no closed voids in DLP, etc.</li>
        <li><b>Editability.</b> The model survives downstream parametric changes, paraphrase, prompt translation, partner-part substitution.</li>
        <li><b>Reliability.</b> Low variance across seeds, calibrated confidence, graceful failure modes, paraphrase invariance. A 75 ± 25 agent is worse than a 70 ± 5 agent for production.</li>
      </ol>
      <p>
        v0.4 mostly tested (3). v0.5 separates them.
      </p>

      <h2 className="text-base font-medium tracking-tight mt-10">2. The actual space of CAD parts: 8 axes</h2>
      <p>
        Cartesian product of the eight axes is implausible (~20 k cells), but collapsing low-occupancy combos yields
        roughly 80–120 truly distinct test classes. v0.5 covers about 60. The eight axes:
      </p>
      <div className="not-prose border rounded-md bg-[var(--card)] overflow-x-auto my-4">
        <table className="w-full text-[12px]">
          <thead className="text-[10px] uppercase font-mono text-[var(--muted)]">
            <tr className="border-b">
              <th className="text-left px-3 py-2">Axis</th>
              <th className="text-left px-3 py-2">Levels</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <Row axis="Topology class" levels="genus-0 single shell, genus-N single shell, multi-shell, sheet body, hybrid" />
            <Row axis="Representation" levels="sketch+features (BREP), pure CSG, direct edit, NURBS class-A, SDF/lattice, mesh" />
            <Row axis="Process regime" levels="3-ax CNC, 5-ax CNC, turning, sheet metal, injection, die cast, sand cast, FDM, SLA, SLS, DMLS, forging, stamping, layup, weldment" />
            <Row axis="Functional class" levels="structural, kinematic, sealing, thermal, fluid, optical, EM, containment, ergonomic, compliant, fastening" />
            <Row axis="Scale" levels="µm (MEMS), mm (electronics), cm-m (industrial), m+ (aerospace)" />
            <Row axis="Precision regime" levels="decorative ±0.5, fit/clearance ±0.05, aero ±0.01, optical sub-µm" />
            <Row axis="Spec source" levels="NL only, drawing, photo, scan, functional req only, mating-context" />
            <Row axis="Editability target" levels="one-shot, parametric, configurable family, adaptive" />
          </tbody>
        </table>
      </div>

      <h2 className="text-base font-medium tracking-tight mt-10">3. The four-layer category hierarchy</h2>
      <p>
        A flat list of categories is wrong because each layer has a different correct judging modality.
        Mixing them obscures what an agent is actually good at:
      </p>
      <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1.5">
        <li><b>L1 Geometry</b> — judged by automatic geometric metrics (IoU, Chamfer, BREP topology). Cheap, deterministic, no domain reasoning.</li>
        <li><b>L2 Engineering</b> — judged by named-dimension matching, GD&T parsers (ASME Y14.5-2018), partner-part assembly simulation, ISO/ANSI fit tolerance enforcement, standards-derived feature checks (ISO 4762, DIN 471, AS568, ANSI B5.50). Requires CAD-kernel reasoning about engineering intent.</li>
        <li><b>L3 Manufacturing</b> — judged by running an actual CAM postprocessor (FreeCAD-Path) or DFM analyzer against the chosen process: detect undercuts, check tool reach, compute draft on each face, simulate FDM overhangs, extract parting line.</li>
        <li><b>L4 Cognition / Robustness</b> — paraphrase consistency, parametric range survival, FEA-pass under spec'd loads, calibration of self-reported confidence, LLM-as-judge with rubric where ground truth is open-ended.</li>
      </ul>
      <p>
        Default layer weights (L1 0.20 · L2 0.35 · L3 0.25 · L4 0.20) reflect a "production mechanical engineer" prior;
        the leaderboard tabs let you re-weight on the fly to "design exploration" (L4 + L1 dominant) or "hobbyist" (L3-FDM + cost dominant).
      </p>

      <h2 className="text-base font-medium tracking-tight mt-10">4. What's missing from the v0.4 metric set</h2>
      <p>
        v0.4 had 18 metrics — adequate for L1 and partial L2. v0.5 adds ten more to cover the rest:
      </p>
      <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1.5">
        <li><b>Named-dim RMSE</b> — RMS error on the *labeled* dimensions, not bbox. Catches a part that hits bbox via wrong feature placement.</li>
        <li><b>GD&T compliance</b> — fraction of position / parallelism / runout callouts satisfied via OCC + custom GD&T parser.</li>
        <li><b>CAM reachability</b> — does a 3-axis FreeCAD-Path postprocessor produce a collision-free toolpath at 0.05 mm finish stepover?</li>
        <li><b>FEA-yield pass</b> — automated mesh, run linear-elastic at the spec'd load, max von Mises &lt; 0.8 σ_y.</li>
        <li><b>Parametric range integrity</b> — over the declared parameter range sampled at N=20 points, what fraction preserve topology?</li>
        <li><b>Paraphrase IoU σ</b> — std-dev of vol_iou across N=5 prompt paraphrases. Tests whether the agent reads intent or surface form.</li>
        <li><b>Seed σ</b> — same prompt, k=5 seeds, std-dev of vol_iou.</li>
        <li><b>Confidence calibration (Brier)</b> — Brier score on agent's pre-generation self-assessed confidence.</li>
        <li><b>Edit-vs-fresh latency ratio</b> — is parametric editing actually fast? &lt; 1 means real parametric.</li>
        <li><b>Fit-class compliance</b> — for ISO/ANSI fits (e.g. H7/g6), fraction of mating dimensions in the prescribed shaft/hole tolerance band.</li>
      </ul>

      <h2 className="text-base font-medium tracking-tight mt-10">5. Composite scoring: the mean is misleading</h2>
      <p>
        A single weighted mean conceals three things you'd want to know: how reliably the agent works, how it does on hard items, and what it costs. v0.5 always shows three composites side-by-side, plus a Pareto chart:
      </p>
      <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1.5">
        <li><b>Mean composite.</b> The default — easy to read, easy to game by being good at easy categories.</li>
        <li><b>2PL IRT ability θ.</b> Item Response Theory fit jointly over agents and tasks: P(pass | θ_a, β_t, α_t) = σ(α_t (θ_a − β_t)). Hard tasks weight more (high β), noise weights less, can't game by cherry-picking. Normalized to 0–100 across the agent set.</li>
        <li><b>Worst-case p5.</b> 5th-percentile score across tasks. Reliability metric; for production users, the bad-day score matters more than the average.</li>
        <li><b>Pareto frontier in (capability, $/task).</b> Many users want "best per dollar". The frontier rotates with use-case weighting so different agents become relevant.</li>
      </ul>

      <h2 className="text-base font-medium tracking-tight mt-10">6. Capability tiers</h2>
      <p>
        Rank ordering is brittle when scores are within CI of each other. v0.5 classifies into five tiers
        with explicit gates that must all be cleared:
      </p>
      <div className="not-prose border rounded-md bg-[var(--card)] divide-y my-4">
        <Tier name="Tier S · Production-Ready" gate="≥80 composite, ≥75 L2, ≥70 L3, ≥70 BREP fidelity, p5 ≥ 50" />
        <Tier name="Tier A · Engineering-Capable" gate="≥65 composite, ≥60 L1, ≥55 L2, ≥40 BREP fidelity" />
        <Tier name="Tier B · Engineering-Aided" gate="≥45 composite, ≥50 L1 — useful as a starting point" />
        <Tier name="Tier C · Conceptual" gate="≥25 composite — sketch-quality output" />
        <Tier name="Tier D · Non-CAD Asset" gate="below tier C — generates 3D shapes, not for engineering" />
      </div>
      <p>
        Tiers are floor gates, not score-based clusters. An agent with 85 composite that flunks BREP fidelity (mesh-only) does not reach tier S — it falls to tier B. This is a deliberate design choice: production users care about manufacturability gates, not any-cost capability.
      </p>

      <h2 className="text-base font-medium tracking-tight mt-10">7. Three use-case views</h2>
      <p>
        Layer weights re-shape the leaderboard for different consumers. Same data, different vector:
      </p>
      <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1.5">
        <li><b>Production engineering</b> — L1 0.10 · L2 0.45 · L3 0.35 · L4 0.10. GD&T, mating, manufacturability dominate.</li>
        <li><b>Design exploration</b> — L1 0.20 · L2 0.20 · L3 0.10 · L4 0.50. Reverse-eng, paraphrase robustness, parametric edit, FEA-gated function dominate.</li>
        <li><b>Hobbyist / maker</b> — L1 0.25 · L2 0.15 · L3 0.40 · L4 0.20. FDM DFM, cost, simple parts dominate.</li>
      </ul>

      <h2 className="text-base font-medium tracking-tight mt-10">8. Better judging modalities</h2>
      <p>
        v0.4 was purely automatic geometric scoring. That doesn't reach L2-L4. v0.5 mixes:
      </p>
      <ol className="list-decimal pl-5 text-sm leading-relaxed space-y-1.5">
        <li><b>Automatic geometric.</b> ICP align, voxel IoU, Chamfer, Hausdorff, BREP topology checks. (L1)</li>
        <li><b>Automatic feature extraction + named-dim matching.</b> OCC BRepFeat → expected-feature map. (L2)</li>
        <li><b>Automatic GD&T parser.</b> Datum reference frame, position/parallelism/runout against datums. (L2)</li>
        <li><b>Automatic CAM postprocessor.</b> FreeCAD-Path 3-ax simulation with Ø6 → Ø3 → Ø1 tools. (L3)</li>
        <li><b>Automatic FEA pipeline.</b> CalculiX / Code_Aster linear-elastic at spec'd load, max von Mises gate. (L4)</li>
        <li><b>LLM-as-judge with rubric.</b> Open-ended prompts where ground truth is a rubric, not a STEP. Pairwise prompt → judge → Bradley-Terry.</li>
        <li><b>Human pairwise ranking.</b> Gold standard, expensive — used only for held-out validation.</li>
        <li><b>Real CAM / additive manufacturing → scan → compare.</b> The most expensive option, reserved for headline tasks each year.</li>
      </ol>

      <h2 className="text-base font-medium tracking-tight mt-10">9. Open problems</h2>
      <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1.5">
        <li><b>Functional intent at scale.</b> FEA-gated tasks are expensive; LLM-as-FEA-judge is unreliable.</li>
        <li><b>Multi-body assembly mating.</b> v0.5 covers 2-3 bodies. Real assemblies are ~200.</li>
        <li><b>Sensitivity to drawing conventions.</b> ASME Y14.5 vs ISO 8015 produce subtly different ground truth; the suite must hold the convention fixed per task.</li>
        <li><b>Paraphrase generation as adversarial benchmark.</b> Auto-generating paraphrases that preserve intent without leaking spec is itself a research problem.</li>
        <li><b>Tool-licence cost in human baseline.</b> Currently we only count seat-hours; Onshape per-seat / Solidworks Premium licences are not amortized in.</li>
        <li><b>Process-aware DFM weights.</b> The same part is unmanufacturable on 3-ax CNC and trivial on SLA — DFM scores should be reported per process, not as a composite.</li>
      </ul>

      <h2 className="text-base font-medium tracking-tight mt-10">10. What v0.6 should add</h2>
      <ol className="list-decimal pl-5 text-sm leading-relaxed space-y-1.5">
        <li><b>Multi-body assemblies (5–10 parts)</b> with full mate graph and motion simulation.</li>
        <li><b>Live FEA-in-the-loop</b> for L4 functional-intent tasks at production cadence (target &lt; 90 s per task).</li>
        <li><b>Sheet-metal flat-pattern fidelity</b> as a first-class L3 metric.</li>
        <li><b>Real-manufacture checkpoints.</b> 12 headline tasks per year manufactured (CNC + SLA + injection-tool) and 3D-scanned for ground-truth comparison.</li>
        <li><b>Adversarial paraphrase generator</b> that injects known-distractor terminology to test semantic robustness.</li>
        <li><b>Pairwise human study</b> with N=20 mech-E judges via a custom CAD-diff UI; Bradley-Terry score reconciled against the automatic score.</li>
        <li><b>Calibrated abstention.</b> Agents allowed to declare "out of scope"; abstentions counted as null (not zero) when the task is genuinely outside the agent's representation class.</li>
      </ol>

      <p className="text-sm text-[var(--muted)] leading-relaxed mt-10">
        The full task list, formal metric definitions, and run-protocol live in <Link href="/methodology" className="underline underline-offset-4">/methodology</Link>.
        The runner and reference scorer are in <code className="font-mono">scripts/</code> — adding a new agent is one TypeScript adapter.
      </p>
    </div>
  );
}

function Row({ axis, levels }: { axis: string; levels: string }) {
  return (
    <tr>
      <td className="px-3 py-2 align-top whitespace-nowrap font-mono text-[11px]">{axis}</td>
      <td className="px-3 py-2 align-top text-[12px]">{levels}</td>
    </tr>
  );
}

function Tier({ name, gate }: { name: string; gate: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline gap-3">
        <span className="text-sm">{name}</span>
      </div>
      <p className="text-[12px] text-[var(--muted)] mt-1 font-mono">{gate}</p>
    </div>
  );
}
