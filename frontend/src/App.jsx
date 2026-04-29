import { useState, useRef } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "";

const SAMPLE_LOGS_TEXT = `[2025-04-01 14:23:01] ERROR com.app.PaymentService: NullPointerException at PaymentService.processPayment line 120
[2025-04-01 14:23:02] ERROR com.app.OrderService: NullPointerException at OrderService.placeOrder line 55
java.lang.NullPointerException
        at com.app.Main.run(Main.java:42)
        at com.app.Worker.process(Worker.java:18)
[2025-04-01 14:25:10] WARN Connection pool at 90% capacity (180/200) - db-pool
[2025-04-01 14:26:45] ERROR com.app.PaymentService: DB connection timeout after 30000ms
[2025-04-01 14:27:00] ERROR com.app.PaymentService: DB connection timeout after 30000ms
[2025-04-01 14:28:15] INFO PaymentService: Retrying failed transaction (attempt 2/3)`;

const AGENTS = [
  { id: "log", label: "Log", sub: "parsing" },
  { id: "rootcause", label: "Root Cause", sub: "diagnosing" },
  { id: "fix", label: "Fix", sub: "generating" },
  { id: "confidence", label: "Confidence", sub: "scoring" },
];

export default function App() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("custom");
  const [customText, setCustomText] = useState(""); // custom starts empty
  const [activeAgent, setActiveAgent] = useState(-1);
  const [traceOpen, setTraceOpen] = useState(false);
  const [agentLogs, setAgentLogs] = useState([]);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const timer = useRef(null);
  const [expandedErrors, setExpandedErrors] = useState([]);

  function switchMode(newMode) {
    setMode(newMode);
    if (newMode === "sample") {
      setCustomText(SAMPLE_LOGS_TEXT); // fill textarea with sample logs
    } else {
      setCustomText(""); // clear textarea for custom input
    }
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveAgent(0);
    setAgentLogs([]);
    setExpandedErrors([]);

    const messages = [
      "Parsing logs...",
      "Detecting anomalies...",
      "Correlating failures...",
      "Identifying root cause...",
      "Generating fix strategy...",
      "Scoring confidence..."
    ];

    let i = 0;
    timer.current = setInterval(() => {
      setAgentLogs(prev => [...prev, messages[i]]);
      setActiveAgent(Math.min(i, 3));
      i++;
      if (i >= messages.length) clearInterval(timer.current);
    }, 600);

    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: customText }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      clearInterval(timer.current);
      setActiveAgent(-1);
      setResult(json.data);
    } catch (e) {
      clearInterval(timer.current);
      setActiveAgent(-1);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleErrorExpand(idx) {
    setExpandedErrors(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  }

  const confColor = result
    ? result.confidence.level === "high"
      ? "#22c55e"
      : result.confidence.level === "medium"
        ? "#f59e0b"
        : "#ef4444"
    : "#888";

  return (
    <div className="root">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-dot" />
          <span className="topbar-title">AIRS</span>
          <span className="topbar-sep">/</span>
          <span className="topbar-sub">Incident Resolution</span>
        </div>
        <div className="topbar-pills">
          <span className="pill pill-teal">4 agents</span>
          {/* "Live" pill always shows "Live", but gets a pulsing dot when executing */}
          <span className={`pill pill-gray ${loading ? "pill-live" : ""}`}>
            <span className={`live-dot ${loading ? "live-dot-active" : ""}`} /> Live
          </span>
        </div>
      </div>

      {/* Pipeline */}
      <div className="pipeline-strip">
        {AGENTS.map((a, i) => (
          <div key={a.id} className={`ps-item ${loading && activeAgent === i ? "ps-active" : ""}`}>
            <div className="ps-num">{i + 1}</div>
            <div className="ps-label">{a.label}</div>
            {loading && activeAgent === i && <div className="ps-pulse" />}
            {i < AGENTS.length - 1 && <div className="ps-arrow">→</div>}
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="main">
        {/* Left Panel */}
        <div className="panel">
          <div className="panel-header">
            <div className="seg">
              <button
                className={`seg-btn ${mode === "sample" ? "seg-on" : ""}`}
                onClick={() => switchMode("sample")}
              >
                Sample
              </button>
              <button
                className={`seg-btn ${mode === "custom" ? "seg-on" : ""}`}
                onClick={() => switchMode("custom")}
              >
                Custom
              </button>
            </div>
          </div>

          {/* Unified textarea */}
          <textarea
            className="log-ta"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Paste any logs: JSON, Apache, syslog, or raw exceptions…"
          />

          <button className="run-btn" onClick={run} disabled={loading}>
            {loading ? "⚙️ Agents collaborating..." : "Run analysis →"}
          </button>

          {error && <div className="error-box">{error}</div>}
        </div>

        {/* Right Panel – unchanged from previous version */}
        <div className="panel panel-result">
          {!result && !loading && (
            <div className="empty-state">
              <div className="empty-text">Run analysis to see results</div>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="loading-label">
                {activeAgent >= 0
                  ? AGENTS[activeAgent].label + " agent " + AGENTS[activeAgent].sub + "…"
                  : "Finalizing…"}
              </div>
              <div className="loading-bar">
                <div
                  className="loading-fill"
                  style={{
                    width:
                      activeAgent >= 0
                        ? ((activeAgent + 1) / 4) * 100 + "%"
                        : "100%",
                  }}
                />
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Stats row */}
              <div className="stat-row">
                <div className="stat">
                  <div className="stat-val red">{result.logSummary.counts.errors}</div>
                  <div className="stat-key">errors</div>
                </div>
                <div className="stat">
                  <div className="stat-val amber">{result.logSummary.counts.warnings}</div>
                  <div className="stat-key">warnings</div>
                </div>
                <div className="stat">
                  <div className="stat-val" style={{ color: confColor }}>
                    {result.confidence.percentage}%
                  </div>
                  <div className="stat-key">confidence</div>
                </div>
                <div className="stat">
                  <div className="stat-val muted">{result.meta.durationMs}</div>
                  <div className="stat-key">ms</div>
                </div>
              </div>

              {/* Recommendation banner */}
              {result.confidence.recommendation && (
                <div className={"rec-banner rec-" + result.confidence.level}>
                  {result.confidence.recommendation}
                </div>
              )}

              {/* Root cause */}
              <div className="result-block">
                <div className="rb-label">
                  Root cause <span className="rb-tag">{result.rootCause.category}</span>
                </div>
                <div className="rb-text">{result.rootCause.cause}</div>
                <div className="rb-meta">
                  via {result.rootCause.method} • severity: {result.rootCause.severity}
                </div>
              </div>

              {/* Grouped errors */}
              {result.logSummary.groupedErrors && result.logSummary.groupedErrors.length > 0 && (
                <div className="result-block">
                  <div className="rb-label">Error summary</div>
                  {result.logSummary.groupedErrors.map((group, i) => (
                    <div key={i} style={{ marginBottom: "8px", fontSize: "12px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                        <strong>{group.count}x</strong> {group.type}
                        {group.services.length > 0 && (
                          <span style={{ color: "#666" }}>
                            in {group.services.join(", ")}
                          </span>
                        )}
                        <button
                          onClick={() => toggleErrorExpand(i)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#0a84ff",
                            cursor: "pointer",
                            fontSize: "11px",
                            padding: "0 0 0 4px",
                          }}
                        >
                          {expandedErrors.includes(i) ? "show less" : "show more"}
                        </button>
                      </div>
                      {expandedErrors.includes(i) && group.sampleMessage && (
                        <div
                          style={{
                            fontSize: "10px",
                            color: "#999",
                            marginTop: "4px",
                            paddingLeft: "12px",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {group.sampleMessage}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Affected services */}
              {result.logSummary.affectedServices.length > 0 && (
                <div className="services-row">
                  <div style={{ fontSize: "10px", color: "#555", letterSpacing: "1px", marginBottom: "6px" }}>
                    AFFECTED
                  </div>
                  {result.logSummary.affectedServices.map(s => (
                    <span key={s} className="service-chip">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Fix */}
              <div className="result-block">
                <div className="rb-label">
                  Fix plan <span className="rb-tag">{result.fix.estimatedResolutionTime}</span>
                </div>
                <div className="fix-list">
                  {result.fix.immediate.map((s, i) => (
                    <div key={i} className="fix-item">
                      <span className="fix-n">{i + 1}</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
                {result.fix.longTerm.length > 0 && (
                  <>
                    <div className="lt-label">Long term</div>
                    {result.fix.longTerm.map((s, i) => (
                      <div key={i} className="lt-item">→ {s}</div>
                    ))}
                  </>
                )}
                {result.fix.rollbackPlan && (
                  <div className="rollback-note">Rollback: {result.fix.rollbackPlan}</div>
                )}
              </div>

              {/* Confidence bars */}
              <div className="result-block">
                <div className="rb-label">Confidence breakdown</div>
                {Object.entries(result.confidence.breakdown).map(([k, v]) => (
                  <div key={k} className="cbar-row">
                    <span className="cbar-key">
                      {k.replace(/([A-Z])/g, " $1").trim()}
                    </span>
                    <div className="cbar-track">
                      <div
                        className="cbar-fill"
                        style={{
                          width: v + "%",
                          background: v >= 80 ? "#22c55e" : v >= 60 ? "#f59e0b" : "#ef4444",
                        }}
                      />
                    </div>
                    <span className="cbar-val">{v}%</span>
                  </div>
                ))}
              </div>

              {/* Confidence signals */}
              {result?.confidence?.signals?.length > 0 && (
                <div className="pattern-row">
                  {result.confidence.signals.map(s => (
                    <span key={s} className="pattern-chip">
                      {s.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}

              {/* Patterns */}
              {result.logSummary.patterns.length > 0 && (
                <div className="pattern-row">
                  <div style={{ width: "100%", fontSize: "10px", color: "#555", letterSpacing: "1px", marginBottom: "6px" }}>
                    PATTERNS
                  </div>
                  {result.logSummary.patterns.map(p => (
                    <span key={p} className="pattern-chip">
                      {p.replace("_", " ")}
                    </span>
                  ))}
                </div>
              )}

              {/* Agent handoffs */}
              <div className="handoff-block">
                <button className="handoff-btn" onClick={() => setHandoffOpen(o => !o)}>
                  Agent handoffs {handoffOpen ? "▲" : "▼"}
                </button>
                {handoffOpen && result.handoffs && (
                  <div className="handoff-list">
                    {result.handoffs.map((h, i) => (
                      <div key={i} className="handoff-row">
                        <span className="handoff-arrow">{h.from} →</span>
                        <span className="handoff-msg">{h.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Agent trace */}
              <div className="trace-block">
                <button className="trace-btn" onClick={() => setTraceOpen(o => !o)}>
                  Agent trace {traceOpen ? "▲" : "▼"}
                </button>
                {traceOpen && (
                  <div className="trace-list">
                    {result.agentTrace.map((t, i) => (
                      <div key={i} className="trace-row">
                        <span className="trace-dot" />
                        {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="footer">AIRS · multi-agent system · by Shreayas Zagare</div>
    </div>
  );
}