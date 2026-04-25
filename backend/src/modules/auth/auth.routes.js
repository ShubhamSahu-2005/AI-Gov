import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import { db } from "../../config/db.js";
import { users } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { env } from "../../config/env.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

const router = Router();

const ACCESS_EXPIRES = "15m";
const REFRESH_EXPIRES = "7d";

function generateTokens(userId, role) {
  const accessToken = jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  });
  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
  });
  return { accessToken, refreshToken };
}

// GET /auth/nonce/:address — generate nonce challenge for wallet
router.get("/nonce/:address", async (req, res, next) => {
  try {
    const { address } = req.params;
    if (!ethers.isAddress(address)) {
      return res.status(400).json({ success: false, message: "Invalid wallet address" });
    }

    const nonce = crypto.randomBytes(32).toString("hex");
    const walletAddr = address.toLowerCase();

    // Upsert user
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, walletAddr))
      .limit(1);

    if (existing.length) {
      await db.update(users).set({ nonce }).where(eq(users.walletAddress, walletAddr));
    } else {
      await db.insert(users).values({ walletAddress: walletAddr, nonce });
    }

    const message = `Sign this message to login to AI-gov.\nNonce: ${nonce}`;
    res.json({ success: true, data: { nonce, message } });
  } catch (err) {
    next(err);
  }
});

// POST /auth/verify — verify MetaMask signature → issue JWT
router.post(
  "/verify",
  validate(z.object({ address: z.string(), signature: z.string() })),
  async (req, res, next) => {
    try {
      const { address, signature } = req.body;
      const walletAddr = address.toLowerCase();

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, walletAddr))
        .limit(1);

      if (!user || !user.nonce) {
        return res.status(400).json({ success: false, message: "Request nonce first" });
      }

      let recovered;
      try {
        const message = `Sign this message to login to AI-gov.\nNonce: ${user.nonce}`;
        recovered = ethers.verifyMessage(message, signature).toLowerCase();
      } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid signature format" });
      }

      if (recovered !== walletAddr) {
        return res.status(401).json({ success: false, message: "Invalid signature" });
      }

      // Rotate nonce after successful auth
      const newNonce = crypto.randomBytes(32).toString("hex");
      await db.update(users).set({ nonce: newNonce }).where(eq(users.id, user.id));

      const { accessToken, refreshToken } = generateTokens(user.id, user.role);

      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        data: {
          accessToken,
          user: {
            id: user.id,
            walletAddress: user.walletAddress,
            name: user.name,
            role: user.role,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /auth/refresh — rotate refresh token → new access token
router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) {
      return res.status(401).json({ success: false, message: "No refresh token" });
    }

    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, data: { accessToken } });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Invalid refresh token" });
    }
    next(err);
  }
});

// POST /auth/logout
router.post("/logout", authenticate, (req, res) => {
  res.clearCookie("refresh_token");
  res.json({ success: true, message: "Logged out" });
});

// GET /auth/me
router.get("/me", authenticate, (req, res) => {
  const { id, walletAddress, name, role, createdAt } = req.user;
  res.json({ success: true, data: { id, walletAddress, name, role, createdAt } });
});

export default router;
