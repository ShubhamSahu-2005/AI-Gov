import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
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
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
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

// Attach io BEFORE routes so handlers can emit events via req.io
// (must come after httpServer/io creation below — see bottom of file)

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
const httpServer = createServer(app);

// ── WebSocket Server (Phase 4) ────────────────────────────────────────────────
const io = new Server(httpServer, {
  path: "/ws",
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`🔌 Client connected to WS: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Attach io to req so routes can emit real-time events
// This middleware runs for every request — must be registered AFTER io is created
app.use((req, _res, next) => {
  req.io = io;
  next();
});

httpServer.listen(PORT, () => {
  console.log(`🚀 AI-Gov API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api/v1`);
  console.log(`   WS:     ws://localhost:${PORT}/ws`);
});

import { pool } from "./config/db.js";

const gracefulShutdown = async (signal) => {
  console.log(`\nShutting down gracefully (${signal})...`);
  
  // Force shutdown after 2 seconds if connections linger
  const forceExit = setTimeout(() => {
    console.error("Forcing shutdown due to lingering connections...");
    if (signal === "SIGUSR2") {
      process.kill(process.pid, "SIGUSR2");
    } else {
      process.exit(0);
    }
  }, 2000);

  // Allow timeout to not block event loop
  forceExit.unref();

  try {
    if (pool) await pool.end();
    httpServer.close(() => {
      clearTimeout(forceExit);
      console.log("HTTP server closed.");
      if (signal === "SIGUSR2") {
        process.kill(process.pid, "SIGUSR2");
      } else {
        process.exit(0);
      }
    });
  } catch (err) {
    console.error("Error during shutdown:", err);
    if (signal === "SIGUSR2") process.kill(process.pid, "SIGUSR2");
    else process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.once("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // Nodemon restart

export default app;