#!/usr/bin/env node
/**
 * cli-demo.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Supermarket AI Agent — Interactive CLI Demo
 * Simulates the x402 payment flow end-to-end in the terminal.
 * 
 * Usage:
 *   npx ts-node cli-demo.ts
 *   (or: node dist/cli-demo.js)
 */

import { loadInventory, analyzeExpiry, generateDiscountReport, generateStockSummary } from "./agent.ts";
import readline from "readline";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise((r) => rl.question(q, r));

// Simulated wallet balance
let walletBalance = 0.05; // 0.05 AVAX
const QUERY_COST = 0.001;

function printHeader() {
  console.clear();
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       🛒  Supermarket AI Agent  |  Powered by x402       ║");
  console.log("║              Network: Avalanche Fuji Testnet              ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`💼 Wallet: ${process.env.SHOPKEEPER_WALLET || "Demo Wallet"}`);
  console.log(`💰 Balance: ${walletBalance.toFixed(4)} AVAX\n`);
}

async function simulateX402Payment(queryType: string): Promise<boolean> {
  console.log(`\n📡 Requesting: ${queryType}...`);
  await sleep(600);
  console.log("🔒 Server Response: 402 Payment Required");
  console.log(`   └─ Amount required: ${QUERY_COST} AVAX`);
  console.log(`   └─ Pay to: ${process.env.PAYMENT_RECEIVER || "0xAGENT_WALLET"}`);
  console.log(`   └─ Network: avalanche-fuji`);
  await sleep(400);

  if (walletBalance < QUERY_COST) {
    console.log("\n❌ Insufficient AVAX balance!");
    return false;
  }

  console.log("\n💳 Processing payment via x402...");
  await sleep(800);

  // Simulate transaction
  const fakeTxHash = "0x" + Math.random().toString(16).substring(2).padEnd(64, "0");
  walletBalance -= QUERY_COST;

  console.log(`✅ Payment sent!`);
  console.log(`   └─ Tx Hash: ${fakeTxHash.substring(0, 20)}...`);
  console.log(`   └─ Amount: ${QUERY_COST} AVAX deducted`);
  console.log(`   └─ New balance: ${walletBalance.toFixed(4)} AVAX`);
  console.log(`   └─ Explorer: https://testnet.snowtrace.io/tx/${fakeTxHash}`);
  await sleep(600);

  console.log("\n🔓 Payment verified! Access granted.\n");
  await sleep(400);
  return true;
}

async function runExpiryCheck() {
  const paid = await simulateX402Payment("EXPIRY_CHECK");
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
  const paid = await simulateX402Payment("STOCK_CHECK");
  if (!paid) return;

  console.log("📦 Fetching stock data...\n");
  await sleep(800);

  const products = loadInventory();
  const summary = generateStockSummary(products);
  console.log(summary);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  printHeader();

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
    printHeader();
  }
}

main().catch(console.error);