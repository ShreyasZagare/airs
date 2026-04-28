# ⚡ AIRS — Agentic Incident Resolution System

A multi-agent system for automated production incident diagnosis. Paste in your logs, and a 4-agent pipeline powered by Claude Sonnet diagnoses the root cause, generates a fix plan, and scores its own confidence.

---

## Problem

Production debugging is slow and manual. On-call engineers spend 30–90 minutes reproducing issues, reading logs, and guessing at fixes.

## Solution

A multi-agent pipeline that does it in seconds:

```
📋 LogAgent → 🧠 RootCauseAgent → 🛠️ FixAgent → 📊 ConfidenceAgent
```

---

## Architecture

```
airs/
├── backend/
│   ├── agents/
│   │   ├── logAgent.js          # Parses logs, detects patterns
│   │   ├── rootCauseAgent.js    # Heuristic + LLM diagnosis
│   │   ├── fixAgent.js          # LLM-powered fix plan (Claude Sonnet)
│   │   └── confidenceAgent.js   # Scores pipeline reliability
│   ├── orchestrator/
│   │   └── orchestrator.js      # Coordinates agent pipeline + trace
│   ├── utils/
│   │   └── llm.js               # Anthropic SDK wrapper
│   ├── data/
│   │   └── logs.json            # Sample log data
│   └── server.js                # Express API
└── frontend/                    # React + Vite dashboard
```

---

## Agents

| Agent | Responsibility | Method |
|---|---|---|
| **Log Agent** | Parse raw logs, extract errors/warnings, detect patterns | Rule-based |
| **Root Cause Agent** | Identify underlying cause from patterns | Heuristic-first, LLM fallback |
| **Fix Agent** | Generate immediate + long-term fix steps | Claude Sonnet |
| **Confidence Agent** | Score pipeline reliability (0–100%) | Multi-factor scoring |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Anthropic API key → https://console.anthropic.com

### Setup

```bash
# 1. Clone and enter project
git clone <your-repo-url>
cd airs

# 2. Add your API key
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Install all dependencies
npm run install:all

# 4. Start both servers
npm start
```

Frontend → http://localhost:5173  
Backend  → http://localhost:3001

---

## API

### Analyze sample logs
```
GET /api/analyze
```

### Analyze custom logs
```
POST /api/analyze
Content-Type: application/json

{
  "logs": [
    { "level": "ERROR", "message": "DB timeout", "service": "api" },
    { "level": "WARN",  "message": "High memory", "service": "worker" }
  ]
}
```

### Response shape
```json
{
  "logSummary":  { "errorMessages": [...], "counts": {...}, "patterns": [...] },
  "rootCause":   { "cause": "...", "category": "database", "method": "heuristic" },
  "fix":         { "immediate": [...], "longTerm": [...], "estimatedResolutionTime": "..." },
  "confidence":  { "score": 0.84, "percentage": 84, "level": "high", "breakdown": {...} },
  "meta":        { "durationMs": 1240, "logsAnalyzed": 7, "timestamp": "..." },
  "agentTrace":  [ "LogAgent → ...", "RootCauseAgent → ...", ... ]
}
```

---

## Tech Stack

- **Backend**: Node.js, Express
- **LLM**: Anthropic Claude Sonnet (`@anthropic-ai/sdk`)
- **Frontend**: React + Vite
- **Dev**: concurrently (single `npm start` command)

---

## Key Feature: Agent Trace

Every response includes a full trace of agent decisions:

```
📋 LogAgent → parsed 7 logs, found 3 errors and 1 warning
🧠 RootCauseAgent → heuristic matched pattern(s): [timeout, connectivity]
🛠️ FixAgent → generated 3 immediate steps and 2 long-term recommendations
📊 ConfidenceAgent → scored 84% (method: 85%, density: 90%, patterns: 78%)
⚡ Orchestrator → pipeline completed in 1240ms
```

This makes the system fully **observable** — you can see exactly how each agent reasoned.
