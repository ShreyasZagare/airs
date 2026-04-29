// normalizeLogs.js

/**
 * Normalise any raw log input into an array of structured log objects.
 *
 * @param {string|string[]|object[]} rawLogs
 * @param {object} [options]
 * @param {string} [options.defaultService='unknown'] - Fallback service name
 * @returns {{ level: string, message: string, service: string, timestamp: string|null }[]}
 */
export function normalizeLogs(rawLogs, { defaultService = 'unknown' } = {}) {
  // --- 1. Unify input to an array of lines (strings) ---
  let lines;
  if (typeof rawLogs === 'string') {
    lines = splitPreservingStackTraces(rawLogs);
  } else if (Array.isArray(rawLogs)) {
    // Could be array of strings, array of objects, or a mix
    lines = rawLogs.flatMap(item => {
      if (typeof item === 'string') return item.split('\n');
      // object – we will process in step 2
      return [item];
    });
  } else {
    lines = [String(rawLogs)];
  }

  const entries = [];

  // Helper to push a new entry
  const pushEntry = (obj) => {
    // Ensure all required fields exist
    entries.push({
      level: obj.level || 'INFO',
      message: obj.message || String(obj.message),
      service: obj.service || defaultService,
      timestamp: obj.timestamp || null,
    });
  };

  // --- 2. Process each item (string or object) ---
  for (const item of lines) {
    if (typeof item === 'object' && item !== null) {
      // Already an object -> map fields
      pushEntry({
        level: item.level || item.severity || item.logLevel || item.priority || 'INFO',
        message: item.message || item.msg || item.text || item.body || JSON.stringify(item),
        service: item.service || item.app || item.source || defaultService,
        timestamp: item.timestamp || item.time || item['@timestamp'] || item.date || null,
      });
      continue;
    }

    // --- It's a string ---
    const line = item.trim();
    if (!line) continue;

    // 3a. Try JSON parse (common for structured logging)
    try {
      const json = JSON.parse(line);
      if (typeof json === 'object' && json !== null) {
        pushEntry(json);
        continue;
      }
    } catch { /* not JSON */ }

    // 3b. Syslog (RFC 3164 / 5424)
    const syslogMatch = line.match(
      /^<(\d+)>?(\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})\s(\S+)\s(\S+?)(?:\[(\d+)\])?:\s?(.*)$/
    );
    if (syslogMatch) {
      const pri = parseInt(syslogMatch[1], 10);
      pushEntry({
        level: syslogPriorityToLevel(pri),
        message: syslogMatch[6],
        service: syslogMatch[4], // process name
        timestamp: syslogMatch[2],
      });
      continue;
    }

    // 3c. Apache / Nginx common log format
    const apacheNginx = line.match(
      /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) ([^"]+)" (\d{3}) (\d+|-)/
    );
    if (apacheNginx) {
      const status = parseInt(apacheNginx[5], 10);
      pushEntry({
        level: httpStatusToLevel(status),
        message: `${apacheNginx[3]} ${apacheNginx[4]} -> ${status}`,
        service: 'httpd',
        timestamp: apacheNginx[2],
      });
      continue;
    }

    // 3d. Plain timestamp at start (ISO, or [2024-...], etc.)
    const tsMatch = line.match(
      /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]?\d*Z?)\]?\s+(.*)/
    );
    if (tsMatch) {
      const rest = tsMatch[2];
      pushEntry({
        level: inferLevelFromText(rest),
        message: rest,
        service: defaultService,
        timestamp: tsMatch[1],
      });
      continue;
    }

    // 3e. Exception / error line (no known format but contains ERROR/Exception/Traceback)
    if (/error|traceback|exception|failed|panic/i.test(line)) {
      pushEntry({
        level: 'ERROR',
        message: line,
        service: defaultService,
        timestamp: null,
      });
      continue;
    }

    // 3f. Fallback – plain message, try to guess level
    pushEntry({
      level: inferLevelFromText(line),
      message: line,
      service: defaultService,
      timestamp: null,
    });
  }

  // --- 4. Post‑process: merge continuation lines of a single entry ---
  // (A simple heuristic: if a line has no timestamp and no clear level,
  //  it’s merged with the previous message.)
  const merged = [];
  for (const entry of entries) {
    if (
      merged.length &&
      !entry.timestamp &&
      entry.level === 'INFO' &&   // fallback level
      entry.service === defaultService &&
      !/error|warn|info|debug|trace|fatal/i.test(entry.message.slice(0, 10))
    ) {
      // Likely a continuation – append to previous message
      merged[merged.length - 1].message += '\n' + entry.message;
    } else {
      merged.push(entry);
    }
  }

  return merged;
}

// --- Helper functions ---

function splitPreservingStackTraces(text) {
  // Split on newline but keep consecutive non‑timestamp lines together
  // Simpler: split on newline, then in post‑processing we merge continuation lines.
  return text.split(/\r?\n/);
}

function syslogPriorityToLevel(priority) {
  const severity = priority & 7; // last 3 bits
  const levels = ['EMERGENCY', 'ALERT', 'CRITICAL', 'ERROR', 'WARNING', 'NOTICE', 'INFO', 'DEBUG'];
  return levels[severity] || 'INFO';
}

function httpStatusToLevel(status) {
  if (status >= 500) return 'ERROR';
  if (status >= 400) return 'WARN';
  return 'INFO';
}

function inferLevelFromText(text) {
  const lower = text.toLowerCase();
  if (lower.includes('error') || lower.includes('fail') || lower.includes('exception') || lower.includes('fatal')) return 'ERROR';
  if (lower.includes('warn')) return 'WARN';
  if (lower.includes('info')) return 'INFO';
  if (lower.includes('debug')) return 'DEBUG';
  if (lower.includes('trace')) return 'TRACE';
  return 'INFO';
}