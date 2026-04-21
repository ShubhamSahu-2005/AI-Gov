import { env } from "../config/env.js";

let pinata = null;

// Only init Pinata if both keys are present
if (env.PINATA_API_KEY && env.PINATA_SECRET && env.PINATA_API_KEY.length > 5) {
  try {
    const PinataSdk = (await import("@pinata/sdk")).default;
    pinata = new PinataSdk(env.PINATA_API_KEY, env.PINATA_SECRET);
    console.log("✅ Pinata IPFS configured");
  } catch (err) {
    console.warn("⚠️  Pinata init failed:", err.message);
  }
} else {
  console.warn("⚠️  Pinata not configured — IPFS uploads disabled");
}

/**
 * Upload proposal JSON to Pinata IPFS
 * @returns {string|null} IPFS CID or null if Pinata not available
 */
export const uploadProposalToIPFS = async (proposalData) => {
  if (!pinata) return null;

  try {
    const body = {
      title: proposalData.title,
      description: proposalData.description,
      category: proposalData.category,
      requestedAmount: proposalData.requestedAmount,
      createdAt: new Date().toISOString(),
    };

    const options = {
      pinataMetadata: { name: `aigov-proposal-${Date.now()}` },
      pinataOptions: { cidVersion: 0 },
    };

    const result = await pinata.pinJSONToIPFS(body, options);
    return result.IpfsHash;
  } catch (err) {
    console.warn("⚠️  IPFS upload failed (continuing without IPFS):", err.message);
    return null;
  }
};

/**
 * Get IPFS gateway URL from CID
 */
export const getIPFSUrl = (cid) => {
  if (!cid) return null;
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
};
