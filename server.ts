import express from "express";
import { paymentMiddleware, Resource } from "x402-express";
import dotenv from "dotenv";
import { ethers } from "ethers";
import {
  loadInventory,
  analyzeExpiry,
  generateDiscountReport,
  generateStockSummary,
} from "./agent";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PAYMENT_RECEIVER = process.env.PAYMENT_RECEIVER as `0x${string}`;
const FACILITATOR_URL = process.env.FACILITATOR_URL as Resource;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const FUJI_RPC = process.env.FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc";

const CONTRACT_ABI = [
  "function recordQuery(address shopkeeper) external",
  "event QueryRecorded(address indexed shopkeeper, uint256 timestamp)",
];

// ── Record query on-chain ──────────────────────────────────────
async function recordQueryOnChain(shopkeeper: string): Promise<void> {
  if (!CONTRACT_ADDRESS || !process.env.PRIVATE_KEY) return;
  try {
    const provider = new ethers.JsonRpcProvider(FUJI_RPC);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    const tx = await contract.recordQuery(shopkeeper);
    await tx.wait();
    console.log(`✅ On-chain record saved. Tx: ${tx.hash}`);
  } catch (err) {
    console.error("On-chain recording failed (non-fatal):", err);
  }
}

// ── x402 Payment Middleware ────────────────────────────────────
app.use(
  paymentMiddleware(
    PAYMENT_RECEIVER,
    {
      "GET /query/expiry": {
        price: "$0.01",
        network: "avalanche-fuji",
        config: {
          description: "AI Expiry & Discount Report for Supermarket",
        },
      },
      "GET /query/stock": {
        price: "$0.01",
        network: "avalanche-fuji",
        config: {
          description: "Full Stock Summary for Supermarket",
        },
      },
    },
    { url: FACILITATOR_URL }
  )
);

// ── Root ──────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({
    name: "🛒 Supermarket AI Agent",
    version: "1.0.0",
    network: "Avalanche Fuji Testnet",
    x402: "Powered by x402-express + PayAI Facilitator",
    endpoints: {
      "GET /query/expiry": "AI Discount Report (x402 protected - $0.01)",
      "GET /query/stock": "Stock Summary (x402 protected - $0.01)",
      "GET /health": "Health check (free)",
    },
  });
});

// ── Health ────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Expiry Report ─────────────────────────────────────────────
app.get("/query/expiry", async (req, res) => {
  try {
    console.log("🤖 Running AI expiry analysis...");
    const products = loadInventory();
    const bucket = analyzeExpiry(products);
    const report = await generateDiscountReport(bucket);

    // Record on-chain
    const shopkeeper = (req as any).payment?.payer || process.env.SHOPKEEPER_WALLET || "";
    recordQueryOnChain(shopkeeper).catch(console.error);

    console.log("\n" + "═".repeat(60));
    console.log(report);
    console.log("═".repeat(60) + "\n");

    res.json({
      success: true,
      queryType: "EXPIRY_CHECK",
      timestamp: new Date().toISOString(),
      report,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Stock Summary ─────────────────────────────────────────────
app.get("/query/stock", (req, res) => {
  try {
    console.log("📦 Generating stock summary...");
    const products = loadInventory();
    const summary = generateStockSummary(products);

    const shopkeeper = (req as any).payment?.payer || process.env.SHOPKEEPER_WALLET || "";
    recordQueryOnChain(shopkeeper).catch(console.error);

    res.json({
      success: true,
      queryType: "STOCK_CHECK",
      timestamp: new Date().toISOString(),
      summary,
      totalProducts: products.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     🛒  Supermarket AI Agent — x402-express Edition       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`⛓️  Network: Avalanche Fuji Testnet`);
  console.log(`💰 Cost: $0.01 USDC per query`);
  console.log(`📦 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`🔧 Facilitator: ${FACILITATOR_URL}\n`);
});