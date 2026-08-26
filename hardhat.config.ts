import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// Arc Testnet values below come from the project's pasted user prompt (see
// train.md) — confirmed live against the actual network (RPC reachable,
// chain id and USDC contract match) during the Phase 4 arcTestnet deploy on
// 2026-08-25, but never cross-checked against Arc's official docs.
const ARC_TESTNET_RPC_URL = process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network";
const ARC_TESTNET_CHAIN_ID = 5042002;
// Accept the key with or without a leading "0x" — hardhat/ethers require the
// prefix internally, but it's an easy detail to miss when pasting from a
// wallet's "export private key" screen.
const rawDeployerKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const DEPLOYER_PRIVATE_KEY = rawDeployerKey
  ? rawDeployerKey.startsWith("0x")
    ? rawDeployerKey
    : `0x${rawDeployerKey}`
  : undefined;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    arcTestnet: {
      url: ARC_TESTNET_RPC_URL,
      chainId: ARC_TESTNET_CHAIN_ID,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
};

export default config;
