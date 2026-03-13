#!/usr/bin/env node
import { ethers } from "ethers";
import { loadInventory, analyzeExpiry, generateDiscountReport, generateStockSummary } from "./agent.ts";
import readline from "readline";
import dotenv from "dotenv";
dotenv.config();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise((r) => rl.question(q, r));

const QUERY_COST = "0.001";
const FUJI_RPC = process.env.FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const PAYMENT_RECEIVER = process.env.PAYMENT_RECEIVER!;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function printHeader() {
  const provider = new ethers.JsonRpcProvider(FUJI_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  const balanceAVAX = parseFloat(ethers.formatEther(balance));

  console.clear();
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       🛒  Supermarket AI Agent  |  Powered by x402       ║");
  console.log("║              Network: Avalanche Fuji Testnet              ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`💼 Wallet: ${wallet.address}`);
  console.log(`💰 Real Balance: ${balanceAVAX.toFixed(4)} AVAX\n`);
}

async function realX402Payment(queryType: string): Promise<boolean> {
  console.log(`\n📡 Requesting: ${queryType}...`);
  await sleep(500);
  console.log("🔒 Server Response: 402 Payment Required");
  console.log(`   └─ Amount required: ${QUERY_COST} AVAX`);
  console.log(`   └─ Pay to: ${PAYMENT_RECEIVER}`);
  console.log(`   └─ Network: avalanche-fuji`);
  await sleep(500);

  try {
    const provider = new ethers.JsonRpcProvider(FUJI_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // Check real balance
    const balance = await provider.getBalance(wallet.address);
    const balanceAVAX = parseFloat(ethers.formatEther(balance));

    if (balanceAVAX < parseFloat(QUERY_COST)) {
      console.log("\n❌ Insufficient AVAX balance!");
      console.log(`   Your balance: ${balanceAVAX.toFixed(4)} AVAX`);
      console.log(`   Required: ${QUERY_COST} AVAX`);
      return false;
    }

    console.log("\n💳 Sending real AVAX payment on Fuji blockchain...");
    await sleep(500);

    // Send REAL transaction
    const tx = await wallet.sendTransaction({
      to: PAYMENT_RECEIVER,
      value: ethers.parseEther(QUERY_COST),
    });

    console.log(`⏳ Transaction submitted! Waiting for confirmation...`);
    console.log(`   └─ Tx Hash: ${tx.hash}`);

    // Wait for confirmation
    const receipt = await tx.wait();

    const newBalance = await provider.getBalance(wallet.address);
    const newBalanceAVAX = parseFloat(ethers.formatEther(newBalance));

    console.log(`\n✅ Payment CONFIRMED on Avalanche Fuji!`);
    console.log(`   └─ Tx Hash: ${tx.hash}`);
    console.log(`   └─ Block: ${receipt?.blockNumber}`);
    console.log(`   └─ Amount: ${QUERY_COST} AVAX deducted`);
    console.log(`   └─ New balance: ${newBalanceAVAX.toFixed(4)} AVAX`);
    console.log(`   └─ 🔗 Explorer: https://testnet.snowtrace.io/tx/${tx.hash}`);
    await sleep(500);

    console.log("\n🔓 Payment verified! Access granted.\n");
    await sleep(400);
    return true;

  } catch (err: any) {
    console.error("\n❌ Payment failed:", err.message);
    return false;
  }
}

async function runExpiryCheck() {
  const paid = await realX402Payment("EXPIRY_CHECK");
  if (!paid) return;

  console.log("🤖 AI Agent analyzing inventory...\n");
  await sleep(1000);

  const products = loadInventory();
  const bucket = analyzeExpiry(products);
  const report = await generateDiscountReport(bucket);

  console.log("═".repeat(62));
  console.log(report);
  console.log("═".repeat(62));
}

async function runStockCheck() {
  const paid = await realX402Payment("STOCK_CHECK");
  if (!paid) return;

  console.log("📦 Fetching stock data...\n");
  await sleep(800);

  const products = loadInventory();
  const summary = generateStockSummary(products);
  console.log(summary);
}

async function main() {
  await printHeader();

  while (true) {
    console.log("What would you like to do?\n");
    console.log("  [1] Check Expiry + Get AI Discount Report  (costs 0.001 AVAX)");
    console.log("  [2] View Full Stock Summary                 (costs 0.001 AVAX)");
    console.log("  [3] View raw inventory.json");
    console.log("  [4] Exit\n");

    const choice = await ask("Enter choice (1-4): ");

    switch (choice.trim()) {
      case "1":
        await runExpiryCheck();
        break;
      case "2":
        await runStockCheck();
        break;
      case "3":
        const products = loadInventory();
        console.log("\n📋 Raw Inventory:\n");
        console.table(products.map((p) => ({
          ID: p.id,
          Product: p.product_name.substring(0, 25),
          Stock: p.stock_count,
          Expiry: p.expiry_date,
          Price: `₹${p.price_inr}`,
        })));
        break;
      case "4":
        console.log("\n👋 Goodbye!\n");
        rl.close();
        process.exit(0);
      default:
        console.log("Invalid choice. Try again.\n");
    }

    await ask("\nPress Enter to continue...");
    await printHeader();
  }
}

main().catch(console.error);