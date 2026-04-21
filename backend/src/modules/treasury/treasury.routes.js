import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db.js";
import { treasuryTransactions, proposals } from "../../db/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import { authenticate } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { treasuryContract } from "../../config/blockchain.js";

const router = Router();
router.use(authenticate);

// GET /treasury/balance — ETH balance from DAOTreasury contract
router.get("/balance", async (req, res, next) => {
  try {
    let onChainBalance = null;

    if (treasuryContract) {
      try {
        const balanceWei = await treasuryContract.getBalance();
        onChainBalance = {
          wei: balanceWei.toString(),
          eth: parseFloat((Number(balanceWei) / 1e18).toFixed(6)),
        };
      } catch (err) {
        console.warn("Could not fetch on-chain balance:", err.message);
      }
    }

    // Also get DB tracked balance
    const rows = await db.select().from(treasuryTransactions);
    const dbBalance = rows.reduce((sum, tx) => {
      const amt = parseFloat(tx.amount);
      return tx.type === "inflow" ? sum + amt : sum - amt;
    }, 0);

    res.json({
      success: true,
      data: {
        onChainBalance,
        dbBalance: parseFloat(dbBalance.toFixed(6)),
        currency: "ETH",
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /treasury/transactions
router.get("/transactions", async (req, res, next) => {
  try {
    const txs = await db
      .select()
      .from(treasuryTransactions)
      .orderBy(desc(treasuryTransactions.createdAt));

    res.json({ success: true, data: txs });
  } catch (err) {
    next(err);
  }
});

// GET /treasury/analytics — monthly breakdown
router.get("/analytics", async (req, res, next) => {
  try {
    const monthly = await db.execute(sql`
      SELECT
        DATE_TRUNC('month', created_at) AS month,
        type,
        asset,
        SUM(amount::numeric) AS total
      FROM treasury_transactions
      GROUP BY 1, 2, 3
      ORDER BY 1 DESC
    `);

    const byAsset = await db.execute(sql`
      SELECT asset, SUM(amount::numeric) AS total, type
      FROM treasury_transactions
      GROUP BY asset, type
    `);

    res.json({ success: true, data: { monthly: monthly.rows, byAsset: byAsset.rows } });
  } catch (err) {
    next(err);
  }
});

// POST /treasury/seed — add demo transactions (admin only)
router.post("/seed", requireAdmin, async (req, res, next) => {
  try {
    const seedData = [
      { type: "inflow", asset: "ETH", amount: "10.0", description: "Initial DAO treasury funding" },
      { type: "inflow", asset: "ETH", amount: "5.5", description: "Community donation Q1" },
      { type: "outflow", asset: "ETH", amount: "2.0", description: "Infrastructure costs" },
      { type: "inflow", asset: "AGT", amount: "50000", description: "Token distribution pool" },
      { type: "outflow", asset: "ETH", amount: "1.5", description: "Development bounty payout" },
      { type: "inflow", asset: "ETH", amount: "3.0", description: "Partnership contribution" },
      { type: "outflow", asset: "AGT", amount: "5000", description: "Governance reward distribution" },
      { type: "outflow", asset: "ETH", amount: "0.75", description: "Audit payment" },
    ];

    const inserted = await db.insert(treasuryTransactions).values(seedData).returning();
    res.json({ success: true, data: inserted, message: `Seeded ${inserted.length} treasury transactions` });
  } catch (err) {
    next(err);
  }
});

export default router;
