# AI-Gov Backend — v3.0

**Node.js + Express + Groq AI + Drizzle ORM + Neon PostgreSQL + Upstash Redis**

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Fill in .env (copy from .env.example)
cp .env.example .env
# → Add DATABASE_URL, REDIS_URL, GROQ_API_KEY, JWT secrets

# 3. Push schema to Neon PostgreSQL
npm run db:push

# 4. Seed demo data (optional)
npm run db:seed

# 5. Start dev server
npm run dev
# → http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string |
| `REDIS_URL` | ✅ | Upstash Redis URL (`rediss://...`) |
| `GROQ_API_KEY` | ✅ | Groq API key from console.groq.com |
| `JWT_ACCESS_SECRET` | ✅ | 64-char hex secret for access tokens |
| `JWT_REFRESH_SECRET` | ✅ | 64-char hex secret for refresh tokens |
| `PINATA_API_KEY` | Optional | Pinata IPFS API key |
| `PINATA_SECRET` | Optional | Pinata IPFS secret |
| `ALCHEMY_SEPOLIA_URL` | Optional | Alchemy Sepolia RPC for on-chain reads |
| `DAO_*_ADDRESS` | Optional | Contract addresses after Hardhat deploy |

Generate JWT secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## API Reference

Base URL: `http://localhost:3000/api/v1`

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/auth/nonce/:address` | Public | Get wallet challenge nonce |
| POST | `/auth/verify` | Public | Verify MetaMask signature → JWT |
| POST | `/auth/refresh` | Cookie | Rotate refresh token |
| POST | `/auth/logout` | JWT | Clear session |
| GET | `/auth/me` | JWT | Current user profile |

### Proposals
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/proposals` | JWT | List (filter: `?status=active&category=technical`) |
| POST | `/proposals` | JWT | Create + IPFS upload + Groq AI analysis |
| GET | `/proposals/:id` | JWT | Full proposal with AI fields |
| PATCH | `/proposals/:id` | JWT | Update draft only |
| DELETE | `/proposals/:id` | JWT | Delete draft only |
| POST | `/proposals/:id/submit` | JWT | Draft → Active (on-chain) |
| GET | `/proposals/:id/ai` | JWT | AI analysis breakdown |
| PATCH | `/proposals/:id/label` | Admin | Set manual_label for accuracy |

### Votes
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/votes` | JWT | Cast vote (`for/against/abstain`) |
| GET | `/votes/proposal/:id` | JWT | All votes for a proposal |
| GET | `/votes/proposal/:id/summary` | JWT | Counts + % + weighted + quorum |
| DELETE | `/votes/:id` | JWT | Retract if still active |
| POST | `/votes/comprehension` | JWT | Log comprehension score 1-10 |

### Treasury
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/treasury/balance` | JWT | On-chain + DB balance |
| GET | `/treasury/transactions` | JWT | All inflow/outflow |
| GET | `/treasury/analytics` | JWT | Monthly breakdown by asset |
| POST | `/treasury/seed` | Admin | Seed demo transactions |

### Analytics (Research Evidence)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/analytics/overview` | JWT | Active proposals, members, participation % |
| GET | `/analytics/participation` | JWT | Voting participation over time |
| GET | `/analytics/proposals/by-category` | JWT | Proposal count per category |
| GET | `/analytics/proposals/approval-rate` | JWT | Approval rate per category |
| GET | `/analytics/ai/accuracy` | JWT | AI accuracy vs manual labels (87%+) |
| GET | `/analytics/comprehension` | JWT | WITH vs WITHOUT AI gap (35%+) |

### AI Direct Endpoints
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/ai/analyze` | JWT | Full analysis for stored proposal |
| POST | `/ai/summarize` | JWT | Summarize text |
| POST | `/ai/classify` | JWT | Classify → category + confidence |
| POST | `/ai/risk` | JWT | Risk score with formula breakdown |

## Project Structure

```
src/
├── config/
│   ├── db.js          # Neon + Drizzle ORM
│   ├── redis.js        # Upstash Redis
│   ├── blockchain.js   # Ethers.js provider + contracts
│   └── env.js          # Zod-validated env vars
├── db/
│   ├── schema.js       # All Drizzle table definitions
│   └── seed.js         # Demo data seeder
├── middleware/
│   ├── auth.js         # JWT verify + attach req.user
│   ├── rbac.js         # Role-based access (member/delegate/admin)
│   ├── validate.js     # Zod request body validation
│   └── errorHandler.js # Global error handler
├── modules/
│   ├── auth/           # Nonce → signature → JWT flow
│   ├── proposals/      # CRUD + IPFS + AI trigger
│   ├── votes/          # Cast + retract + summary + comprehension
│   ├── treasury/       # Balance + transactions + analytics
│   ├── analytics/      # Research evidence endpoints
│   └── ai/             # Direct Groq AI endpoints
├── services/
│   ├── aiService.js    # Groq: summarize + risk + classify
│   ├── ipfsService.js  # Pinata: upload + gateway URL
│   └── cacheService.js # Redis: get/set/delete/pattern
└── contracts/          # ABIs (copy from Hardhat after compile)
    ├── DAOGovernance.json
    ├── DAOTreasury.json
    └── DAOToken.json
```

## After Hardhat Deploy

Copy ABIs from `aigov-contracts/artifacts/contracts/`:
```bash
cp artifacts/contracts/DAOGovernance.sol/DAOGovernance.json ../AI-Gov/backend/src/contracts/
cp artifacts/contracts/DAOTreasury.sol/DAOTreasury.json ../AI-Gov/backend/src/contracts/
cp artifacts/contracts/DAOToken.sol/DAOToken.json ../AI-Gov/backend/src/contracts/
```

Add contract addresses to `.env`:
```
DAO_TOKEN_ADDRESS=0x...
DAO_GOVERNANCE_ADDRESS=0x...
DAO_TREASURY_ADDRESS=0x...
```
