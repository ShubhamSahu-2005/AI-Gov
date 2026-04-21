# AI-Gov Frontend Integration Guide
## For the React Frontend Team

> **Base URL (dev):** `http://localhost:3000/api/v1`
> **Base URL (prod):** `https://aigov-api.onrender.com/api/v1`
> **All responses:** `{ success: boolean, data: any, message?: string }`

---

## 🔧 Setup

### Install dependencies
```bash
npm install ethers axios
```

### Axios instance with auto JWT refresh
```js
// src/lib/api.js
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1",
  withCredentials: true, // needed for refresh token cookie
});

// Auto-attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true;
      try {
        const { data } = await api.post("/auth/refresh");
        localStorage.setItem("access_token", data.data.accessToken);
        err.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(err.config);
      } catch {
        localStorage.removeItem("access_token");
        window.location.href = "/";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
```

---

## 🔐 Authentication — MetaMask Flow

### useWallet.js hook

```js
import { ethers } from "ethers";
import api from "../lib/api";

export function useWallet() {
  const connectWallet = async () => {
    // 1. Connect MetaMask
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    // 2. Get nonce challenge from backend
    const { data: nonceRes } = await api.get(`/auth/nonce/${address}`);
    const { message } = nonceRes.data;
    // message = "Sign this message to login to AI-gov.\nNonce: abc123..."

    // 3. Sign (MetaMask popup)
    const signature = await signer.signMessage(message);

    // 4. Verify and get JWT
    const { data: verifyRes } = await api.post("/auth/verify", { address, signature });
    const { accessToken, user } = verifyRes.data;

    localStorage.setItem("access_token", accessToken);
    return user; // { id, walletAddress, name, role }
  };

  const logout = async () => {
    await api.post("/auth/logout");
    localStorage.removeItem("access_token");
  };

  const getMe = async () => {
    const { data } = await api.get("/auth/me");
    return data.data;
  };

  return { connectWallet, logout, getMe };
}
```

### Auth Endpoints

| Method | Endpoint | Auth | Response |
|--------|----------|------|---------|
| `GET` | `/auth/nonce/:address` | Public | `{ nonce, message }` |
| `POST` | `/auth/verify` | Public | `{ accessToken, user }` |
| `POST` | `/auth/refresh` | Cookie | `{ accessToken }` |
| `POST` | `/auth/logout` | JWT | `{ message }` |
| `GET` | `/auth/me` | JWT | `{ id, walletAddress, name, role }` |

---

## 📋 Proposals

### List proposals
```js
const { data } = await api.get("/proposals");                           // all
const { data } = await api.get("/proposals?status=active");             // active only
const { data } = await api.get("/proposals?category=budget");           // by category
const { data } = await api.get("/proposals?status=active&category=technical"); // combined
```
Status values: `draft | active | approved | rejected | executed`
Category values: `budget | governance | technical | partnership | community`

### Create proposal (auto-triggers Groq AI in background)
```js
const { data } = await api.post("/proposals", {
  title: "Fund Developer Grants",       // required, 5-200 chars
  description: "Allocate 50,000 AGT...", // required, min 20 chars
  category: "budget",                   // optional
  requestedAmount: 50000,               // optional, number
  votingDurationDays: 7,                // optional, 1-30, default 7
});
const proposal = data.data;
// Navigate to /proposals/${proposal.id}
// AI analysis appears in ~2-3 seconds on detail page refresh
```

### Get proposal (with full AI fields)
```js
const { data } = await api.get(`/proposals/${id}`);
const p = data.data;
/*
  p.aiSummary          → plain English summary → show in AIPanel
  p.aiRiskScore        → 0-10 → show as color-coded meter
  p.aiRiskBreakdown    → { financial_impact, technical_complexity, historical_risk,
                           formula_display: "0.4×8 + 0.35×6 + 0.25×5 = 7.1" }
  p.aiCategory         → predicted category
  p.aiConfidence       → 0-100 confidence %
  p.ipfsHash           → IPFS CID (link to gateway)
  p.onChainId          → proposal ID on Sepolia contract
*/
```

### Get AI analysis only
```js
const { data } = await api.get(`/proposals/${id}/ai`);
// { aiSummary, aiRiskScore, aiRiskBreakdown, aiCategory, aiConfidence }
```

### Submit draft → active (after MetaMask on-chain tx)
```js
await api.post(`/proposals/${id}/submit`, {
  onChainId: 3,          // from contract event/receipt
  txHash: "0x...",       // Sepolia TX hash
});
```

### Other proposal operations
```js
await api.patch(`/proposals/${id}`, { title: "New title" });  // update draft
await api.delete(`/proposals/${id}`);                          // delete draft
await api.patch(`/proposals/${id}/label`, { manualLabel: "technical" }); // admin only
```

---

## 🗳️ Votes

### Cast a vote
```js
// 1. First cast on-chain via MetaMask (0=against, 1=for, 2=abstain)
const tx = await governanceContract.castVote(onChainId, 1);
await tx.wait();

// 2. Log to backend
await api.post("/votes", {
  proposalId: "uuid",       // required
  choice: "for",            // "for" | "against" | "abstain"
  txHash: tx.hash,          // optional — Etherscan link
  sawAiSummary: true,       // ← CRITICAL: was AI panel visible?
  votingPower: 500,         // optional
});
```

> **⚠️ Always pass `sawAiSummary` accurately** — this feeds the +35% comprehension research claim.

### Vote summary
```js
const { data } = await api.get(`/votes/proposal/${id}/summary`);
/*
  {
    for:     { count: 30, power: 15000, percent: "66.7" },
    against: { count: 12, power: 6000,  percent: "26.7" },
    abstain: { count: 3,  power: 1500,  percent: "3.3" },
    quorumReached: true,
    participationPercent: "86.5"
  }
*/
```

### Log comprehension (popup after every vote)
```js
await api.post("/votes/comprehension", {
  proposalId: "uuid",
  comprehensionScore: 8,    // 1-10 (from popup slider)
  sawAiSummary: true,
  timeOnPageSeconds: 145,   // optional
});
```

### All votes + retract
```js
const { data } = await api.get(`/votes/proposal/${id}`);    // list all
await api.delete(`/votes/${voteId}`);                        // retract
```

---

## 💰 Treasury

```js
// Balance (on-chain + DB)
const { data } = await api.get("/treasury/balance");
// { onChainBalance: { eth: 1.5 }, dbBalance: 15.25 }

// All transactions
const { data } = await api.get("/treasury/transactions");
// [{ type:"inflow"|"outflow", asset:"ETH"|"AGT", amount, description, txHash }]

// Monthly analytics for charts
const { data } = await api.get("/treasury/analytics");
// { monthly: [...], byAsset: [...] }
```

---

## 📊 Analytics (Research Evidence)

```js
// Dashboard overview
const { data } = await api.get("/analytics/overview");
// { totalProposals, activeProposals, totalMembers, totalVotes, avgParticipationPercent }

// Charts data
const { data } = await api.get("/analytics/participation");       // weekly voter counts
const { data } = await api.get("/analytics/proposals/by-category"); // count per category
const { data } = await api.get("/analytics/proposals/approval-rate"); // approval % per category

// 🎯 AI Accuracy Research Proof (target: 87%+)
const { data } = await api.get("/analytics/ai/accuracy");
// { accuracyPercent: 100, totalLabeled: 15, correct: 15, byCategory: {...} }

// 🎯 Comprehension Gap Research Proof (target: +35%)
const { data } = await api.get("/analytics/comprehension");
/*
  {
    withAI:    { avg_score: "8.14", total_responses: 22 },
    withoutAI: { avg_score: "5.15", total_responses: 19 },
    comprehensionGapPercent: 58.1,  ← show as "+58.1% improvement"
    totalResponses: 41
  }
*/
```

---

## 🤖 Direct AI Endpoints

```js
// Summarize any text
const { data } = await api.post("/ai/summarize", {
  title: "...", description: "..."
});
// data.data.summary → string

// Classify
const { data } = await api.post("/ai/classify", {
  title: "...", description: "..."
});
// { ai_category: "technical", ai_confidence: 95 }

// Risk score with formula
const { data } = await api.post("/ai/risk", {
  title: "...", description: "...", requestedAmount: 50000
});
// { ai_risk_score: 7.5, ai_risk_breakdown: { formula_display: "0.4×8 + 0.35×..." } }

// Full analyze a stored proposal
const { data } = await api.post("/ai/analyze", { proposalId: "uuid" });
```

---

## 🎨 Key Component Patterns

### AIPanel — shows analysis, gates vote button
```jsx
function AIPanel({ proposal, onAnalysisLoaded }) {
  const isLoaded = !!(proposal?.aiSummary && proposal?.aiRiskScore);

  useEffect(() => {
    if (isLoaded) onAnalysisLoaded();
  }, [isLoaded]);

  if (!isLoaded) return <p>⏳ AI analyzing proposal...</p>;

  return (
    <div>
      <p>{proposal.aiSummary}</p>
      <div>Risk: {proposal.aiRiskScore}/10</div>
      <code>{proposal.aiRiskBreakdown?.formula_display}</code>
      <span>{proposal.aiCategory} — {proposal.aiConfidence}% confidence</span>
    </div>
  );
}
```

### VoteSection — vote button DISABLED until AI loads
```jsx
function VoteSection({ proposal, proposalId }) {
  const [aiReady, setAiReady] = useState(false);

  const vote = async (choice) => {
    const tx = await governanceContract.castVote(proposal.onChainId, choice);
    await tx.wait();
    await api.post("/votes", {
      proposalId, choice, txHash: tx.hash, sawAiSummary: aiReady
    });
    // show ComprehensionWidget popup
  };

  return (
    <>
      <AIPanel proposal={proposal} onAnalysisLoaded={() => setAiReady(true)} />
      {!aiReady && <p>Read the AI analysis above to unlock voting</p>}
      <button disabled={!aiReady} onClick={() => vote("for")}>✅ Vote For</button>
      <button disabled={!aiReady} onClick={() => vote("against")}>❌ Vote Against</button>
    </>
  );
}
```

### ComprehensionWidget — popup after vote
```jsx
function ComprehensionWidget({ proposalId, sawAi, onClose }) {
  const [score, setScore] = useState(5);

  return (
    <dialog open>
      <h3>How well did you understand this proposal?</h3>
      <input type="range" min={1} max={10} value={score}
        onChange={e => setScore(+e.target.value)} />
      <span>{score}/10</span>
      <button onClick={async () => {
        await api.post("/votes/comprehension", {
          proposalId, comprehensionScore: score, sawAiSummary: sawAi
        });
        onClose();
      }}>Submit</button>
    </dialog>
  );
}
```

---

## ⛓️ Contract Setup (Ethers.js v6)

```js
// src/lib/contracts.js
import { ethers } from "ethers";
import DAOGovernanceABI from "./contracts/DAOGovernance.json";

const GOVERNANCE = import.meta.env.VITE_DAO_GOVERNANCE_ADDRESS;
const RPC = import.meta.env.VITE_ALCHEMY_SEPOLIA_URL;

// Read-only
export const provider = new ethers.JsonRpcProvider(RPC);
export const governanceContract = new ethers.Contract(GOVERNANCE, DAOGovernanceABI, provider);

// Write (needs MetaMask signer)
export async function getGovernanceSigner() {
  const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
  return new ethers.Contract(GOVERNANCE, DAOGovernanceABI, signer);
}
```

---

## 🗺️ Routes → API Map

| Page | Route | Key API |
|------|-------|---------|
| Landing | `/` | `GET /auth/nonce/:addr`, `POST /auth/verify` |
| Dashboard | `/dashboard` | `GET /analytics/overview`, `GET /proposals?status=active` |
| Proposals | `/proposals` | `GET /proposals?status=&category=` |
| Detail | `/proposals/:id` | `GET /proposals/:id`, `GET /votes/proposal/:id/summary` |
| Create | `/proposals/create` | `POST /proposals`, `POST /proposals/:id/submit` |
| Treasury | `/treasury` | `GET /treasury/balance`, `/transactions`, `/analytics` |
| Analytics | `/analytics` | `GET /analytics/overview`, `/ai/accuracy`, `/comprehension` |
| Settings | `/settings` | `GET /auth/me`, `POST /auth/logout` |

---

## ❌ Error Handling

```js
try {
  await api.post("/votes", payload);
} catch (err) {
  const status = err.response?.status;
  const message = err.response?.data?.message;
  const errors = err.response?.data?.errors; // validation errors array

  if (status === 401) // redirect to login
  if (status === 409) // "Already voted on this proposal"
  if (status === 400) // show errors[].message to user
  if (status === 429) // rate limited — wait and retry
}
```

| Code | Meaning |
|------|---------|
| 200/201 | Success |
| 400 | Validation error — check `errors` array |
| 401 | Token expired → auto-refresh or re-login |
| 403 | Not authorized (wrong role) |
| 404 | Not found |
| 409 | Duplicate (already voted) |
| 429 | Rate limited |
| 500 | Backend error |

---

## 🔑 Frontend .env Variables

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_SEPOLIA_CHAIN_ID=11155111
VITE_DAO_TOKEN_ADDRESS=0x...
VITE_DAO_GOVERNANCE_ADDRESS=0x...
VITE_DAO_TREASURY_ADDRESS=0x...
VITE_ALCHEMY_SEPOLIA_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
```

---

## ✅ Pre-Demo Checklist

- [ ] `GET /analytics/ai/accuracy` → `accuracyPercent ≥ 87`
- [ ] `GET /analytics/comprehension` → `comprehensionGapPercent ≥ 35`
- [ ] Proposal detail page shows `aiRiskBreakdown.formula_display`
- [ ] Vote button is disabled until AI summary is loaded
- [ ] `POST /votes/comprehension` is called after every vote
- [ ] Etherscan TX hash is visible after on-chain votes
