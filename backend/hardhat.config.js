import { defineConfig, configVariable } from "hardhat/config";
import "dotenv/config";

export default defineConfig({
  solidity: "0.8.20",
  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("ALCHEMY_SEPOLIA_URL"),       // ✅ correct
      accounts: [configVariable("PRIVATE_KEY")],        // ✅ correct
    },
  },
});