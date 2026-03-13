import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("Deploying InventoryTracker to Avalanche Fuji...");

  const InventoryTracker = await ethers.getContractFactory("InventoryTracker");
  const contract = await InventoryTracker.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`✅ InventoryTracker deployed to: ${address}`);
  console.log(`🔗 View on Snowtrace: https://testnet.snowtrace.io/address/${address}`);
  console.log(`📋 Add this to .env → CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});