// agents/logAgent.js

export async function logAgent(logs) {
  const errors   = logs.filter(l => l.level === "ERROR");
  const warnings = logs.filter(l => l.level === "WARN");
  const infos    = logs.filter(l => l.level === "INFO");

  const patterns  = detectPatterns(logs);
  const services  = [...new Set(logs.map(l => l.service).filter(Boolean))];
  const timeline  = logs.map(l => ({ level: l.level, message: l.message, service: l.service, ts: l.timestamp }));

  // Group error messages by their "fingerprint" (first line stripped of digits)
  const errorGroups = new Map();
  for (const error of errors) {
    const key = fingerprintError(error.message);
    if (!errorGroups.has(key)) {
      errorGroups.set(key, {
        type: key,
        count: 0,
        sampleMessage: error.message,
        services: [],
      });
    }
    const group = errorGroups.get(key);
    group.count++;
    if (!group.services.includes(error.service)) {
      group.services.push(error.service);
    }
  }
  const groupedErrors = Array.from(errorGroups.values());

  return {
    // Full entries (needed by later agents)
    entries: logs,

    // Structured summary
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

    // Grouped errors for UI
    groupedErrors,

    // observability
    handoff: `Detected ${errors.length} errors across [${services.join(", ")}]. Patterns: [${patterns.join(", ") || "none"}]. Passing structured context to RootCauseAgent.`,
    trace: `LogAgent → parsed ${logs.length} logs | ${errors.length} errors, ${warnings.length} warnings | patterns: [${patterns.join(", ") || "none"}] | services: [${services.join(", ")}]`,
  };
}

/**
 * Create a stable, readable group key from an error message.
 */
function fingerprintError(message) {
  // Take the first line of the message
  const firstLine = message.split('\n')[0].trim();
  // Remove all digits and extra spaces, lowercase
  return firstLine.replace(/\d+/g, ' ').replace(/\s{2,}/g, ' ').trim().toLowerCase();
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