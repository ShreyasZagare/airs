/**
 * Log Agent
 * Output context is passed directly to RootCauseAgent
 */
export async function logAgent(logs) {
  const errors   = logs.filter(l => l.level === "ERROR");
  const warnings = logs.filter(l => l.level === "WARN");
  const infos    = logs.filter(l => l.level === "INFO");

  const patterns  = detectPatterns(logs);
  const services  = [...new Set(logs.map(l => l.service).filter(Boolean))];
  const timeline  = logs.map(l => ({ level: l.level, message: l.message, service: l.service, ts: l.timestamp }));

  return {
    // structured context handed to next agent
    errorMessages:  errors.map(e => e.message),
    affectedServices: services,
    patterns,
    timeline,
    counts: {
      errors:   errors.length,
      warnings: warnings.length,
      infos:    infos.length,
      total:    logs.length,
    },
    // observability
    handoff: `Detected ${errors.length} errors across [${services.join(", ")}]. Patterns: [${patterns.join(", ") || "none"}]. Passing structured context to RootCauseAgent.`,
    trace: `LogAgent → parsed ${logs.length} logs | ${errors.length} errors, ${warnings.length} warnings | patterns: [${patterns.join(", ") || "none"}] | services: [${services.join(", ")}]`,
  };
}

function detectPatterns(logs) {
  const text = logs.map(l => l.message.toLowerCase()).join(" ");
  const found = [];
  if (text.includes("timeout"))                           found.push("timeout");
  if (text.includes("null") || text.includes("nullpointer")) found.push("null_reference");
  if (text.includes("memory") || text.includes("oom"))   found.push("memory_pressure");
  if (text.includes("connection") || text.includes("refused")) found.push("connectivity");
  if (text.includes("auth") || text.includes("unauthorized")) found.push("auth_failure");
  if (text.includes("disk") || text.includes("space"))   found.push("disk_pressure");
  return found;
}
