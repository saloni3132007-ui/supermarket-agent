import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying InventoryTracker to Avalanche Fuji...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying from:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "AVAX\n");

  const InventoryTracker = await ethers.getContractFactory("InventoryTracker");
  const contract = await InventoryTracker.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ InventoryTracker deployed to:", address);
  console.log("🔗 Verify at: https://testnet.snowtrace.io/address/" + address);
  console.log("\n📋 Next steps:");
  console.log(`   1. Copy this address: ${address}`);
  console.log("   2. Paste it into .env as CONTRACT_ADDRESS");
  console.log("   3. Run verification command below for bonus marks:\n");
  console.log(`   npx hardhat verify --network fuji ${address}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});