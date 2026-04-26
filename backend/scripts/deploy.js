async function main() {
  // ✅ Correct (docs-based)
  const { createPublicClient, createWalletClient, http } = await import('viem');
  const { sepolia } = await import('viem/chains');
  const { privateKeyToAccount } = await import('viem/accounts');

  // Create account from private key
  const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

  // Create public client for reading
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http()
  });

  // Create wallet client for writing
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http()
  });

  console.log("Deploying from:", account.address);
  console.log("Deploying to:", sepolia.name);

  // ✅ Deploy
  const contract = await import('./artifacts/DAOGovernance.sol/DAOGovernance.json', {
    assert: { type: 'json' }
  });

  const hash = await walletClient.deployContract({
    abi: contract.default.abi,
    bytecode: contract.default.bytecode,
    args: [],
  });

  console.log("TX Hash:", hash);

  // ✅ Wait for transaction receipt
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: hash,
    confirmations: 1,
  });

  console.log("✅ Contract deployed at:", receipt.contractAddress);
}

main().catch(console.error);