# 🛒 Supermarket AI Agent — Powered by x402 on Avalanche

> An AI-powered inventory agent that charges shopkeepers micro-payments via the **x402 protocol** every time they query expiry status or stock levels. Built on **Avalanche Fuji Testnet** at Vibe-A-Thon 2026.

---

## 🧠 What It Does

Supermarkets lose thousands of rupees daily to expired products sitting on shelves. Our agent solves this by:

1. **Tracking inventory** — stock levels, expiry dates, categories
2. **AI-powered alerts** — flags products expiring within 48–72 hours
3. **Discount recommendations** — suggests 30–50% off on near-expiry items
4. **x402 payments** — each query costs **0.001 AVAX**, deducted automatically from the shopkeeper's blockchain wallet

---

## ⚡ The x402 Flow

```
Shopkeeper CLI
      │
      ▼
GET /query/expiry
      │
      ▼
Server responds: 402 Payment Required
  └─ { amount: "0.001 AVAX", payTo: "0xAGENT_WALLET", network: "avalanche-fuji" }
      │
      ▼
Client sends AVAX tx on Fuji
  └─ x-payment: <base64 encoded { txHash, shopkeeper }>
      │
      ▼
Server verifies tx on-chain
  └─ Records query via InventoryTracker.sol
      │
      ▼
AI Agent runs expiry analysis
  └─ Returns Discount Report
```

---

## 🏗️ Architecture

```
supermarket-agent/
├── contracts/
│   └── InventoryTracker.sol   ← Solidity contract (Avalanche Fuji)
├── scripts/
│   └── deploy.ts              ← Hardhat deploy script
├── agent.ts                   ← AI logic: expiry analysis + LLM report
├── server.ts                  ← Express server with x402 middleware
├── cli-demo.ts                ← Interactive CLI demo
├── inventory.json             ← Mock product data (10 items)
├── hardhat.config.ts
├── package.json
└── .env.example
```

---

## 🔗 Deployed Contract

| Network | Address |
|---------|---------|
| Avalanche Fuji Testnet | `0x_PASTE_YOUR_CONTRACT_ADDRESS_HERE` |
| Explorer | [View on Snowtrace](https://testnet.snowtrace.io/address/0x_YOUR_ADDRESS) |

> ✅ Contract verified on testnet block explorer.

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_TEAM/supermarket-agent
cd supermarket-agent
npm install
```

### 2. Set Environment Variables

```bash
cp .env.example .env
# Fill in your SHOPKEEPER_WALLET, PRIVATE_KEY, CONTRACT_ADDRESS, ANTHROPIC_API_KEY
```

### 3. Run the CLI Demo (fastest for judging)

```bash
npm run demo
```

### 4. Run the API Server

```bash
npm run dev
# Server starts at http://localhost:3000
```

---

## 🧑‍💻 Team Roles

| Person | Focus | Tasks |
|--------|-------|-------|
| **Person A (Faizan)** | Web3 / Contracts | Deploy `InventoryTracker.sol` to Fuji, verify on Snowtrace |
| **Person B (Ayush)** | Integration / SDK | x402 server setup, payment middleware in `server.ts` |
| **Person C (Saloni)** | AI / Data / GitHub | `inventory.json`, `agent.ts` AI logic, README, demo script |

---

## 📦 Tech Stack

- **Blockchain**: Avalanche Fuji Testnet (C-Chain)
- **Smart Contract**: Solidity 0.8.20
- **Payments**: x402 protocol (facinet-sdk)
- **AI**: Anthropic Claude (claude-opus-4-5)
- **Backend**: Node.js + Express + TypeScript
- **Deployment**: Hardhat

---

## 🎬 Demo Video

> 3-minute walkthrough showing:
> 1. Terminal boots up — wallet balance shown
> 2. Shopkeeper requests expiry check → gets **402 Payment Required**
> 3. Payment of 0.001 AVAX sent → verified on Fuji
> 4. AI Discount Report printed in terminal
> 5. On-chain record shown on Snowtrace explorer

---

## 📝 License

MIT — Built at Vibe-A-Thon 2026