// core/normalizeLogs.js

/**
 * Normalise any raw log input into an array of structured log objects.
 *
 * @param {string|string[]|object[]} rawLogs
 * @param {object} [options]
 * @param {string} [options.defaultService='unknown']
 * @returns {{ level: string, message: string, service: string, timestamp: string|null }[]}
 */
export function normalizeLogs(rawLogs, { defaultService = 'unknown' } = {}) {
  // --- 1. Unify input to an array of items ---
  let lines;
  if (typeof rawLogs === 'string') {
    lines = rawLogs.split(/\r?\n/);
  } else if (Array.isArray(rawLogs)) {
    lines = rawLogs.flatMap(item => {
      if (typeof item === 'string') return item.split('\n');
      return [item];
    });
  } else {
    lines = [String(rawLogs)];
  }

  const entries = [];

  const pushEntry = (obj) => {
    entries.push({
      level: obj.level || 'INFO',
      message: obj.message || String(obj.message),
      service: obj.service || defaultService,
      timestamp: obj.timestamp || null,
    });
  };

  // --- 2. Parse each item ---
  for (const item of lines) {
    if (typeof item === 'object' && item !== null) {
      pushEntry({
        level: item.level || item.severity || item.logLevel || 'INFO',
        message: item.message || item.msg || item.text || item.body || JSON.stringify(item),
        service: item.service || item.app || item.source || defaultService,
        timestamp: item.timestamp || item.time || item['@timestamp'] || item.date || null,
      });
      continue;
    }

    const line = item.trim();
    if (!line) continue;

    // Try JSON
    try {
      const json = JSON.parse(line);
      if (typeof json === 'object' && json !== null) {
        pushEntry(json);
        continue;
      }
    } catch {}

    // Syslog
    const syslogMatch = line.match(
      /^<(\d+)>?(\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})\s(\S+)\s(\S+?)(?:\[(\d+)\])?:\s?(.*)$/
    );
    if (syslogMatch) {
      pushEntry({
        level: syslogPriorityToLevel(parseInt(syslogMatch[1], 10)),
        message: syslogMatch[6],
        service: syslogMatch[4],
        timestamp: syslogMatch[2],
      });
      continue;
    }

    // Apache/Nginx
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

    // Timestamp‑prefixed
    const tsMatch = line.match(
      /^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.,]?\d*Z?)\]?\s+(.*)/
    );
    if (tsMatch) {
      pushEntry({
        level: inferLevelFromText(tsMatch[2]),
        message: tsMatch[2],
        service: defaultService,
        timestamp: tsMatch[1],
      });
      continue;
    }

    // Exception/error keyword
    if (/error|traceback|exception|failed|panic/i.test(line)) {
      pushEntry({
        level: 'ERROR',
        message: line,
        service: defaultService,
        timestamp: null,
      });
      continue;
    }

    // Fallback
    pushEntry({
      level: inferLevelFromText(line),
      message: line,
      service: defaultService,
      timestamp: null,
    });
  }

  // --- 3. Merge continuation lines (stack traces) ---
  const merged = [];
  for (const entry of entries) {
    if (
      merged.length &&
      !entry.timestamp &&
      entry.level === 'INFO' &&
      entry.service === defaultService &&
      !/error|warn|info|debug|trace|fatal/i.test(entry.message.slice(0, 10))
    ) {
      merged[merged.length - 1].message += '\n' + entry.message;
    } else {
      merged.push(entry);
    }
  }

  // --- 4. Infer better service names where missing ---
  return merged.map(entry => {
    if (entry.service === defaultService || entry.service === 'unknown') {
      const inferred = inferServiceFromMessage(entry.message);
      if (inferred) entry.service = inferred;
    }
    return entry;
  });
}

// --- Helpers ---

function syslogPriorityToLevel(priority) {
  const severity = priority & 7;
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

/**
 * Try to pull a meaningful service name from the log message.
 */
function inferServiceFromMessage(message) {
  // 1. Extract the first stack‑trace class (e.g., "com.app.Main")
  const classMatch = message.match(/at\s+([\w.]+)\./);
  if (classMatch) {
    return classMatch[1];                            // full class name
  }

  // 2. Look for "Exception in thread ... at com.app.Main"
  const excMatch = message.match(/Exception in thread ".*?" ([\w.]+)/);
  if (excMatch) {
    const cls = excMatch[1];
    // strip the class name from the end if needed – keep full
    return cls;
  }

  // 3. Look for something like "NullPointerException at PaymentService.processTransaction"
  const atMatch = message.match(/at\s+([\w]+Service)[.\w]*/i);
  if (atMatch) {
    return atMatch[1];
  }

  // 4. If message contains known service patterns (e.g., "payment-service") – optional
  const knownService = message.match(/([a-z]+-service)/i);
  if (knownService) return knownService[1].toLowerCase();

  return null; // no better guess
}