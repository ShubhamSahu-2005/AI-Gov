import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db.js";
import { proposals } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  analyzeProposal,
  summarizeProposal,
  classifyProposal,
  scoreRisk,
} from "../../services/aiService.js";

const router = Router();
router.use(authenticate);

const textSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  requestedAmount: z.number().nonnegative().optional().default(0),
});

// POST /ai/analyze — full analysis for a proposal by ID
router.post(
  "/analyze",
  validate(z.object({ proposalId: z.string().uuid() })),
  async (req, res, next) => {
    try {
      const [proposal] = await db
        .select()
        .from(proposals)
        .where(eq(proposals.id, req.body.proposalId))
        .limit(1);

      if (!proposal) {
        return res.status(404).json({ success: false, message: "Proposal not found" });
      }

      const analysis = await analyzeProposal({
        title: proposal.title,
        description: proposal.description,
        requestedAmount: proposal.requestedAmount || 0,
      });

      // Update DB with fresh analysis
      await db
        .update(proposals)
        .set({
          aiSummary: analysis.summary,
          aiRiskScore: analysis.ai_risk_score?.toString(),
          aiRiskBreakdown: analysis.ai_risk_breakdown,
          aiCategory: analysis.ai_category,
          aiConfidence: analysis.ai_confidence?.toString(),
        })
        .where(eq(proposals.id, proposal.id));

      res.json({ success: true, data: analysis });
    } catch (err) {
      next(err);
    }
  }
);

// POST /ai/summarize — summarize arbitrary text
router.post("/summarize", validate(textSchema), async (req, res, next) => {
  try {
    const summary = await summarizeProposal(req.body);
    res.json({ success: true, data: { summary } });
  } catch (err) {
    next(err);
  }
});

// POST /ai/classify — classify text → category + confidence
router.post("/classify", validate(textSchema), async (req, res, next) => {
  try {
    const result = await classifyProposal(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /ai/risk — score risk with formula breakdown
router.post("/risk", validate(textSchema), async (req, res, next) => {
  try {
    const result = await scoreRisk(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
