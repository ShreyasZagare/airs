import { logAgent }        from "../agents/logAgent.js";
import { rootCauseAgent }  from "../agents/rootCauseAgent.js";
import { fixAgent }        from "../agents/fixAgent.js";
import { confidenceAgent } from "../agents/confidenceAgent.js";

/**
 * Orchestrator — sequential agent pipeline with context passing
 *
 * LogAgent → RootCauseAgent(logCtx) → FixAgent(rootCtx) → ConfidenceAgent(logCtx, rootCtx, fixCtx)
 *
 * Each agent receives enriched context from its predecessor(s).
 */
export async function orchestrate(logs) {
  const startTime  = Date.now();
  const agentTrace = [];
  const handoffs   = [];

  // Step 1: Log Agent
  const logCtx = await logAgent(logs);
  agentTrace.push(logCtx.trace);
  handoffs.push({ from: "LogAgent", to: "RootCauseAgent", message: logCtx.handoff });

  // Step 2: Root Cause Agent — receives full log context
  const rootCtx = await rootCauseAgent(logCtx);
  agentTrace.push(rootCtx.trace);
  handoffs.push({ from: "RootCauseAgent", to: "FixAgent", message: rootCtx.handoff });

  // Step 3: Fix Agent — receives root cause context (which includes log metadata)
  const fixCtx = await fixAgent(rootCtx);
  agentTrace.push(fixCtx.trace);
  handoffs.push({ from: "FixAgent", to: "ConfidenceAgent", message: fixCtx.handoff });

  // Step 4: Confidence Agent — receives ALL prior contexts for holistic scoring
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
    handoffs,   // agent-to-agent handoff messages for UI
    agentTrace,
    meta: {
      durationMs:    duration,
      logsAnalyzed:  logs.length,
      timestamp:     new Date().toISOString(),
    },
  };
}
