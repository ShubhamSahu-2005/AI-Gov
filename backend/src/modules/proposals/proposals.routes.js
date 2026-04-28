import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db.js";
import { proposals, users, votes } from "../../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { authenticate } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/rbac.js";
import { validate } from "../../middleware/validate.js";
import { analyzeProposal } from "../../services/aiService.js";
import { uploadProposalToIPFS } from "../../services/ipfsService.js";
import { cacheGet, cacheSet, cacheDelete, cacheDeletePattern } from "../../services/cacheService.js";

// Validate uuid param middleware
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const requireUUID = (req, res, next) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid proposal ID format" });
  }
  next();
};

const router = Router();

const createSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20),
  category: z.enum(["budget", "governance", "technical", "partnership", "community"]).optional(),
  requestedAmount: z.number().nonnegative().optional(),
  votingDurationDays: z.number().int().min(1).max(30).default(7),
});

const updateSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(20).optional(),
  category: z.enum(["budget", "governance", "technical", "partnership", "community"]).optional(),
  requestedAmount: z.number().nonnegative().optional(),
});

// GET /proposals
router.get("/", async (req, res, next) => {
  try {
    const { status, category } = req.query;
    const cacheKey = `proposals:${status || "all"}:${category || "all"}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true });
    }

    const filters = [];
    if (status) filters.push(eq(proposals.status, status));
    if (category) filters.push(eq(proposals.category, category));

    const allProposals = await db
      .select()
      .from(proposals)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(proposals.createdAt));

    const allVotes = await db.select().from(votes);

    const rows = allProposals.map(p => {
      const pVotes = allVotes.filter(v => v.proposalId === p.id);
      return {
        ...p,
        votesFor: pVotes.filter(v => v.choice === 'for').length,
        votesAgainst: pVotes.filter(v => v.choice === 'against').length,
      };
    });

    await cacheSet(cacheKey, rows);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// POST /proposals — create + IPFS upload + AI analysis
router.post("/", authenticate, validate(createSchema), async (req, res, next) => {
  try {
    const { title, description, category, requestedAmount, votingDurationDays } = req.body;

    // 1. Upload to IPFS (optional — gracefully skip on error)
    let ipfsHash = null;
    try {
      ipfsHash = await uploadProposalToIPFS({ title, description, category, requestedAmount });
      if (ipfsHash) console.log("📦 IPFS CID generated:", ipfsHash);
    } catch (ipfsErr) {
      console.warn("IPFS upload skipped:", ipfsErr.message);
    }

    // 2. Insert proposal as draft
    const votingEndsAt = new Date();
    votingEndsAt.setDate(votingEndsAt.getDate() + (votingDurationDays || 7));

    // 3. Trigger Groq AI analysis synchronously
    let aiFields = {};
    try {
      const analysis = await analyzeProposal({ title, description, requestedAmount });
      aiFields = {
        aiSummary: analysis.summary,
        aiRiskScore: analysis.ai_risk_score?.toString(),
        aiRiskBreakdown: analysis.ai_risk_breakdown,
        aiCategory: analysis.ai_category,
        aiConfidence: analysis.ai_confidence?.toString(),
      };
    } catch (err) {
      console.error("AI analysis failed:", err.message);
    }

    const [proposal] = await db
      .insert(proposals)
      .values({
        creatorId: req.user.id,
        title,
        description,
        category: aiFields.aiCategory || category,
        requestedAmount: requestedAmount?.toString(),
        votingDurationDays,
        ipfsHash,
        votingEndsAt,
        status: "draft",
        ...aiFields
      })
      .returning();

    await cacheDeletePattern("proposals:*");
    res.status(201).json({ success: true, data: proposal });
  } catch (err) {
    next(err);
  }
});

// GET /proposals/:id
router.get("/:id", requireUUID, async (req, res, next) => {
  try {
    const cacheKey = `proposal:${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, req.params.id))
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    await cacheSet(cacheKey, proposal, 60 * 2); // 2 min TTL for detail
    res.json({ success: true, data: proposal });
  } catch (err) {
    next(err);
  }
});

// PATCH /proposals/:id — update draft only (re-runs AI analysis)
router.patch("/:id", authenticate, requireUUID, validate(updateSchema), async (req, res, next) => {
  try {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, req.params.id))
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    if (proposal.status !== "draft") {
      return res.status(400).json({ success: false, message: "Only draft proposals can be edited" });
    }

    if (proposal.creatorId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // Re-run AI analysis if title or description changed
    let aiFields = {};
    const titleChanged = req.body.title && req.body.title !== proposal.title;
    const descChanged = req.body.description && req.body.description !== proposal.description;
    if (titleChanged || descChanged) {
      try {
        const analysis = await analyzeProposal({
          title: req.body.title || proposal.title,
          description: req.body.description || proposal.description,
          requestedAmount: req.body.requestedAmount ?? proposal.requestedAmount,
        });
        aiFields = {
          aiSummary: analysis.summary,
          aiRiskScore: analysis.ai_risk_score?.toString(),
          aiRiskBreakdown: analysis.ai_risk_breakdown,
          aiCategory: analysis.ai_category,
          aiConfidence: analysis.ai_confidence?.toString(),
          category: analysis.ai_category || req.body.category || proposal.category,
        };
      } catch (aiErr) {
        console.error("AI re-analysis failed on PATCH:", aiErr.message);
      }
    }

    const [updated] = await db
      .update(proposals)
      .set({ ...req.body, ...aiFields })
      .where(eq(proposals.id, req.params.id))
      .returning();

    await cacheDelete(`proposal:${req.params.id}`);
    await cacheDeletePattern("proposals:*");
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /proposals/:id — delete draft only
router.delete("/:id", authenticate, requireUUID, async (req, res, next) => {
  try {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, req.params.id))
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    if (proposal.status !== "draft") {
      return res.status(400).json({ success: false, message: "Only draft proposals can be deleted" });
    }

    if (proposal.creatorId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await db.delete(proposals).where(eq(proposals.id, req.params.id));
    await cacheDelete(`proposal:${req.params.id}`);
    await cacheDeletePattern("proposals:*");
    res.json({ success: true, message: "Proposal deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /proposals/:id/submit — Draft → Active
router.post("/:id/submit", authenticate, async (req, res, next) => {
  try {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, req.params.id))
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    if (proposal.status !== "draft") {
      return res.status(400).json({ success: false, message: "Proposal is not a draft" });
    }

    if (proposal.creatorId !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // In a real flow the frontend calls DAOGovernance.createProposal() and sends onChainId
    const { onChainId, txHash } = req.body;

    const [updated] = await db
      .update(proposals)
      .set({
        status: "active",
        onChainId: onChainId ?? null,
      })
      .where(eq(proposals.id, req.params.id))
      .returning();

    await cacheDelete(`proposal:${req.params.id}`);
    await cacheDeletePattern("proposals:*");
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// GET /proposals/:id/ai — return stored AI analysis
router.get("/:id/ai", async (req, res, next) => {
  try {
    const [proposal] = await db
      .select({
        id: proposals.id,
        aiSummary: proposals.aiSummary,
        aiRiskScore: proposals.aiRiskScore,
        aiRiskBreakdown: proposals.aiRiskBreakdown,
        aiCategory: proposals.aiCategory,
        aiConfidence: proposals.aiConfidence,
      })
      .from(proposals)
      .where(eq(proposals.id, req.params.id))
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    res.json({ success: true, data: proposal });
  } catch (err) {
    next(err);
  }
});

// PATCH /proposals/:id/label — set manual_label (admin only)
router.patch("/:id/label", authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { manualLabel } = req.body;
    if (!manualLabel) {
      return res.status(400).json({ success: false, message: "manualLabel is required" });
    }

    const [updated] = await db
      .update(proposals)
      .set({ manualLabel })
      .where(eq(proposals.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    await cacheDelete(`proposal:${req.params.id}`);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /proposals/:id/execute — Active → Executed + Treasury Outflow
router.post("/:id/execute", authenticate, requireUUID, async (req, res, next) => {
  try {
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, req.params.id))
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    if (proposal.status !== "active") {
      return res.status(400).json({ success: false, message: `Cannot execute ${proposal.status} proposal` });
    }

    // 1. Calculate votes
    const allVotes = await db.select().from(votes).where(eq(votes.proposalId, req.params.id));
    const forVotes = allVotes.filter(v => v.choice === 'for').length;
    const againstVotes = allVotes.filter(v => v.choice === 'against').length;

    const passed = forVotes > againstVotes;

    // 2. Update status
    const newStatus = passed ? "executed" : "rejected";
    const [updated] = await db
      .update(proposals)
      .set({ status: newStatus })
      .where(eq(proposals.id, req.params.id))
      .returning();

    // 3. If passed and has requestedAmount, create Treasury outflow
    if (passed && proposal.requestedAmount && parseFloat(proposal.requestedAmount) > 0) {
      const { treasuryTransactions } = await import("../../db/schema.js");
      await db.insert(treasuryTransactions).values({
        type: "outflow",
        asset: "ETH",
        amount: proposal.requestedAmount,
        description: `Payout for Proposal: ${proposal.title}`,
        proposalId: proposal.id,
      });
    }

    await cacheDelete(`proposal:${req.params.id}`);
    await cacheDeletePattern("proposals:*");
    res.json({ success: true, data: updated, message: passed ? "Proposal passed and executed" : "Proposal rejected" });
  } catch (err) {
    next(err);
  }
});

export default router;
