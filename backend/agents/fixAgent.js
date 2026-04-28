import { callLLM } from "../utils/llm.js";

/**
 * Fix Agent
 * Receives full root cause context including affected services + severity
 * Hands structured fix + metadata to ConfidenceAgent
 */
export async function fixAgent(rootCauseContext) {
  const { cause, category, affectedServices, patterns, severity, errorCount } = rootCauseContext;

  const prompt = `
You are writing an incident runbook. Here is the full diagnostic context:

Root cause: "${cause}"
Category: ${category}
Severity: ${severity}
Affected services: ${(affectedServices || []).join(", ") || "unknown"}
Patterns detected: ${(patterns || []).join(", ") || "none"}
Error count: ${errorCount}

Produce a targeted fix plan as raw JSON (no markdown, no backticks):
{
  "immediate": ["step 1", "step 2", "step 3"],
  "longTerm": ["recommendation 1", "recommendation 2"],
  "estimatedResolutionTime": "X minutes",
  "rollbackPlan": "one-sentence rollback strategy"
}

Be specific — use real commands, service names, and actionable steps based on the context above.
`;

  const raw = await callLLM(prompt, "You are a senior SRE writing a production runbook. Output only valid JSON.");

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed  = JSON.parse(cleaned);
    return {
      ...parsed,
      targetedAt: affectedServices || [],
      severity,
      handoff: `Generated ${parsed.immediate?.length || 0} immediate steps targeting [${(affectedServices || []).join(", ")}]. Est. resolution: ${parsed.estimatedResolutionTime}. Passing to ConfidenceAgent.`,
      trace: `FixAgent → ${parsed.immediate?.length || 0} immediate + ${parsed.longTerm?.length || 0} long-term steps | targets: [${(affectedServices || []).join(", ")}] | ETA: ${parsed.estimatedResolutionTime}`,
    };
  } catch {
    return {
      immediate: [raw.trim()],
      longTerm: [],
      estimatedResolutionTime: "unknown",
      rollbackPlan: "Revert to last stable deployment",
      targetedAt: affectedServices || [],
      severity,
      handoff: "Fix generated but response was unstructured. Passing raw output to ConfidenceAgent.",
      trace: `FixAgent → unstructured LLM response, wrapped as single step`,
    };
  }
}
