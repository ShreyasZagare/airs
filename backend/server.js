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

app.use(cors());
app.use(express.json({ limit: "5mb" })); // Increase limit to accept large log pastes (e.g., 5 MB)

// Load default sample logs
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

// Analyze custom logs – accepts ANY non‑empty format, trims if too large
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

    // --- Trim large input to keep only the most recent (bottom) logs ---
    if (typeof logs === "string") {
      // Keep at most the last 500,000 characters (~500 KB)
      if (logs.length > 500_000) {
        logs = logs.slice(-500_000);
        // Discard the first (now incomplete) line
        const firstNL = logs.indexOf("\n");
        if (firstNL > 0) logs = logs.slice(firstNL + 1);
      }
    } else if (Array.isArray(logs)) {
      // Keep at most the last 1000 entries
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }
    }

    // Pass it straight to the orchestrator – it normalises internally
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
  console.log(`   POST /api/analyze   → analyze any log format (auto‑trims large input)`);
  console.log(`   GET  /api/health    → health check\n`);
});