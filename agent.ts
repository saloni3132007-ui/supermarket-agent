import fs from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  product_name: string;
  category: string;
  expiry_date: string;
  stock_count: number;
  price_inr: number;
  supplier: string;
}

interface ExpiryBucket {
  critical: Product[];  // expires today or already expired
  urgent: Product[];    // expires within 48 hours
  warning: Product[];   // expires within 3 days
  safe: Product[];      // more than 3 days left
}

// ─── Inventory Reader ─────────────────────────────────────────────────────────

export function loadInventory(): Product[] {
  const filePath = path.join(process.cwd(), "inventory.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`inventory.json not found at ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Product[];
}

// ─── Expiry Analysis ──────────────────────────────────────────────────────────

export function analyzeExpiry(products: Product[]): ExpiryBucket {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const bucket: ExpiryBucket = { critical: [], urgent: [], warning: [], safe: [] };

  for (const p of products) {
    const expiry = new Date(p.expiry_date);
    expiry.setHours(0, 0, 0, 0);
    const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) bucket.critical.push(p);
    else if (daysLeft <= 2) bucket.urgent.push(p);
    else if (daysLeft <= 3) bucket.warning.push(p);
    else bucket.safe.push(p);
  }

  return bucket;
}

// ─── AI Discount Report (via Anthropic API) ───────────────────────────────────

export async function generateDiscountReport(bucket: ExpiryBucket): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Build context for the LLM
  const expiringSoon = [...bucket.critical, ...bucket.urgent, ...bucket.warning];

  if (expiringSoon.length === 0) {
    return "✅ All products are well within their expiry dates. No discounts needed today.";
  }

  const productList = expiringSoon
    .map((p) => {
      const expiry = new Date(p.expiry_date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return `- ${p.product_name} | Stock: ${p.stock_count} | Price: ₹${p.price_inr} | Expires in: ${daysLeft <= 0 ? "EXPIRED" : daysLeft + " day(s)"} | Category: ${p.category}`;
    })
    .join("\n");

  // If no API key, return a formatted local report
  if (!apiKey) {
    console.warn("⚠️  ANTHROPIC_API_KEY not set. Generating local discount report.\n");
    return generateLocalReport(expiringSoon, bucket);
  }

  try {
    const systemPrompt = `You are a retail expert and inventory manager for a supermarket. 
Your job is to analyze expiring products and suggest specific discounts to minimize waste and maximize sales.
Rules:
- Suggest 50% off for items expiring within 48 hours or already expired
- Suggest 30% off for items expiring in 3 days
- Always include the discounted price in INR
- Be concise but actionable
- Format the output as a clean, readable Discount Report with sections`;

    const userPrompt = `Here are the products expiring soon at our supermarket. Generate a Discount Report:

${productList}

Provide:
1. An urgency summary
2. Product-by-product discount recommendations with new prices
3. A display banner suggestion the shopkeeper can use`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${err}`);
    }

    const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
    const text = data.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    return text;
  } catch (err) {
    console.error("AI call failed, falling back to local report:", err);
    return generateLocalReport(expiringSoon, bucket);
  }
}

// ─── Local Fallback Report ────────────────────────────────────────────────────

function generateLocalReport(expiringSoon: Product[], bucket: ExpiryBucket): string {
  const lines: string[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  lines.push("╔══════════════════════════════════════════════════════════╗");
  lines.push("║          🛒  SUPERMARKET AI DISCOUNT REPORT               ║");
  lines.push("╚══════════════════════════════════════════════════════════╝");
  lines.push(`📅 Generated: ${new Date().toLocaleString("en-IN")}\n`);

  if (bucket.critical.length > 0) {
    lines.push("🚨 CRITICAL — EXPIRED PRODUCTS (Clearance / Remove from shelf)");
    lines.push("─".repeat(60));
    for (const p of bucket.critical) {
      lines.push(`  • ${p.product_name}`);
      lines.push(`    Stock: ${p.stock_count} units | Original: ₹${p.price_inr} → CLEARANCE: ₹${Math.round(p.price_inr * 0.3)}`);
    }
    lines.push("");
  }

  if (bucket.urgent.length > 0) {
    lines.push("⚠️  URGENT — Expiring within 48 hours (50% OFF recommended)");
    lines.push("─".repeat(60));
    for (const p of bucket.urgent) {
      const expiry = new Date(p.expiry_date);
      const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const discounted = Math.round(p.price_inr * 0.5);
      lines.push(`  • ${p.product_name}`);
      lines.push(`    Expires in ${daysLeft} day(s) | Stock: ${p.stock_count} | ₹${p.price_inr} → 50% OFF → ₹${discounted}`);
    }
    lines.push("");
  }

  if (bucket.warning.length > 0) {
    lines.push("💛 WARNING — Expiring in 3 days (30% OFF recommended)");
    lines.push("─".repeat(60));
    for (const p of bucket.warning) {
      const expiry = new Date(p.expiry_date);
      const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const discounted = Math.round(p.price_inr * 0.7);
      lines.push(`  • ${p.product_name}`);
      lines.push(`    Expires in ${daysLeft} day(s) | Stock: ${p.stock_count} | ₹${p.price_inr} → 30% OFF → ₹${discounted}`);
    }
    lines.push("");
  }

  lines.push("📣 SUGGESTED BANNER:");
  lines.push(`  "Today's FLASH SALE — Up to 50% OFF on selected items! While stocks last."`);
  lines.push("\n✅ Report complete. Powered by Supermarket AI Agent + x402 on Avalanche.");

  return lines.join("\n");
}

// ─── Quick Stock Summary ──────────────────────────────────────────────────────

export function generateStockSummary(products: Product[]): string {
  const total = products.reduce((sum, p) => sum + p.stock_count, 0);
  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════╗");
  lines.push("║        📦 STOCK SUMMARY               ║");
  lines.push("╚══════════════════════════════════════╝");
  lines.push(`Total SKUs       : ${products.length}`);
  lines.push(`Total Stock Units: ${total}`);
  lines.push("");
  lines.push("Product".padEnd(35) + "Stock".padEnd(8) + "Expires");
  lines.push("─".repeat(60));

  for (const p of products) {
    const expiry = new Date(p.expiry_date);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const daysLeft = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const flag = daysLeft <= 0 ? "🚨" : daysLeft <= 2 ? "⚠️ " : daysLeft <= 3 ? "💛" : "✅";
    lines.push(`${flag} ${p.product_name.substring(0, 32).padEnd(33)} ${String(p.stock_count).padEnd(8)} ${p.expiry_date}`);
  }

  return lines.join("\n");
}