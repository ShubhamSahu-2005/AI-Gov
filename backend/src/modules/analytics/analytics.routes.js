import { Router } from "express";
import { db } from "../../config/db.js";
import { proposals, votes, users, comprehensionLogs } from "../../db/schema.js";
import { eq, sql, and, isNotNull } from "drizzle-orm";
import { authenticate } from "../../middleware/auth.js";
import { cacheGet, cacheSet } from "../../services/cacheService.js";

const router = Router();
router.use(authenticate);

// GET /analytics/overview
router.get("/overview", async (req, res, next) => {
  try {
    const cached = await cacheGet("analytics:overview");
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    const [totalProposals, activeProposals, totalMembers, totalVotes, nonDraftProposals] =
      await Promise.all([
        db.execute(sql`SELECT COUNT(*)::int AS count FROM proposals`),
        db.execute(sql`SELECT COUNT(*)::int AS count FROM proposals WHERE status = 'active'`),
        db.execute(sql`SELECT COUNT(*)::int AS count FROM users`),
        db.execute(sql`SELECT COUNT(*)::int AS count FROM votes`),
        db.execute(sql`SELECT COUNT(*)::int AS count FROM proposals WHERE status != 'draft'`),
      ]);

    const tp = totalProposals.rows[0].count;
    const ap = activeProposals.rows[0].count;
    const tm = totalMembers.rows[0].count;
    const tv = totalVotes.rows[0].count;
    const nd = nonDraftProposals.rows[0].count;

    const participationPercent =
      nd > 0 && tm > 0 ? ((tv / (nd * tm)) * 100).toFixed(1) : "0";

    const data = {
      totalProposals: tp,
      activeProposals: ap,
      totalMembers: tm,
      totalVotes: tv,
      avgParticipationPercent: participationPercent,
    };

    await cacheSet("analytics:overview", data, 60 * 3);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});


// GET /analytics/participation — voting participation over time
router.get("/participation", async (req, res, next) => {
  try {
    const cached = await cacheGet("analytics:participation");
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    const result = await db.execute(sql`
      SELECT
        DATE_TRUNC('week', v.created_at) AS week,
        COUNT(DISTINCT v.voter_id) AS unique_voters,
        COUNT(*) AS total_votes
      FROM votes v
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    await cacheSet("analytics:participation", result.rows, 60 * 5);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/proposals/by-category
router.get("/proposals/by-category", async (req, res, next) => {
  try {
    const result = await db.execute(sql`
      SELECT category, COUNT(*) AS count
      FROM proposals
      WHERE category IS NOT NULL
      GROUP BY category
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/proposals/approval-rate
router.get("/proposals/approval-rate", async (req, res, next) => {
  try {
    const result = await db.execute(sql`
      SELECT
        category,
        COUNT(*) AS total,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved,
        ROUND(100.0 * COUNT(CASE WHEN status = 'approved' THEN 1 END) / NULLIF(COUNT(*), 0), 1) AS approval_rate
      FROM proposals
      WHERE category IS NOT NULL AND status != 'draft'
      GROUP BY category
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/ai/accuracy — AI classification accuracy vs manual labels
router.get("/ai/accuracy", async (req, res, next) => {
  try {
    const cached = await cacheGet("analytics:ai:accuracy");
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    const result = await db.execute(sql`
      SELECT
        COUNT(*) AS total_labeled,
        COUNT(CASE WHEN ai_category = manual_label THEN 1 END) AS correct,
        ROUND(100.0 * COUNT(CASE WHEN ai_category = manual_label THEN 1 END) / NULLIF(COUNT(*), 0), 1) AS accuracy_percent,
        category,
        manual_label,
        ai_category,
        COUNT(*) AS category_count
      FROM proposals
      WHERE manual_label IS NOT NULL AND ai_category IS NOT NULL
      GROUP BY ROLLUP(category, manual_label, ai_category)
      ORDER BY category NULLS LAST
    `);

    const labeledRows = await db
      .select({
        id: proposals.id,
        category: proposals.category,
        manualLabel: proposals.manualLabel,
        aiCategory: proposals.aiCategory,
        aiConfidence: proposals.aiConfidence,
      })
      .from(proposals)
      .where(and(isNotNull(proposals.manualLabel), isNotNull(proposals.aiCategory)));

    const total = labeledRows.length;
    const correct = labeledRows.filter((r) => r.aiCategory === r.manualLabel).length;
    const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : "0";

    const data = {
      totalLabeled: total,
      correct,
      accuracyPercent: parseFloat(accuracy),
      byCategory: labeledRows.reduce((acc, row) => {
        const cat = row.manualLabel || "unknown";
        if (!acc[cat]) acc[cat] = { total: 0, correct: 0 };
        acc[cat].total++;
        if (row.aiCategory === row.manualLabel) acc[cat].correct++;
        return acc;
      }, {}),
    };

    await cacheSet("analytics:ai:accuracy", data, 60 * 10);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/comprehension — WITH vs WITHOUT AI (+35% research claim)
router.get("/comprehension", async (req, res, next) => {
  try {
    const cached = await cacheGet("analytics:comprehension");
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    const result = await db.execute(sql`
      SELECT
        saw_ai_summary,
        COUNT(*) AS total_responses,
        ROUND(AVG(comprehension_score), 2) AS avg_score,
        ROUND(MIN(comprehension_score), 2) AS min_score,
        ROUND(MAX(comprehension_score), 2) AS max_score
      FROM comprehension_logs
      WHERE comprehension_score IS NOT NULL
      GROUP BY saw_ai_summary
    `);

    const withAI = result.rows.find((r) => r.saw_ai_summary === true);
    const withoutAI = result.rows.find((r) => r.saw_ai_summary === false);

    const gap =
      withAI && withoutAI
        ? ((withAI.avg_score - withoutAI.avg_score) / withoutAI.avg_score) * 100
        : null;

    const data = {
      withAI: withAI || null,
      withoutAI: withoutAI || null,
      comprehensionGapPercent: gap ? parseFloat(gap.toFixed(1)) : null,
      totalResponses: result.rows.reduce((s, r) => s + Number(r.total_responses), 0),
    };

    await cacheSet("analytics:comprehension", data, 60 * 5);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
