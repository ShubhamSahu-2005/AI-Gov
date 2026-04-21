import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["member", "delegate", "admin"]);
export const proposalCategoryEnum = pgEnum("proposal_category", [
  "budget",
  "governance",
  "technical",
  "partnership",
  "community",
]);
export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "active",
  "approved",
  "rejected",
  "executed",
]);
export const voteChoiceEnum = pgEnum("vote_choice", ["for", "against", "abstain"]);
export const txTypeEnum = pgEnum("tx_type", ["inflow", "outflow"]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: varchar("wallet_address", { length: 42 }).unique().notNull(),
  name: varchar("name", { length: 100 }),
  role: userRoleEnum("role").default("member"),
  nonce: varchar("nonce", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("creator_id").references(() => users.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  ipfsHash: varchar("ipfs_hash", { length: 100 }),
  onChainId: integer("on_chain_id"),
  category: proposalCategoryEnum("category"),
  manualLabel: varchar("manual_label", { length: 60 }),
  requestedAmount: numeric("requested_amount", { precision: 20, scale: 6 }),
  votingDurationDays: integer("voting_duration_days").default(7),
  status: proposalStatusEnum("status").default("draft"),
  aiSummary: text("ai_summary"),
  aiRiskScore: numeric("ai_risk_score", { precision: 3, scale: 1 }),
  aiRiskBreakdown: jsonb("ai_risk_breakdown"),
  aiCategory: varchar("ai_category", { length: 60 }),
  aiConfidence: numeric("ai_confidence", { precision: 4, scale: 1 }),
  votingEndsAt: timestamp("voting_ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proposalId: uuid("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    voterId: uuid("voter_id")
      .notNull()
      .references(() => users.id),
    choice: voteChoiceEnum("choice").notNull(),
    votingPower: numeric("voting_power", { precision: 20, scale: 0 }).default("1"),
    txHash: varchar("tx_hash", { length: 66 }),
    sawAiSummary: boolean("saw_ai_summary").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique("uniq_vote").on(t.proposalId, t.voterId)]
);

export const treasuryTransactions = pgTable("treasury_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: txTypeEnum("type").notNull(),
  asset: varchar("asset", { length: 20 }).default("ETH"),
  amount: numeric("amount", { precision: 20, scale: 6 }).notNull(),
  description: varchar("description", { length: 200 }),
  proposalId: uuid("proposal_id").references(() => proposals.id),
  txHash: varchar("tx_hash", { length: 66 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const comprehensionLogs = pgTable("comprehension_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id")
    .notNull()
    .references(() => proposals.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  sawAiSummary: boolean("saw_ai_summary").default(false),
  comprehensionScore: integer("comprehension_score"), // 1-10
  timeOnPageSeconds: integer("time_on_page_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
