#!/usr/bin/env node
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { addProductToInventory } from "./scanner.ts";
import { ethers } from "ethers";
import { loadInventory, analyzeExpiry, generateDiscountReport, generateStockSummary } from "./agent.ts";
import readline from "readline";
import dotenv from "dotenv";
dotenv.config();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise((r) => rl.question(q, r));

const FUJI_RPC = process.env.FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const PAYMENT_RECEIVER = process.env.PAYMENT_RECEIVER!;
const QUERY_COST = "0.001";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
async function generateDiscountQR(productName: string, discount: string, expiry: string) {
  const qrData = `SUPERMARKET DISCOUNT | Product: ${productName} | Discount: ${discount}% OFF | Expiry: ${expiry} | Powered by Supermarket AI Agent`;
  console.log(`\n📱 QR Code for ${productName} (${discount}% OFF):`);
  const qrString = await QRCode.toString(qrData, { type: "terminal", small: true });
  console.log(qrString);
  console.log(`🏷️  ${discount}% OFF — Expires: ${expiry}\n`);
}
async function printHeader() {
  try {
    const provider = new ethers.JsonRpcProvider(FUJI_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const balance = await provider.getBalance(wallet.address);
    const balanceAVAX = parseFloat(ethers.formatEther(balance));
    console.clear();
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║     🛒  Supermarket AI Agent  |  Powered by x402         ║");
    console.log("║              Network: Avalanche Fuji Testnet              ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log(`💼 Wallet  : ${wallet.address}`);
    console.log(`💰 Balance : ${balanceAVAX.toFixed(4)} AVAX\n`);
  } catch {
    console.clear();
    console.log("🛒 Supermarket AI Agent | x402 Edition\n");
  }
}

// ── Real x402 Payment using ethers ───────────────────────────
async function x402Payment(queryType: string): Promise<boolean> {
  console.log(`\n📡 Requesting: ${queryType}...`);
  await sleep(400);

  console.log("🔒 Server: 402 Payment Required");
  console.log(`   └─ Protocol  : x402-express`);
  console.log(`   └─ Amount    : ${QUERY_COST} AVAX`);
  console.log(`   └─ Pay to    : ${PAYMENT_RECEIVER}`);
  console.log(`   └─ Network   : avalanche-fuji`);
  await sleep(400);

  try {
    const provider = new ethers.JsonRpcProvider(FUJI_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const balance = await provider.getBalance(wallet.address);
    const balanceAVAX = parseFloat(ethers.formatEther(balance));

    if (balanceAVAX < parseFloat(QUERY_COST)) {
      console.log(`\n❌ Insufficient balance! Have: ${balanceAVAX} AVAX, Need: ${QUERY_COST} AVAX`);
      return false;
    }

    console.log(`\n💳 Sending x402 payment on Avalanche Fuji...`);

    const tx = await wallet.sendTransaction({
      to: PAYMENT_RECEIVER,
      value: ethers.parseEther(QUERY_COST),
    });

    console.log(`⏳ Confirming on blockchain...`);
    const receipt = await tx.wait();

    const newBalance = await provider.getBalance(wallet.address);
    const newBalanceAVAX = parseFloat(ethers.formatEther(newBalance));

    console.log(`\n✅ x402 Payment CONFIRMED!`);
    console.log(`   └─ Tx Hash   : ${tx.hash}`);
    console.log(`   └─ Block     : ${receipt?.blockNumber}`);
    console.log(`   └─ Deducted  : ${QUERY_COST} AVAX`);
    console.log(`   └─ Balance   : ${newBalanceAVAX.toFixed(4)} AVAX`);
    console.log(`   └─ Explorer  : https://testnet.snowtrace.io/tx/${tx.hash}`);
    await sleep(400);

    console.log("\n🔓 Access granted by x402 protocol!\n");
    return true;

  } catch (err: any) {
    console.error(`\n❌ Payment failed: ${err.message}`);
    return false;
  }
}

async function runExpiryCheck() {
  const paid = await x402Payment("EXPIRY_CHECK");
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
  const paid = await x402Payment("STOCK_CHECK");
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
    console.log("  [1] Check Expiry + AI Discount Report  (costs 0.001 AVAX via x402)");
    console.log("  [2] View Full Stock Summary             (costs 0.001 AVAX via x402)");
    console.log("  [3] View raw inventory.json");
    console.log("  [4] Generate Discount QR Codes        (free)");
    console.log("  [5] 📷 Scan Product QR → Add to Inventory (free)");
    console.log("  [6] Exit\n");

    const choice = await ask("Enter choice (1-6): ");
    switch (choice.trim()) {
      case "1": await runExpiryCheck(); break;
      case "2": await runStockCheck(); break;
      case "3":
        const products = loadInventory();
        console.log("\n📋 Raw Inventory:\n");
        console.table(products.map((p: any) => ({
          Product: p.product_name.substring(0, 25),
          Stock: p.stock_count,
          Expiry: p.expiry_date,
          Price: `₹${p.price_inr}`,
        })));
        break;
      case "4":
  const prods = loadInventory();
  const buckets = analyzeExpiry(prods);
  console.log("\n📱 Generating QR Codes for expiring products...\n");
  const expiringItems = [...buckets.critical, ...buckets.urgent];
  if (expiringItems.length === 0) {
    console.log("✅ No critical products need discounts right now!");
  } else {
    for (const p of expiringItems) {
      await generateDiscountQR(p.product_name, "50", p.expiry_date);
      await sleep(500);
    }
  }
  break;
case "5":
  console.log("\n📷 QR Code Scanner — Add Product to Inventory");
  console.log("─────────────────────────────────────────────");
  console.log("Put your QR code image in this folder:");
  console.log(`📁 ${process.cwd()}\n`);
  const imageName = await ask("Enter image filename (e.g. product.png): ");
  const imagePath = path.join(process.cwd(), imageName.trim());
  if (!fs.existsSync(imagePath)) {
    console.log(`\n❌ File not found: ${imageName.trim()}`);
    console.log("Make sure the image is in your project folder!");
  } else {
    await addProductToInventory(imagePath);
  }
  break;
case "6":
  console.log("\n👋 Goodbye!\n");
  rl.close();
  process.exit(0);
      default:
        console.log("Invalid choice.\n");
    }
    await ask("\nPress Enter to continue...");
    await printHeader();
  }
}

main().catch(console.error);