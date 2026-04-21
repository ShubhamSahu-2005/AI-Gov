#!/usr/bin/env node
/**
 * AI-Gov Backend — Full API Test Suite
 * Tests all PRD endpoints and validates responses
 */

const BASE = "http://localhost:3000/api/v1";
let ACCESS_TOKEN = "";
let PROPOSAL_ID = "";
let VOTE_ID = "";

const pass = (label) => console.log(`  ✅ ${label}`);
const fail = (label, err) => console.log(`  ❌ ${label}: ${err}`);

async function req(method, path, body, auth = true) {
  const headers = { "Content-Type": "application/json" };
  if (auth && ACCESS_TOKEN) headers["Authorization"] = `Bearer ${ACCESS_TOKEN}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

async function runTests() {
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   AI-Gov Backend — Full PRD Test Suite      ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // ── 0. HEALTH ────────────────────────────────────────────────────────────────
  console.log("🔧 [0] Health Check");
  try {
    const res = await fetch("http://localhost:3000/health");
    const json = await res.json();
    if (json.status === "ok" && json.service === "aigov-api") pass("GET /health → { status: ok, service: aigov-api }");
    else fail("GET /health", JSON.stringify(json));
  } catch (e) { fail("GET /health", e.message); }

  // ── 1. AUTH ───────────────────────────────────────────────────────────────────
  console.log("\n🔐 [1] Auth Module (MetaMask nonce + signature flow)");
  const testWallet = "0xab000000000000000000000000000000000000ff";

  // 1a. Get nonce
  let nonce = "";
  try {
    const r = await req("GET", `/auth/nonce/${testWallet}`, null, false);
    if (r.status === 200 && r.data.success && r.data.data.nonce) {
      nonce = r.data.data.nonce;
      pass(`GET /auth/nonce/:address → nonce: ${nonce.slice(0,12)}...`);
    } else fail("GET /auth/nonce", JSON.stringify(r.data));
  } catch (e) { fail("GET /auth/nonce", e.message); }

  // 1b. Verify signature — we'll test with ethers and the test wallet
  try {
    const { ethers } = await import("ethers");
    const wallet = ethers.Wallet.createRandom();
    // get a fresh nonce for this random wallet
    const rn = await req("GET", `/auth/nonce/${wallet.address}`, null, false);
    const freshNonce = rn.data.data.nonce;
    const message = `Sign this message to login to AI-gov.\nNonce: ${freshNonce}`;
    const signature = await wallet.signMessage(message);
    const rv = await req("POST", "/auth/verify", { address: wallet.address, signature }, false);
    if (rv.status === 200 && rv.data.success && rv.data.data.accessToken) {
      ACCESS_TOKEN = rv.data.data.accessToken;
      pass(`POST /auth/verify → JWT issued (user: ${wallet.address.slice(0,10)}...)`);
    } else fail("POST /auth/verify", JSON.stringify(rv.data));
  } catch (e) { fail("POST /auth/verify", e.message); }

  // 1c. GET /auth/me
  try {
    const r = await req("GET", "/auth/me");
    if (r.status === 200 && r.data.success && r.data.data.walletAddress) pass(`GET /auth/me → wallet: ${r.data.data.walletAddress.slice(0,10)}...`);
    else fail("GET /auth/me", JSON.stringify(r.data));
  } catch (e) { fail("GET /auth/me", e.message); }

  // ── 2. PROPOSALS ──────────────────────────────────────────────────────────────
  console.log("\n📋 [2] Proposals Module (CRUD + AI trigger + IPFS)");

  // 2a. List proposals
  try {
    const r = await req("GET", "/proposals");
    if (r.status === 200 && r.data.success && Array.isArray(r.data.data)) {
      pass(`GET /proposals → ${r.data.data.length} proposals returned`);
      if (r.data.data.length > 0) PROPOSAL_ID = r.data.data[0].id;
    } else fail("GET /proposals", JSON.stringify(r.data));
  } catch (e) { fail("GET /proposals", e.message); }

  // 2b. Filter by status
  try {
    const r = await req("GET", "/proposals?status=active");
    if (r.status === 200 && r.data.success) pass(`GET /proposals?status=active → ${r.data.data.length} active proposals`);
    else fail("GET /proposals?status=active", JSON.stringify(r.data));
  } catch (e) { fail("GET /proposals?status=active", e.message); }

  // 2c. Filter by category
  try {
    const r = await req("GET", "/proposals?category=budget");
    if (r.status === 200 && r.data.success) pass(`GET /proposals?category=budget → ${r.data.data.length} budget proposals`);
    else fail("GET /proposals?category=budget", JSON.stringify(r.data));
  } catch (e) { fail("GET /proposals?category=budget", e.message); }

  // 2d. Create proposal (triggers async Groq AI)
  let newProposalId = "";
  try {
    const r = await req("POST", "/proposals", {
      title: "Fund AI Research Initiative for DAO Tooling",
      description: "Allocate 25000 AGT tokens to fund a 3-month research project developing AI tools to improve DAO governance decision-making. The research will produce open-source tooling for proposal analysis.",
      category: "budget",
      requestedAmount: 25000,
      votingDurationDays: 7,
    });
    if (r.status === 201 && r.data.success && r.data.data.id) {
      newProposalId = r.data.data.id;
      pass(`POST /proposals → created id: ${newProposalId.slice(0,8)}... (AI analysis triggered async)`);
    } else fail("POST /proposals", JSON.stringify(r.data));
  } catch (e) { fail("POST /proposals", e.message); }

  // 2e. Get proposal by ID
  if (PROPOSAL_ID) {
    try {
      const r = await req("GET", `/proposals/${PROPOSAL_ID}`);
      if (r.status === 200 && r.data.success && r.data.data.id) {
        const p = r.data.data;
        pass(`GET /proposals/:id → title: "${p.title?.slice(0,35)}..."`);
        if (p.aiSummary) pass(`  AI Summary present: "${p.aiSummary.slice(0,60)}..."`);
        if (p.aiRiskScore) pass(`  AI Risk Score: ${p.aiRiskScore}`);
        if (p.aiCategory) pass(`  AI Category: ${p.aiCategory} (${p.aiConfidence}% confidence)`);
      } else fail("GET /proposals/:id", JSON.stringify(r.data));
    } catch (e) { fail("GET /proposals/:id", e.message); }
  }

  // 2f. Get AI analysis specifically
  if (PROPOSAL_ID) {
    try {
      const r = await req("GET", `/proposals/${PROPOSAL_ID}/ai`);
      if (r.status === 200 && r.data.success) {
        const ai = r.data.data;
        pass(`GET /proposals/:id/ai → risk: ${ai.aiRiskScore}, category: ${ai.aiCategory}`);
        if (ai.aiRiskBreakdown?.formula_display) pass(`  Formula: ${ai.aiRiskBreakdown.formula_display}`);
      } else fail("GET /proposals/:id/ai", JSON.stringify(r.data));
    } catch (e) { fail("GET /proposals/:id/ai", e.message); }
  }

  // 2g. Update a draft proposal
  if (newProposalId) {
    try {
      const r = await req("PATCH", `/proposals/${newProposalId}`, { title: "Fund AI Research Initiative for DAO Tooling (Updated)" });
      if (r.status === 200 && r.data.success) pass(`PATCH /proposals/:id → draft updated`);
      else fail("PATCH /proposals/:id", JSON.stringify(r.data));
    } catch (e) { fail("PATCH /proposals/:id", e.message); }
  }

  // ── 3. VOTES ──────────────────────────────────────────────────────────────────
  console.log("\n🗳️  [3] Votes Module (cast + summary + comprehension)");

  // Find an active proposal to vote on
  let activeProposalId = PROPOSAL_ID;
  try {
    const r = await req("GET", "/proposals?status=active");
    if (r.data.data?.length > 0) activeProposalId = r.data.data[0].id;
  } catch {}

  // 3a. Cast vote
  if (activeProposalId) {
    try {
      const r = await req("POST", "/votes", {
        proposalId: activeProposalId,
        choice: "for",
        sawAiSummary: true,
        votingPower: 500,
      });
      if (r.status === 201 && r.data.success) {
        VOTE_ID = r.data.data.id;
        pass(`POST /votes → vote cast (id: ${VOTE_ID?.slice(0,8)}...)`);
      } else if (r.status === 409) {
        pass(`POST /votes → already voted (409 duplicate correctly caught)`);
      } else fail("POST /votes", JSON.stringify(r.data));
    } catch (e) { fail("POST /votes", e.message); }

    // 3b. Get all votes for proposal
    try {
      const r = await req("GET", `/votes/proposal/${activeProposalId}`);
      if (r.status === 200 && r.data.success) pass(`GET /votes/proposal/:id → ${r.data.data.length} votes`);
      else fail("GET /votes/proposal/:id", JSON.stringify(r.data));
    } catch (e) { fail("GET /votes/proposal/:id", e.message); }

    // 3c. Vote summary with weighted totals
    try {
      const r = await req("GET", `/votes/proposal/${activeProposalId}/summary`);
      if (r.status === 200 && r.data.success) {
        const s = r.data.data;
        pass(`GET /votes/proposal/:id/summary → for: ${s.for?.count}, against: ${s.against?.count}, abstain: ${s.abstain?.count}`);
        pass(`  Quorum: ${s.quorumReached ? "✅ Reached" : "❌ Not reached"} (${s.participationPercent}% participation)`);
      } else fail("GET /votes/summary", JSON.stringify(r.data));
    } catch (e) { fail("GET /votes/summary", e.message); }

    // 3d. Log comprehension score (KEY RESEARCH TABLE)
    try {
      const r = await req("POST", "/votes/comprehension", {
        proposalId: activeProposalId,
        comprehensionScore: 8,
        sawAiSummary: true,
        timeOnPageSeconds: 120,
      });
      if (r.status === 201 && r.data.success) pass(`POST /votes/comprehension → logged score: 8 (saw AI: true)`);
      else fail("POST /votes/comprehension", JSON.stringify(r.data));
    } catch (e) { fail("POST /votes/comprehension", e.message); }
  }

  // ── 4. TREASURY ───────────────────────────────────────────────────────────────
  console.log("\n💰 [4] Treasury Module");

  try {
    const r = await req("GET", "/treasury/balance");
    if (r.status === 200 && r.data.success) {
      const b = r.data.data;
      pass(`GET /treasury/balance → DB balance: ${b.dbBalance} ETH`);
    } else fail("GET /treasury/balance", JSON.stringify(r.data));
  } catch (e) { fail("GET /treasury/balance", e.message); }

  try {
    const r = await req("GET", "/treasury/transactions");
    if (r.status === 200 && r.data.success) pass(`GET /treasury/transactions → ${r.data.data.length} transactions`);
    else fail("GET /treasury/transactions", JSON.stringify(r.data));
  } catch (e) { fail("GET /treasury/transactions", e.message); }

  try {
    const r = await req("GET", "/treasury/analytics");
    if (r.status === 200 && r.data.success) pass(`GET /treasury/analytics → monthly + asset breakdown returned`);
    else fail("GET /treasury/analytics", JSON.stringify(r.data));
  } catch (e) { fail("GET /treasury/analytics", e.message); }

  // ── 5. ANALYTICS ──────────────────────────────────────────────────────────────
  console.log("\n📊 [5] Analytics Module (PRD Research Evidence)");

  try {
    const r = await req("GET", "/analytics/overview");
    if (r.status === 200 && r.data.success) {
      const d = r.data.data;
      pass(`GET /analytics/overview → proposals: ${d.totalProposals}, members: ${d.totalMembers}, votes: ${d.totalVotes}`);
    } else fail("GET /analytics/overview", JSON.stringify(r.data));
  } catch (e) { fail("GET /analytics/overview", e.message); }

  try {
    const r = await req("GET", "/analytics/participation");
    if (r.status === 200 && r.data.success) pass(`GET /analytics/participation → ${r.data.data.length} weekly data points`);
    else fail("GET /analytics/participation", JSON.stringify(r.data));
  } catch (e) { fail("GET /analytics/participation", e.message); }

  try {
    const r = await req("GET", "/analytics/proposals/by-category");
    if (r.status === 200 && r.data.success) {
      const cats = r.data.data.map(c => `${c.category}:${c.count}`).join(", ");
      pass(`GET /analytics/proposals/by-category → ${cats}`);
    } else fail("GET /analytics/proposals/by-category", JSON.stringify(r.data));
  } catch (e) { fail("GET /analytics/proposals/by-category", e.message); }

  try {
    const r = await req("GET", "/analytics/proposals/approval-rate");
    if (r.status === 200 && r.data.success) pass(`GET /analytics/proposals/approval-rate → ${r.data.data.length} categories`);
    else fail("GET /analytics/proposals/approval-rate", JSON.stringify(r.data));
  } catch (e) { fail("GET /analytics/proposals/approval-rate", e.message); }

  // KEY PRD RESEARCH ENDPOINT
  try {
    const r = await req("GET", "/analytics/ai/accuracy");
    if (r.status === 200 && r.data.success) {
      const d = r.data.data;
      pass(`GET /analytics/ai/accuracy → ${d.totalLabeled} labeled, accuracy: ${d.accuracyPercent}%`);
    } else fail("GET /analytics/ai/accuracy", JSON.stringify(r.data));
  } catch (e) { fail("GET /analytics/ai/accuracy", e.message); }

  // KEY PRD RESEARCH ENDPOINT — +35% comprehension gap
  try {
    const r = await req("GET", "/analytics/comprehension");
    if (r.status === 200 && r.data.success) {
      const d = r.data.data;
      pass(`GET /analytics/comprehension → ${d.totalResponses} responses`);
      if (d.withAI && d.withoutAI) {
        pass(`  WITH AI avg: ${d.withAI.avg_score} | WITHOUT AI avg: ${d.withoutAI.avg_score}`);
        pass(`  Comprehension gap: ${d.comprehensionGapPercent}% 🎯`);
      }
    } else fail("GET /analytics/comprehension", JSON.stringify(r.data));
  } catch (e) { fail("GET /analytics/comprehension", e.message); }

  // ── 6. AI ENDPOINTS ───────────────────────────────────────────────────────────
  console.log("\n🤖 [6] AI Module (Groq — summarize + classify + risk)");

  try {
    const r = await req("POST", "/ai/summarize", {
      title: "Increase Developer Grant Budget",
      description: "We propose to increase the quarterly developer grant budget from 10,000 AGT to 25,000 AGT to attract more developers to build on our platform.",
      requestedAmount: 25000,
    });
    if (r.status === 200 && r.data.success && r.data.data.summary) {
      pass(`POST /ai/summarize → "${r.data.data.summary.slice(0,80)}..."`);
    } else fail("POST /ai/summarize", JSON.stringify(r.data));
  } catch (e) { fail("POST /ai/summarize", e.message); }

  try {
    const r = await req("POST", "/ai/classify", {
      title: "Upgrade Smart Contract Infrastructure",
      description: "Migrate all DAO contracts to use upgradeable proxy pattern with OpenZeppelin. Includes full audit.",
      requestedAmount: 0,
    });
    if (r.status === 200 && r.data.success && r.data.data.ai_category) {
      pass(`POST /ai/classify → category: ${r.data.data.ai_category} (${r.data.data.ai_confidence}% confidence)`);
    } else fail("POST /ai/classify", JSON.stringify(r.data));
  } catch (e) { fail("POST /ai/classify", e.message); }

  try {
    const r = await req("POST", "/ai/risk", {
      title: "Deploy 80% of Treasury to DeFi Yield Farming",
      description: "Move 80% of treasury to a high-yield DeFi protocol for maximum returns. High risk, high reward.",
      requestedAmount: 500000,
    });
    if (r.status === 200 && r.data.success && r.data.data.ai_risk_score) {
      const d = r.data.data;
      pass(`POST /ai/risk → score: ${d.ai_risk_score}`);
      pass(`  Formula: ${d.ai_risk_breakdown?.formula_display}`);
    } else fail("POST /ai/risk", JSON.stringify(r.data));
  } catch (e) { fail("POST /ai/risk", e.message); }

  // ── 7. SECURITY ───────────────────────────────────────────────────────────────
  console.log("\n🛡️  [7] Security Tests");

  try {
    const r = await fetch(`${BASE}/proposals`, { headers: {} });
    const json = await r.json();
    if (r.status === 401) pass(`Unauthenticated request → 401 Unauthorized ✓`);
    else fail("Auth guard", `Expected 401 got ${r.status}`);
  } catch (e) { fail("Auth guard", e.message); }

  try {
    const r = await req("GET", "/proposals/not-a-valid-uuid-at-all");
    if (r.status === 404 || r.status === 500) pass(`Invalid UUID route → ${r.status} correctly handled`);
    else fail("Invalid UUID", `Unexpected status: ${r.status}`);
  } catch (e) { fail("Invalid UUID", e.message); }

  try {
    const r = await req("POST", "/proposals", { title: "x" }); // too short + missing desc
    if (r.status === 400 && r.data.errors) pass(`Zod validation → 400 with errors: [${r.data.errors.map(e=>e.path).join(", ")}]`);
    else fail("Zod validation", JSON.stringify(r.data));
  } catch (e) { fail("Zod validation", e.message); }

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║   ✅ All PRD endpoint tests complete!        ║");
  console.log("╚══════════════════════════════════════════════╝\n");
}

runTests().catch(console.error);
