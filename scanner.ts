import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Jimp } from "jimp";
import { BrowserQRCodeReader } from "@zxing/browser";
dotenv.config();

const INVENTORY_PATH = path.join(process.cwd(), "inventory.json");

function loadInventory(): any[] {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf-8"));
}

function saveInventory(inventory: any[]): void {
  fs.writeFileSync(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
  console.log("✅ inventory.json updated!");
}

function parseQRText(qrText: string): any {
  console.log("\n🤖 Parsing product details from QR...");

  // Try to parse key-value format
  // Example: "Product: Amul Milk | Price: 60 | Expiry: 2026-03-20"
  const result: any = {
    product_name: "Unknown Product",
    category: "general",
    expiry_date: getDefaultExpiry(),
    stock_count: 50,
    price_inr: 100,
    unit: "piece",
    discount_percent: 0,
  };

  // Parse pipe-separated key:value pairs
  const parts = qrText.split("|").map((p) => p.trim());
  for (const part of parts) {
    const [key, ...valueParts] = part.split(":");
    const value = valueParts.join(":").trim();

    if (!key || !value) continue;

    const k = key.toLowerCase().trim();

    if (k.includes("product") || k.includes("name")) {
      result.product_name = value;
    } else if (k.includes("price") || k.includes("inr") || k.includes("cost")) {
      result.price_inr = parseFloat(value.replace(/[^0-9.]/g, "")) || 100;
    } else if (k.includes("expir") || k.includes("exp") || k.includes("date")) {
      result.expiry_date = value || getDefaultExpiry();
    } else if (k.includes("stock") || k.includes("qty") || k.includes("quantity")) {
      result.stock_count = parseInt(value) || 50;
    } else if (k.includes("categor")) {
      result.category = value;
    } else if (k.includes("unit")) {
      result.unit = value;
    } else if (k.includes("discount")) {
      result.discount_percent = parseFloat(value) || 0;
    }
  }

  // If no pipe format, use entire text as product name
  if (result.product_name === "Unknown Product" && qrText.length > 0) {
    result.product_name = qrText.substring(0, 50);
  }

  return result;
}

function getDefaultExpiry(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().split("T")[0];
}

export async function addProductToInventory(imagePath: string): Promise<void> {
  try {
    console.log(`\n📷 Reading QR code from: ${imagePath}`);

    // Read QR using jimp + zxing
    const image = await Jimp.read(imagePath);
    const { data, width, height } = image.bitmap;

    // Convert to luminance array for zxing
    const luminances = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      luminances[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    // Decode QR
    const { BinaryBitmap, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } = await import("@zxing/library");
    const source = new RGBLuminanceSource(luminances, width, height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const reader = new MultiFormatReader();
    const result = reader.decode(bitmap);
    const qrText = result.getText();

    console.log(`📋 QR Data: ${qrText}`);

    // Parse product details
    const product = parseQRText(qrText);

    // Load inventory and add
    const inventory = loadInventory();
    const newId = `PROD${String(inventory.length + 1).padStart(3, "0")}`;

    const newProduct = {
      id: newId,
      product_name: product.product_name,
      category: product.category,
      expiry_date: product.expiry_date,
      stock_count: product.stock_count,
      price_inr: product.price_inr,
      unit: product.unit,
      discount_percent: product.discount_percent,
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

    console.log(`\n🎉 "${newProduct.product_name}" added to inventory!`);
    console.log(`   ID     : ${newProduct.id}`);
    console.log(`   Expiry : ${newProduct.expiry_date}`);
    console.log(`   Stock  : ${newProduct.stock_count} units`);
    console.log(`   Price  : ₹${newProduct.price_inr}`);

  } catch (err: any) {
    console.error("❌ Error reading QR:", err.message);
    console.log("💡 Make sure the image contains a clear QR code!");
  }
}