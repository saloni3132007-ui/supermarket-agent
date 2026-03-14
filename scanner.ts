import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const INVENTORY_PATH = path.join(process.cwd(), "inventory.json");

function loadInventory(): any[] {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf-8"));
}

function saveInventory(inventory: any[]): void {
  fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
  console.log("✅ inventory.json updated!");
}

async function extractQRData(imagePath: string): Promise<string> {
  console.log(`\n📷 Reading QR code from: ${imagePath}`);
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const ext = path.extname(imagePath).toLowerCase();

  let mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg";
  if (ext === ".png") mediaType = "image/png";
  if (ext === ".webp") mediaType = "image/webp";

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: "text",
            text: `Look at this image carefully. 
If it contains a QR code or barcode, read and extract ALL text/data from it.
If it's a product image, extract product details you can see.
Return ONLY the raw extracted text/data, nothing else.
If you cannot read anything useful, say "UNREADABLE".`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" 
    ? response.content[0].text 
    : "UNREADABLE";
  console.log(`📋 Extracted: ${text}`);
  return text;
}

async function parseProductFromQR(qrData: string): Promise<any> {
  console.log("\n🤖 AI parsing product details...");

  const today = new Date();
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);
  const defaultExpiry = sevenDaysLater.toISOString().split("T")[0];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `You are a supermarket inventory assistant.

Extract product details from this data and return ONLY a JSON object:
"${qrData}"

Return this exact JSON format:
{
  "product_name": "product name here",
  "category": "dairy/bakery/produce/meat/beverage/snack/grain",
  "expiry_date": "${defaultExpiry}",
  "stock_count": 50,
  "price_inr": 100,
  "unit": "kg/litre/piece/pack",
  "discount_percent": 0
}

Rules:
- If expiry not found, use: ${defaultExpiry}
- If price not found, estimate based on product type
- If stock not found, set to 50
- Return ONLY the JSON, no other text, no markdown`,
      },
    ],
  });

  const text = response.content[0].type === "text" 
    ? response.content[0].text 
    : "{}";

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    console.error("❌ Could not parse AI response");
    return null;
  }
}

export async function addProductToInventory(imagePath: string): Promise<void> {
  try {
    const qrData = await extractQRData(imagePath);

    if (qrData === "UNREADABLE") {
      console.log("❌ Could not read QR code. Make sure image is clear!");
      return;
    }

    const product = await parseProductFromQR(qrData);

    if (!product) {
      console.log("❌ Could not extract product details!");
      return;
    }

    const inventory = loadInventory();
    const newId = `PROD${String(inventory.length + 1).padStart(3, "0")}`;

    const newProduct = {
      id: newId,
      product_name: product.product_name,
      category: product.category || "general",
      expiry_date: product.expiry_date,
      stock_count: product.stock_count || 50,
      price_inr: product.price_inr || 100,
      unit: product.unit || "piece",
      discount_percent: product.discount_percent || 0,
      added_via: "QR_SCAN",
      added_at: new Date().toISOString(),
    };

    console.log("\n📦 Product detected:");
    console.table([{
      ID: newProduct.id,
      Product: newProduct.product_name,
      Category: newProduct.category,
      Expiry: newProduct.expiry_date,
      Stock: newProduct.stock_count,
      Price: `₹${newProduct.price_inr}`,
    }]);

    inventory.push(newProduct);
    saveInventory(inventory);

    console.log(`\n🎉 "${newProduct.product_name}" successfully added to inventory!`);
    console.log(`   ID     : ${newProduct.id}`);
    console.log(`   Expiry : ${newProduct.expiry_date}`);
    console.log(`   Stock  : ${newProduct.stock_count} units`);
    console.log(`   Price  : ₹${newProduct.price_inr}`);

  } catch (err: any) {
    console.error("❌ Error:", err.message);
  }
}