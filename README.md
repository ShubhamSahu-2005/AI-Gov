# AI-Gov Platform

AI-Gov is a decentralized, AI-augmented governance platform designed to lower cognitive overhead in DAO voting. Using Llama-3.3-70B via Groq, it provides automated proposal summarization, risk scoring, and categorization, allowing DAO members to make faster, more informed decisions without getting bogged down by technical jargon.

## Key Features
- **AI Proposal Summarization**: Converts complex, highly technical proposals into plain English.
- **Automated Risk Scoring**: Grades proposals on financial impact, technical complexity, and historical risk.
- **Autonomous AI Delegate**: Allows users to set risk tolerances and dynamically delegate their voting power to an AI agent that automatically votes on their behalf.
- **Real-time Vote Analytics**: Live dashboard showing quorum progression, approval percentages, and participation rates.
- **Offline Guest Mode**: Seamlessly explore the dashboard without a Web3 wallet.

## Local Environment Setup Instructions

### 1. Prerequisites
Ensure you have the following installed on your machine:
- [Node.js (v18+)](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/) or [Docker](https://www.docker.com/) (for spinning up a local database container)
- MetaMask or Brave Wallet (Optional, guest mode available)

### 2. Database Setup (Using Docker)
The easiest way to run the PostgreSQL database locally is via Docker:
```bash
docker run --name aigov-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=aigov -p 5432:5432 -d postgres
```

### 3. Environment Variables Configuration
Navigate to the `backend` folder and copy the template:
```bash
cd backend
cp .env.example .env
```
Inside your `backend/.env` file, configure the following:

**A. Database Connection:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aigov
```

**B. Groq API Key (For AI Features):**
1. Visit [Groq Console](https://console.groq.com/keys).
2. Create an account or log in.
3. Click "Create API Key" and copy the generated key.
```env
GROQ_API_KEY=gsk_YourGeneratedKeyHere
```
*(Note: If you leave this empty or use a dummy key, the platform will safely fall back to a Mock AI Service).*

**C. JWT Secrets:**
```env
JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
```

### 4. Backend Initialization
With your `.env` ready, build the schema, seed the dummy data, and start the backend:
```bash
# In the /backend directory
npm install
npx drizzle-kit push --force
npm run db:seed
npm run dev
```

### 5. Frontend Initialization
Open a new terminal window for the frontend:
```bash
cd frontend
npm install
cp .env.example .env
```
Ensure `VITE_API_URL` is set to `http://localhost:3000/api/v1` in the frontend `.env`.
```bash
npm run dev
```
The application will now be running on `http://localhost:5173`.

---

## Troubleshooting

### 1. "AI Analysis Processing..." Hangs indefinitely
- **Issue**: The Groq API key is invalid or rate-limited.
- **Solution**: The backend `aiService.js` is built with a safe fallback mechanism. If your key throws a `401 Unauthorized` or hits a rate limit, the service will seamlessly inject a Mock AI Response so you can continue testing the UI. Double check your `.env` if you want real LLM generations.

### 2. "Proposal is not a draft" or "Already Voted" Errors
- **Issue**: Desynchronized global state.
- **Solution**: Ensure your frontend is hitting the `/proposals` endpoint to fetch the LIVE database state rather than relying on local React contexts. The `db:seed` script generates over 100+ votes, so if you are logged in as a seeded user, you may have naturally already voted on that specific proposal!

### 3. Wallet Connection Fails (500 Error)
- **Issue**: The backend cannot find the `users` table because `npm run db:push` was never successfully run.
- **Solution**: Check your `DATABASE_URL`. If you were originally using Neon Serverless, ensure you switched to the standard Node-Postgres `pg` driver for your local Docker container as detailed in step 2.

### 4. JWT Expiry
- **Issue**: Users are logged out after 15 minutes.
- **Solution**: The frontend must send `{ withCredentials: true }` in Axios requests to transmit the `httpOnly` refresh token.

### 5. Unexpected behaviour in Dashboard (Wallet Connected Mode)
- **Issue**: Various bugs related to:
    - Analytics tab not loading.
    - AI Delegate not voting on proposals.
    - User not voting on proposals after voting button is clicked.
- **Solution**: Reload the page and reconnect the wallet to fix the issue. (Temporary Fix)