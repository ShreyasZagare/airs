/**
 * Confidence Agent
 * Receives context from ALL prior agents to produce a holistic reliability score
 */
export function confidenceAgent(logContext, rootCauseContext, fixContext) {
  const scores = {};

  // 1. Root cause detection method
  scores.detectionMethod = { heuristic: rootCauseContext.confidence, llm_diagnosed: rootCauseContext.confidence }[rootCauseContext.method] ?? 0.4;

  // 2. Error signal density
  const { counts } = logContext;
  const errorRatio   = counts.errors / Math.max(counts.total, 1);
  scores.errorDensity = Math.min(errorRatio * 1.5, 1.0);

  // 3. Pattern recognition clarity
  scores.patternClarity = logContext.patterns.length > 0
    ? Math.min(0.5 + logContext.patterns.length * 0.15, 1.0)
    : 0.3;

  // 4. Fix plan completeness
  const stepCount = (fixContext.immediate?.length || 0) + (fixContext.longTerm?.length || 0);
  scores.fixCompleteness = Math.min(0.4 + stepCount * 0.1, 1.0);

  // 5. Service coverage (how many affected services were targeted in fix)
  const targeted = fixContext.targetedAt?.length || 0;
  const affected = rootCauseContext.affectedServices?.length || 1;
  scores.serviceCoverage = Math.min(targeted / affected, 1.0);

  const overall  = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
  const rounded  = Math.round(overall * 100) / 100;
  const pct      = Math.round(rounded * 100);
  const level    = pct >= 80 ? "high" : pct >= 60 ? "medium" : "low";

  const breakdown = {};
  for (const [k, v] of Object.entries(scores)) {
    breakdown[k] = Math.round(v * 100);
  }

  return {
    score:      rounded,
    percentage: pct,
    level,
    breakdown,
    handoff:    `Scored ${pct}% confidence (${level}) across ${Object.keys(scores).length} dimensions. Pipeline complete.`,
    trace: `ConfidenceAgent → overall ${pct}% | ${Object.entries(breakdown).map(([k,v]) => `${k}: ${v}%`).join(" | ")}`,
  };
}
