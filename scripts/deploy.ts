import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Arc Testnet's live ERC-20 USDC (6 decimals — see train.md). Only used on
// arcTestnet; other networks deploy MockUSDC so local/CI runs don't depend on it.
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

const EXPLORER_BASE_URL = "https://testnet.arcscan.app/address";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying on network "${network.name}" as ${deployer.address}`);

  let usdcAddress: string;
  if (network.name === "arcTestnet") {
    usdcAddress = ARC_TESTNET_USDC;
    console.log(`Using Arc Testnet USDC at ${usdcAddress} (unverified — see train.md)`);
  } else {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log(`Deployed MockUSDC at ${usdcAddress}`);
  }

  // Platform fee recipient defaults to the deployer; override by re-running
  // setPlatformFeeRecipient post-deploy if a different treasury address is needed.
  const platformFeeRecipient = deployer.address;

  const SocialFiPlatform = await ethers.getContractFactory("SocialFiPlatform");
  const platform = await SocialFiPlatform.deploy(usdcAddress, platformFeeRecipient);
  const platformDeployTx = platform.deploymentTransaction();
  await platform.waitForDeployment();
  const platformAddress = await platform.getAddress();
  const deployBlock = platformDeployTx ? (await platformDeployTx.wait())?.blockNumber : undefined;
  console.log(`Deployed SocialFiPlatform at ${platformAddress} (block ${deployBlock})`);

  const DirectMessaging = await ethers.getContractFactory("DirectMessaging");
  const messaging = await DirectMessaging.deploy(usdcAddress, platformFeeRecipient);
  await messaging.waitForDeployment();
  const messagingAddress = await messaging.getAddress();
  console.log(`Deployed DirectMessaging at ${messagingAddress}`);

  console.log("\nDeployment summary:");
  console.log(`  USDC:              ${usdcAddress}`);
  console.log(`  SocialFiPlatform:  ${platformAddress}`);
  console.log(`  DirectMessaging:   ${messagingAddress}`);

  if (network.name === "arcTestnet") {
    console.log("\nExplorer links:");
    console.log(`  SocialFiPlatform:  ${EXPLORER_BASE_URL}/${platformAddress}`);
    console.log(`  DirectMessaging:   ${EXPLORER_BASE_URL}/${messagingAddress}`);
  }

  writeEnvFile({
    NEXT_PUBLIC_USDC_ADDRESS: usdcAddress,
    NEXT_PUBLIC_SOCIALFI_PLATFORM_ADDRESS: platformAddress,
    NEXT_PUBLIC_DIRECT_MESSAGING_ADDRESS: messagingAddress,
    // Event-log scans (lib/onchain-data.ts) start here instead of block 0 —
    // scanning from genesis on a live testnet is what tripped Arc's RPC rate
    // limit (see train.md).
    NEXT_PUBLIC_DEPLOY_BLOCK: deployBlock !== undefined ? String(deployBlock) : "0",
  });
}

/// Writes deployed addresses as NEXT_PUBLIC_* vars into frontend/.env.local —
/// Next.js only inlines NEXT_PUBLIC_* vars from env files inside frontend/,
/// so they can't live in the root .env alongside DEPLOYER_PRIVATE_KEY (which
/// must never be written here or reach a NEXT_PUBLIC_ var). Never overwrites
/// unrelated keys already in the file (e.g. NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID).
function writeEnvFile(addresses: Record<string, string>) {
  const envPath = path.join(__dirname, "..", "frontend", ".env.local");
  let existing = "";
  try {
    existing = fs.readFileSync(envPath, "utf8");
  } catch {
    existing = "";
  }

  const lines = existing.split("\n").filter((line) => line.trim().length > 0);
  const keys = Object.keys(addresses);

  const updatedLines = lines.filter((line) => !keys.some((key) => line.startsWith(`${key}=`)));
  for (const key of keys) {
    updatedLines.push(`${key}=${addresses[key]}`);
  }

  fs.writeFileSync(envPath, updatedLines.join("\n") + "\n");
  console.log(`\nWrote deployed addresses to ${envPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
