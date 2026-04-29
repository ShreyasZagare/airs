import { callLLM } from "../utils/llm.js";

/**
 * Root Cause Agent
 * Receives full LogAgent context, hands enriched diagnosis to FixAgent
 */
export async function rootCauseAgent(logContext) {
  const { errorMessages, patterns, affectedServices, counts } = logContext;

  // Fast heuristic path
  const heuristic = heuristicAnalysis(patterns, affectedServices);

  if (heuristic.confidence >= 0.8 && patterns.length === 1) {
    return {
      cause:    heuristic.cause,
      category: heuristic.category,
      confidence: heuristic.confidence,
      method:   "heuristic",
      // enriched context for FixAgent
      affectedServices,
      patterns,
      errorCount: counts.errors,
      severity: counts.errors >= 3 ? "high" : counts.errors >= 1 ? "medium" : "low",
      handoff: `Heuristic matched [${patterns.join(", ")}] on services [${affectedServices.join(", ")}]. Severity: ${counts.errors >= 3 ? "high" : "medium"}. Passing diagnosis + service context to FixAgent.`,
      trace: `RootCauseAgent → heuristic matched [${patterns.join(", ")}] | confidence ${Math.round(heuristic.confidence * 100)}% | severity: ${counts.errors >= 3 ? "high" : "medium"}`,
    };
  }

  // LLM fallback — pass full context as prompt
  const prompt = `
You are diagnosing a production incident. Here is the structured context from LogAgent:

Error messages:
${errorMessages.map((m, i) => `${i + 1}. ${m}`).join("\n")}

Affected services: ${affectedServices.join(", ") || "unknown"}
Detected patterns: ${patterns.join(", ") || "none"}
Error count: ${counts.errors} errors, ${counts.warnings} warnings out of ${counts.total} total logs

Identify the single most likely root cause in one precise sentence.
`;

  const cause = await callLLM(prompt, "You are a senior SRE. Be precise and concise.");
  const severity = counts.errors >= 3 ? "high" : counts.errors >= 1 ? "medium" : "low";

  return {
    cause: cause.trim(),
    category: "llm_diagnosed",
    confidence: 0.65,
    method: "llm",
    affectedServices,
    patterns,
    errorCount: counts.errors,
    severity,
    handoff: `LLM diagnosed root cause from ${errorMessages.length} error messages. Severity: ${severity}. Passing to FixAgent with full service context.`,
    trace: `RootCauseAgent → heuristic inconclusive, LLM diagnosed from ${errorMessages.length} errors | severity: ${severity}`,
  };
}

function heuristicAnalysis(patterns, services) {
  if (patterns.includes("timeout") && patterns.includes("connectivity"))
    return { cause: "Network or DB connectivity degradation causing cascading timeouts", category: "infrastructure", confidence: 0.9 };
  if (patterns.includes("timeout"))
    return { cause: "Database overload or slow query exhausting the connection pool", category: "database", confidence: 0.85 };
  if (patterns.includes("null_reference"))
    return { cause: "Null pointer exception — unvalidated input or missing guard clause in service layer", category: "application", confidence: 0.82 };
  if (patterns.includes("memory_pressure"))
    return { cause: "Memory leak or unbounded cache growth causing OOM conditions", category: "memory", confidence: 0.88 };
  if (patterns.includes("auth_failure"))
    return { cause: "Authentication service degradation or expired credentials", category: "security", confidence: 0.83 };
  if (patterns.includes("disk_pressure"))
    return { cause: "Disk space exhaustion affecting write operations", category: "infrastructure", confidence: 0.9 };
  return { cause: "Unknown — insufficient pattern signals", category: "unknown", confidence: 0.3 };
}
