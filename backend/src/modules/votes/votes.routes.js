import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db.js";
import { votes, proposals, users } from "../../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { cacheDelete, cacheDeletePattern } from "../../services/cacheService.js";

const router = Router();
router.use(authenticate);

const castSchema = z.object({
  proposalId: z.string().uuid(),
  choice: z.enum(["for", "against", "abstain"]),
  txHash: z.string().optional(),
  sawAiSummary: z.boolean().default(false),
  votingPower: z.number().positive().default(1),
});

const QUORUM_PERCENT = 20; // 20% of total members must vote

// POST /votes — cast a vote
router.post("/", validate(castSchema), async (req, res, next) => {
  try {
    const { proposalId, choice, txHash, sawAiSummary, votingPower } = req.body;

    // Check proposal exists and is active
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    if (proposal.status !== "active") {
      return res.status(400).json({ success: false, message: "Proposal is not active" });
    }

    if (proposal.votingEndsAt && new Date() > new Date(proposal.votingEndsAt)) {
      return res.status(400).json({ success: false, message: "Voting period has ended" });
    }

    // Check not already voted
    const existing = await db
      .select()
      .from(votes)
      .where(and(eq(votes.proposalId, proposalId), eq(votes.voterId, req.user.id)))
      .limit(1);

    if (existing.length) {
      return res.status(409).json({ success: false, message: "Already voted on this proposal" });
    }

    const [vote] = await db
      .insert(votes)
      .values({
        proposalId,
        voterId: req.user.id,
        choice,
        votingPower: votingPower.toString(),
        txHash,
        sawAiSummary,
      })
      .returning();

    await cacheDeletePattern(`votes:${proposalId}:*`);
    res.status(201).json({ success: true, data: vote });
  } catch (err) {
    next(err);
  }
});

// GET /votes/proposal/:id — all votes for a proposal
router.get("/proposal/:id", async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: votes.id,
        choice: votes.choice,
        votingPower: votes.votingPower,
        txHash: votes.txHash,
        sawAiSummary: votes.sawAiSummary,
        createdAt: votes.createdAt,
        voter: {
          id: users.id,
          walletAddress: users.walletAddress,
          name: users.name,
        },
      })
      .from(votes)
      .leftJoin(users, eq(votes.voterId, users.id))
      .where(eq(votes.proposalId, req.params.id));

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

// GET /votes/proposal/:id/summary — counts + % + quorum
router.get("/proposal/:id/summary", async (req, res, next) => {
  try {
    const allVotes = await db
      .select()
      .from(votes)
      .where(eq(votes.proposalId, req.params.id));

    const totalMembers = await db.select({ count: sql`count(*)` }).from(users);
    const memberCount = Number(totalMembers[0].count);

    const forVotes = allVotes.filter((v) => v.choice === "for");
    const againstVotes = allVotes.filter((v) => v.choice === "against");
    const abstainVotes = allVotes.filter((v) => v.choice === "abstain");

    const sumPower = (arr) => arr.reduce((s, v) => s + Number(v.votingPower), 0);
    const totalPower = sumPower(allVotes);
    const forPower = sumPower(forVotes);
    const againstPower = sumPower(againstVotes);
    const abstainPower = sumPower(abstainVotes);

    const quorumReached = memberCount > 0 && (allVotes.length / memberCount) * 100 >= QUORUM_PERCENT;

    res.json({
      success: true,
      data: {
        totalVotes: allVotes.length,
        totalMembers: memberCount,
        quorumPercent: QUORUM_PERCENT,
        quorumReached,
        participationPercent:
          memberCount > 0 ? ((allVotes.length / memberCount) * 100).toFixed(1) : "0",
        for: {
          count: forVotes.length,
          power: forPower,
          percent: totalPower > 0 ? ((forPower / totalPower) * 100).toFixed(1) : "0",
        },
        against: {
          count: againstVotes.length,
          power: againstPower,
          percent: totalPower > 0 ? ((againstPower / totalPower) * 100).toFixed(1) : "0",
        },
        abstain: {
          count: abstainVotes.length,
          power: abstainPower,
          percent: totalPower > 0 ? ((abstainPower / totalPower) * 100).toFixed(1) : "0",
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /votes/:id — retract vote if proposal still active
router.delete("/:id", async (req, res, next) => {
  try {
    const [vote] = await db
      .select()
      .from(votes)
      .where(eq(votes.id, req.params.id))
      .limit(1);

    if (!vote) {
      return res.status(404).json({ success: false, message: "Vote not found" });
    }

    if (vote.voterId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not your vote" });
    }

    // Check proposal still active
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(eq(proposals.id, vote.proposalId))
      .limit(1);

    if (proposal?.status !== "active") {
      return res.status(400).json({ success: false, message: "Cannot retract — proposal not active" });
    }

    await db.delete(votes).where(eq(votes.id, req.params.id));
    await cacheDeletePattern(`votes:${vote.proposalId}:*`);
    res.json({ success: true, message: "Vote retracted" });
  } catch (err) {
    next(err);
  }
});

// POST /comprehension — log comprehension score after vote
router.post(
  "/comprehension",
  validate(
    z.object({
      proposalId: z.string().uuid(),
      comprehensionScore: z.number().int().min(1).max(10),
      sawAiSummary: z.boolean(),
      timeOnPageSeconds: z.number().int().nonnegative().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      // Import here to avoid circular deps
      const { comprehensionLogs } = await import("../../db/schema.js");

      const { proposalId, comprehensionScore, sawAiSummary, timeOnPageSeconds } = req.body;

      const [log] = await db
        .insert(comprehensionLogs)
        .values({
          proposalId,
          userId: req.user.id,
          comprehensionScore,
          sawAiSummary,
          timeOnPageSeconds,
        })
        .returning();

      res.status(201).json({ success: true, data: log });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
