import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import "dotenv/config";

import authRoutes from "./modules/auth/auth.routes.js";
import proposalRoutes from "./modules/proposals/proposals.routes.js";
import voteRoutes from "./modules/votes/votes.routes.js";
import treasuryRoutes from "./modules/treasury/treasury.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  })
);

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use(limiter);

// ── Parsers ───────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// ── Routes ────────────────────────────────────────────────────────────────────
const API = "/api/v1";

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "aigov-api",
    version: "3.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/proposals`, proposalRoutes);
app.use(`${API}/votes`, voteRoutes);
app.use(`${API}/treasury`, treasuryRoutes);
app.use(`${API}/analytics`, analyticsRoutes);
app.use(`${API}/ai`, aiRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 AI-Gov API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api/v1`);
});

export default app;