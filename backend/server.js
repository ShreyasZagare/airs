import "dotenv/config";
import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { orchestrate } from "./orchestrator/orchestrator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// ---------- CONFIG ----------
const MAX_LOG_LINES = 500;
// ----------------------------

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const defaultLogs = JSON.parse(
  readFileSync(join(__dirname, "data/logs.json"), "utf-8")
);

// Analyze default sample logs
app.get("/api/analyze", async (_req, res) => {
  try {
    const result = await orchestrate(defaultLogs);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    let { logs } = req.body;

    // Accept any non‑empty input (string, array, object, etc.)
    if (!logs || (typeof logs === "string" && logs.trim() === "")) {
      return res.status(400).json({
        success: false,
        error: "Request body must include a non‑empty `logs` field",
      });
    }

    if (typeof logs === "string") {
      const lines = logs.split(/\r?\n/);
      if (lines.length > MAX_LOG_LINES) {
        logs = lines.slice(-MAX_LOG_LINES).join("\n");
      }
    } else if (Array.isArray(logs)) {
      if (logs.length > MAX_LOG_LINES) {
        logs = logs.slice(-MAX_LOG_LINES);
      }
    }

    const result = await orchestrate(logs);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 AIRS backend running on http://localhost:${PORT}`);
  console.log(`   GET  /api/analyze   → analyze sample logs`);
  console.log(`   POST /api/analyze   → analyze any log format (keeps last ${MAX_LOG_LINES} lines)`);
  console.log(`   GET  /api/health    → health check\n`);
});