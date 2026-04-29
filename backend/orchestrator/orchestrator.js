import { logAgent }        from "../agents/logAgent.js";
import { rootCauseAgent }  from "../agents/rootCauseAgent.js";
import { fixAgent }        from "../agents/fixAgent.js";
import { confidenceAgent } from "../agents/confidenceAgent.js";
import { normalizeLogs }   from "../core/normalizeLogs.js";   // <-- ensure this file exists

/**
 * Orchestrator — sequential agent pipeline with context passing
 *
 * LogAgent → RootCauseAgent(logCtx) → FixAgent(rootCtx) → ConfidenceAgent(logCtx, rootCtx, fixCtx)
 *
 * Accepts `logs` as a string, array of strings, array of objects, or any mix.
 */
export async function orchestrate(logs) {
  const startTime  = Date.now();
  const agentTrace = [];
  const handoffs   = [];

  // STEP 0: Normalise any log format → structured JSON array
  const normalizedLogs = normalizeLogs(logs);
  agentTrace.push(`LogNormalizer → input transformed to ${normalizedLogs.length} standardized log entries.`);

  // Step 1: Log Agent
  const logCtx = await logAgent(normalizedLogs);
  agentTrace.push(logCtx.trace);
  handoffs.push({ from: "LogAgent", to: "RootCauseAgent", message: logCtx.handoff });

  // Step 2: Root Cause Agent
  const rootCtx = await rootCauseAgent(logCtx);
  agentTrace.push(rootCtx.trace);
  handoffs.push({ from: "RootCauseAgent", to: "FixAgent", message: rootCtx.handoff });

  // Step 3: Fix Agent
  const fixCtx = await fixAgent(rootCtx);
  agentTrace.push(fixCtx.trace);
  handoffs.push({ from: "FixAgent", to: "ConfidenceAgent", message: fixCtx.handoff });

  // Step 4: Confidence Agent
  const confCtx = confidenceAgent(logCtx, rootCtx, fixCtx);
  agentTrace.push(confCtx.trace);
  handoffs.push({ from: "ConfidenceAgent", to: "Feedback", message: confCtx.handoff });

  const duration = Date.now() - startTime;
  agentTrace.push(`Orchestrator → pipeline complete in ${duration}ms | confidence: ${confCtx.percentage}% | recommendation: ${confCtx.recommendation}`);

  return {
    logSummary: {
      errorMessages:    logCtx.errorMessages,
      affectedServices: logCtx.affectedServices,
      counts:           logCtx.counts,
      patterns:         logCtx.patterns,
    },
    rootCause: {
      cause:    rootCtx.cause,
      category: rootCtx.category,
      method:   rootCtx.method,
      severity: rootCtx.severity,
    },
    fix: {
      immediate:               fixCtx.immediate,
      longTerm:                fixCtx.longTerm,
      estimatedResolutionTime: fixCtx.estimatedResolutionTime,
      rollbackPlan:            fixCtx.rollbackPlan,
      targetedAt:              fixCtx.targetedAt,
    },
    confidence: {
      score:           confCtx.score,
      percentage:      confCtx.percentage,
      level:           confCtx.level,
      breakdown:       confCtx.breakdown,
      recommendation:  confCtx.recommendation,
      signals:         confCtx.signals,
    },
    handoffs,
    agentTrace,
    meta: {
      durationMs:    duration,
      logsAnalyzed:  normalizedLogs.length,
      timestamp:     new Date().toISOString(),
    },
  };
}