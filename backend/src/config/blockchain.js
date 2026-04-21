import { ethers } from "ethers";
import { env } from "./env.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let provider = null;
let governanceContract = null;
let treasuryContract = null;
let tokenContract = null;

const isValidAddress = (addr) => addr && addr.startsWith("0x") && addr.length === 42;

if (env.ALCHEMY_SEPOLIA_URL && env.ALCHEMY_SEPOLIA_URL.startsWith("https://")) {
  try {
    provider = new ethers.JsonRpcProvider(env.ALCHEMY_SEPOLIA_URL);

    if (isValidAddress(env.DAO_GOVERNANCE_ADDRESS)) {
      const DAOGovernanceABI = require("../contracts/DAOGovernance.json");
      governanceContract = new ethers.Contract(env.DAO_GOVERNANCE_ADDRESS, DAOGovernanceABI, provider);
      console.log("✅ DAOGovernance contract ready");
    }

    if (isValidAddress(env.DAO_TREASURY_ADDRESS)) {
      const DAOTreasuryABI = require("../contracts/DAOTreasury.json");
      treasuryContract = new ethers.Contract(env.DAO_TREASURY_ADDRESS, DAOTreasuryABI, provider);
      console.log("✅ DAOTreasury contract ready");
    }

    if (isValidAddress(env.DAO_TOKEN_ADDRESS)) {
      const DAOTokenABI = require("../contracts/DAOToken.json");
      tokenContract = new ethers.Contract(env.DAO_TOKEN_ADDRESS, DAOTokenABI, provider);
      console.log("✅ DAOToken contract ready");
    }

    if (!isValidAddress(env.DAO_GOVERNANCE_ADDRESS)) {
      console.warn("⚠️  Contract addresses not set — blockchain reads disabled. Deploy contracts first.");
    }
  } catch (err) {
    console.warn("⚠️  Blockchain init failed:", err.message);
  }
} else {
  console.warn("⚠️  ALCHEMY_SEPOLIA_URL not configured — blockchain features disabled");
}

export { provider, governanceContract, treasuryContract, tokenContract };
