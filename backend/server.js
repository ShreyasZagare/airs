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
app.use(express.json());

// Load default sample logs
const defaultLogs = JSON.parse(
  readFileSync(join(__dirname, "data/logs.json"), "utf-8")
);

// Analyze default sample logs
app.get("/api/analyze", async (req, res) => {
  try {
    const result = await orchestrate(defaultLogs);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Analyze custom logs sent in request body
app.post("/api/analyze", async (req, res) => {
  try {
    const { logs } = req.body;

    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Request body must include a non-empty `logs` array",
      });
    }

    const result = await orchestrate(logs);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 AIRS backend running on http://localhost:${PORT}`);
  console.log(`   GET  /api/analyze   → analyze sample logs`);
  console.log(`   POST /api/analyze   → analyze custom logs`);
  console.log(`   GET  /api/health    → health check\n`);
});
