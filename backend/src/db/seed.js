import { db } from "../config/db.js";
import { users, proposals, votes, treasuryTransactions, comprehensionLogs } from "../db/schema.js";
import crypto from "crypto";

async function seed() {
  console.log("🌱 Seeding database...");

  // ── 1. Users ────────────────────────────────────────────────────────────────
  console.log("Creating users...");
  const seedUsers = [
    { walletAddress: "0xad000000000000000000000000000000000000a1", name: "Admin User", role: "admin", nonce: crypto.randomBytes(32).toString("hex") },
    { walletAddress: "0xde000000000000000000000000000000000000a1", name: "Alice Delegate", role: "delegate", nonce: crypto.randomBytes(32).toString("hex") },
    { walletAddress: "0xb0000000000000000000000000000000000000b1", name: "Bob Member", role: "member", nonce: crypto.randomBytes(32).toString("hex") },
    { walletAddress: "0xc0000000000000000000000000000000000000c1", name: "Carol Member", role: "member", nonce: crypto.randomBytes(32).toString("hex") },
    { walletAddress: "0xd0000000000000000000000000000000000000d1", name: "Dave Member", role: "member", nonce: crypto.randomBytes(32).toString("hex") },
  ];

  const insertedUsers = await db.insert(users).values(seedUsers).returning().onConflictDoNothing();
  console.log(`✅ Created ${insertedUsers.length} users`);

  // Fetch all users to get IDs
  const allUsers = await db.select().from(users);
  const [admin, delegate, ...members] = allUsers;

  // ── 2. Proposals ─────────────────────────────────────────────────────────────
  console.log("Creating proposals...");
  const categories = ["budget", "governance", "technical", "partnership", "community"];
  const sampleProposals = [
    {
      title: "Fund Community Developer Grants Program",
      description: "Allocate 50,000 AGT tokens to fund 10 developer grants of 5,000 AGT each. Developers will build integrations and tooling for the DAO ecosystem. Applications reviewed quarterly by technical committee.",
      category: "budget",
      manualLabel: "budget",
      requestedAmount: "50000",
      status: "active",
    },
    {
      title: "Implement On-Chain Proposal Voting Timeout",
      description: "Update DAOGovernance contract to automatically mark proposals as 'defeated' after voting period ends without manual execution. Reduces admin overhead and enforces time-bound governance.",
      category: "technical",
      manualLabel: "technical",
      requestedAmount: "0",
      status: "active",
    },
    {
      title: "Partnership with DeFi Protocol for Treasury Yield",
      description: "Deposit 30% of treasury ETH into a DeFi yield protocol to generate passive income for the DAO. Expected APY 4-6%. Partnership agreement reviewed by legal committee.",
      category: "partnership",
      manualLabel: "partnership",
      requestedAmount: "15000",
      status: "active",
    },
    {
      title: "Reduce Quorum Requirement from 25% to 20%",
      description: "Current 25% quorum is too high and prevents proposals from passing. Proposal to reduce quorum to 20% of total token supply to improve governance velocity while maintaining security.",
      category: "governance",
      manualLabel: "governance",
      requestedAmount: "0",
      status: "approved",
    },
    {
      title: "Launch Educational Workshop Series",
      description: "Fund a 6-month series of online workshops about DAO governance, blockchain basics, and DeFi for community members. Budget covers speaker fees, platform costs, and marketing.",
      category: "community",
      manualLabel: "community",
      requestedAmount: "8000",
      status: "active",
    },
    {
      title: "Upgrade Smart Contract Security Audit",
      description: "Commission a professional smart contract security audit from Trail of Bits for all 3 DAO contracts (DAOToken, DAOGovernance, DAOTreasury). Critical for mainnet deployment confidence.",
      category: "technical",
      manualLabel: "technical",
      requestedAmount: "25000",
      status: "active",
    },
    {
      title: "Increase Delegate Voting Power Multiplier",
      description: "Proposal to give elected delegates a 1.5x voting power multiplier to recognize their commitment and expertise. Delegates must have participated in 80% of votes in the last quarter.",
      category: "governance",
      manualLabel: "governance",
      requestedAmount: "0",
      status: "active",
    },
    {
      title: "Community Events Budget Q3",
      description: "Allocate 12,000 AGT for community meetups, hackathons, and online events for Q3 2025. Includes venue costs, prizes, and streaming infrastructure.",
      category: "community",
      manualLabel: "community",
      requestedAmount: "12000",
      status: "draft",
    },
    {
      title: "Integrate Chainlink Price Oracles",
      description: "Add Chainlink price feed oracles to the treasury contracts to calculate real-time USD value of treasury holdings. Enables better financial reporting and risk management.",
      category: "technical",
      manualLabel: "technical",
      requestedAmount: "3000",
      status: "active",
    },
    {
      title: "Strategic Partnership with Layer 2 Network",
      description: "Establish formal partnership with a leading L2 network to deploy DAO contracts on L2 for lower gas costs. Partnership includes co-marketing and technical support.",
      category: "partnership",
      manualLabel: "partnership",
      requestedAmount: "5000",
      status: "active",
    },
    {
      title: "Treasury Diversification — Buy ETH and BTC",
      description: "Diversify 20% of treasury holdings from AGT tokens into ETH and BTC to reduce single-asset risk. Portfolio: 15% ETH, 5% BTC. Rebalanced quarterly.",
      category: "budget",
      manualLabel: "budget",
      requestedAmount: "100000",
      status: "rejected",
    },
    {
      title: "Create Governance Ambassador Program",
      description: "Establish a paid ambassador program with 5 regional ambassadors who promote DAO governance participation in their communities. Monthly stipend of 500 AGT per ambassador.",
      category: "community",
      manualLabel: "community",
      requestedAmount: "30000",
      status: "active",
    },
    {
      title: "Update Proposal Submission Fee",
      description: "Introduce a small proposal submission fee of 100 AGT to prevent spam proposals. Fee is burned (deflationary). Hardship waiver available for first-time proposers.",
      category: "governance",
      manualLabel: "governance",
      requestedAmount: "0",
      status: "active",
    },
    {
      title: "Fund Open Source Tooling for DAO Analytics",
      description: "Commission development of open-source analytics dashboard for tracking DAO KPIs — participation rates, treasury health, proposal quality. To be released under MIT license.",
      category: "budget",
      manualLabel: "budget",
      requestedAmount: "20000",
      status: "active",
    },
    {
      title: "Cross-DAO Governance Research Collaboration",
      description: "Partner with 3 other DAOs to conduct joint research on governance mechanism design. Pool resources for academic publication and present findings at ETHDenver.",
      category: "partnership",
      manualLabel: "partnership",
      requestedAmount: "7500",
      status: "active",
    },
  ];

  const proposalData = sampleProposals.map((p, i) => ({
    ...p,
    creatorId: i % 2 === 0 ? admin?.id : delegate?.id,
    aiSummary: `AI Summary: This proposal aims to ${p.title.toLowerCase()}. It involves ${p.category} considerations with a requested amount of ${p.requestedAmount} AGT.`,
    aiRiskScore: (Math.random() * 6 + 2).toFixed(1),
    aiRiskBreakdown: {
      financial_impact: Math.floor(Math.random() * 8 + 2),
      weight_fi: 0.4,
      technical_complexity: Math.floor(Math.random() * 7 + 1),
      weight_tc: 0.35,
      historical_risk: Math.floor(Math.random() * 6 + 1),
      weight_hr: 0.25,
      formula_display: "0.4×FI + 0.35×TC + 0.25×HR",
    },
    aiCategory: p.category,
    aiConfidence: (Math.random() * 20 + 75).toFixed(1),
    votingDurationDays: 7,
    votingEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }));

  const insertedProposals = await db.insert(proposals).values(proposalData).returning();
  console.log(`✅ Created ${insertedProposals.length} proposals`);

  // ── 3. Votes ─────────────────────────────────────────────────────────────────
  console.log("Creating votes...");
  const activeProposals = insertedProposals.filter((p) => p.status === "active");
  const voteChoices = ["for", "for", "for", "against", "abstain"];

  const voteData = [];
  for (const proposal of activeProposals.slice(0, 10)) {
    for (const user of allUsers) {
      const choice = voteChoices[Math.floor(Math.random() * voteChoices.length)];
      const sawAI = Math.random() > 0.4;
      voteData.push({
        proposalId: proposal.id,
        voterId: user.id,
        choice,
        votingPower: Math.floor(Math.random() * 900 + 100).toString(),
        sawAiSummary: sawAI,
        txHash: `0x${crypto.randomBytes(32).toString("hex")}`,
      });
    }
  }

  const insertedVotes = await db.insert(votes).values(voteData).returning().onConflictDoNothing();
  console.log(`✅ Created ${insertedVotes.length} votes`);

  // ── 4. Treasury ───────────────────────────────────────────────────────────────
  console.log("Creating treasury transactions...");
  const txData = [
    { type: "inflow", asset: "ETH", amount: "10.000000", description: "Initial DAO treasury funding" },
    { type: "inflow", asset: "ETH", amount: "5.500000", description: "Community donation Q1 2025" },
    { type: "outflow", asset: "ETH", amount: "2.000000", description: "Infrastructure and server costs" },
    { type: "inflow", asset: "AGT", amount: "1000000.000000", description: "AGT token distribution pool" },
    { type: "outflow", asset: "ETH", amount: "1.500000", description: "Development bounty payout — Alice" },
    { type: "inflow", asset: "ETH", amount: "3.000000", description: "Partnership contribution — Protocol X" },
    { type: "outflow", asset: "AGT", amount: "50000.000000", description: "Governance reward Q1 distribution" },
    { type: "outflow", asset: "ETH", amount: "0.750000", description: "Smart contract audit — Trail of Bits" },
    { type: "inflow", asset: "ETH", amount: "2.250000", description: "Yield farming returns Q1" },
    { type: "outflow", asset: "ETH", amount: "0.500000", description: "Hackathon prize pool" },
  ];

  const insertedTxs = await db.insert(treasuryTransactions).values(txData).returning();
  console.log(`✅ Created ${insertedTxs.length} treasury transactions`);

  // ── 5. Comprehension Logs ─────────────────────────────────────────────────────
  console.log("Creating comprehension logs...");
  const logData = [];
  for (const proposal of activeProposals.slice(0, 8)) {
    for (const user of allUsers) {
      const sawAI = Math.random() > 0.5;
      // Users who saw AI score ~7-9, without AI score ~4-6 (proves +35% gap)
      const score = sawAI
        ? Math.floor(Math.random() * 3 + 7)
        : Math.floor(Math.random() * 3 + 4);
      logData.push({
        proposalId: proposal.id,
        userId: user.id,
        sawAiSummary: sawAI,
        comprehensionScore: score,
        timeOnPageSeconds: Math.floor(Math.random() * 180 + 30),
      });
    }
  }

  const insertedLogs = await db.insert(comprehensionLogs).values(logData).returning();
  console.log(`✅ Created ${insertedLogs.length} comprehension logs`);

  console.log("\n🎉 Database seeded successfully!");
  console.log(`   Users:                  ${insertedUsers.length}`);
  console.log(`   Proposals:              ${insertedProposals.length}`);
  console.log(`   Votes:                  ${insertedVotes.length}`);
  console.log(`   Treasury Transactions:  ${insertedTxs.length}`);
  console.log(`   Comprehension Logs:     ${insertedLogs.length}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
