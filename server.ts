import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import { ethers } from "ethers";
import {
  loadInventory,
  analyzeExpiry,
  generateDiscountReport,
  generateStockSummary,
} from "./agent";

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const SHOPKEEPER_ADDRESS = process.env.SHOPKEEPER_WALLET || "0x0000000000000000000000000000000000000000";

// x402 payment config — cost per query (in AVAX on Fuji testnet)
const QUERY_COST_AVAX = "0.001"; // 0.001 AVAX per query (~$0.04)
const PAYMENT_RECEIVER = process.env.PAYMENT_RECEIVER || SHOPKEEPER_ADDRESS;

// Contract info (filled after Person A deploys)
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const FUJI_RPC = process.env.FUJI_RPC || "https://api.avax-test.network/ext/bc/C/rpc";

// ─── Minimal ABI for recordQuery ─────────────────────────────────────────────

const CONTRACT_ABI = [
  "function recordQuery(address shopkeeper, string calldata queryType) external",
  "event QueryRecorded(address indexed shopkeeper, uint256 timestamp, string queryType, uint256 totalQueries)",
];

// ─── x402 Payment State (In-memory for hackathon; replace with DB for prod) ───

interface PaymentToken {
  txHash: string;
  shopkeeper: string;
  amount: string;
  queryType: string;
  usedAt: number;
}

const usedTokens = new Set<string>(); // prevent double-spend

// ─── Helpers ──────────────────────────────────────────────────────────────────

function x402PaymentRequired(res: Response, queryType: string): void {
  res.status(402).json({
    error: "Payment Required",
    "x402-version": "1",
    accepts: [
      {
        scheme: "exact",
        network: "avalanche-fuji",
        maxAmountRequired: ethers.parseEther(QUERY_COST_AVAX).toString(),
        resource: `http://localhost:${PORT}/query/${queryType}`,
        description: `Pay ${QUERY_COST_AVAX} AVAX to access Supermarket AI Agent — ${queryType}`,
        mimeType: "application/json",
        payTo: PAYMENT_RECEIVER,
        maxTimeoutSeconds: 300,
        asset: "0x0000000000000000000000000000000000000000", // native AVAX
        extra: {
          name: "Supermarket AI Agent",
          version: "1.0.0",
        },
      },
    ],
  });
}

// ─── Verify Payment on Fuji ───────────────────────────────────────────────────

async function verifyPayment(txHash: string, expectedAmount: string): Promise<boolean> {
  try {
    // In a full implementation, use facinet-sdk verifyPayment here.
    // For the hackathon demo, we do a basic on-chain tx check.
    const provider = new ethers.JsonRpcProvider(FUJI_RPC);
    const tx = await provider.getTransaction(txHash);
    if (!tx) return false;
    if (usedTokens.has(txHash)) {
      console.log("⛔ Replay attack — tx already used:", txHash);
      return false;
    }
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) return false;
    const paid = BigInt(tx.value.toString());
    const required = ethers.parseEther(expectedAmount);
    return paid >= required;
  } catch (err) {
    console.error("Payment verification error:", err);
    return false;
  }
}

// ─── Record Query On-Chain ────────────────────────────────────────────────────

async function recordQueryOnChain(shopkeeper: string, queryType: string): Promise<void> {
  if (!CONTRACT_ADDRESS || !process.env.PRIVATE_KEY) {
    console.log("ℹ️  Skipping on-chain recording (CONTRACT_ADDRESS or PRIVATE_KEY not set)");
    return;
  }
  try {
    const provider = new ethers.JsonRpcProvider(FUJI_RPC);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    const tx = await contract.recordQuery(shopkeeper, queryType);
    await tx.wait();
    console.log(`✅ On-chain record saved. Tx: ${tx.hash}`);
  } catch (err) {
    console.error("On-chain recording failed (non-fatal):", err);
  }
}

// ─── Express App ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// ── Root ──────────────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "Supermarket AI Agent",
    version: "1.0.0",
    network: "Avalanche Fuji Testnet",
    costPerQuery: `${QUERY_COST_AVAX} AVAX`,
    endpoints: {
      "GET /query/expiry": "Expiry & Discount Report (x402 protected)",
      "GET /query/stock": "Full Stock Summary (x402 protected)",
      "GET /health": "Health check (free)",
    },
  });
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── x402 Middleware ───────────────────────────────────────────────────────────

async function x402Gate(queryType: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    if (!paymentHeader) {
      // No payment — issue 402 challenge
      console.log(`\n🔒 [x402] Payment required for ${queryType}`);
      x402PaymentRequired(res, queryType);
      return;
    }

    // Payment header provided — parse and verify
    let token: PaymentToken;
    try {
      token = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf-8"));
    } catch {
      res.status(400).json({ error: "Invalid x-payment header format" });
      return;
    }

    console.log(`\n💳 [x402] Verifying payment: ${token.txHash}`);
    const valid = await verifyPayment(token.txHash, QUERY_COST_AVAX);

    if (!valid) {
      res.status(402).json({ error: "Payment verification failed or already used" });
      return;
    }

    // Mark tx as used (anti-replay)
    usedTokens.add(token.txHash);

    // Record on-chain asynchronously (non-blocking for CLI speed)
    const shopkeeper = token.shopkeeper || SHOPKEEPER_ADDRESS;
    recordQueryOnChain(shopkeeper, queryType).catch(console.error);

    console.log(`✅ [x402] Payment verified! Granting access to ${queryType}`);
    next();
  };
}

// ── Expiry Report Endpoint ────────────────────────────────────────────────────

app.get("/query/expiry", await x402Gate("EXPIRY_CHECK"), async (_req: Request, res: Response) => {
  try {
    console.log("🤖 Running AI expiry analysis...");
    const products = loadInventory();
    const bucket = analyzeExpiry(products);
    const report = await generateDiscountReport(bucket);

    console.log("\n" + "═".repeat(60));
    console.log(report);
    console.log("═".repeat(60) + "\n");

    res.json({
      success: true,
      queryType: "EXPIRY_CHECK",
      timestamp: new Date().toISOString(),
      report,
      summary: {
        critical: bucket.critical.length,
        urgent: bucket.urgent.length,
        warning: bucket.warning.length,
        safe: bucket.safe.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── Stock Summary Endpoint ────────────────────────────────────────────────────

app.get("/query/stock", await x402Gate("STOCK_CHECK"), (_req: Request, res: Response) => {
  try {
    console.log("📦 Generating stock summary...");
    const products = loadInventory();
    const summary = generateStockSummary(products);

    console.log("\n" + summary + "\n");

    res.json({
      success: true,
      queryType: "STOCK_CHECK",
      timestamp: new Date().toISOString(),
      summary,
      totalProducts: products.length,
      totalUnits: products.reduce((s, p) => s + p.stock_count, 0),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────

createServer(app).listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║       🛒  Supermarket AI Agent — x402 Edition             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`🌐 Server running at  : http://localhost:${PORT}`);
  console.log(`⛓️  Network            : Avalanche Fuji Testnet`);
  console.log(`💰 Cost per query     : ${QUERY_COST_AVAX} AVAX`);
  console.log(`📦 Contract address   : ${CONTRACT_ADDRESS || "Not set (deploy first)"}`);
  console.log("\n📡 Endpoints:");
  console.log(`   GET /query/expiry  — AI Discount Report (x402 protected)`);
  console.log(`   GET /query/stock   — Stock Summary (x402 protected)`);
  console.log(`   GET /health        — Health check (free)\n`);
});