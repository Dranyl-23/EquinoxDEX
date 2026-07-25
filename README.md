# Equinox Exchange - Equinox DEX

**Track:** Track 3 — DeFi, Stablecoins & Real-World Assets  
**Tagline:** Institutional Trading Logic. Decentralized Wallet Security. Built on Soroban.

## Executive Summary
SmartMargin (formerly PerpWallet) is an advanced, non-custodial Smart Wallet designed specifically for high-performance decentralized finance (DeFi) and perpetual futures trading on the Stellar network. Built using Soroban Smart Contracts (Rust) and a Next.js frontend, SmartMargin abstracts the complexities of margin trading into a seamless, high-speed user experience.

By leveraging Stellar's fast finality (5 seconds) and sub-cent fees, SmartMargin allows traders to open, manage, and liquidate leveraged positions without the exorbitant gas fees or latency associated with traditional Ethereum-based DeFi platforms.

## 1. The Opening Hook (The Problem)
Right now, decentralized perpetual trading is fundamentally broken. If you use Ethereum, you pay $20 in gas and wait 20 seconds for a trade to confirm. Platforms like Hyperliquid fixed this, but they had to build an entirely separate, isolated blockchain just to get the speed they needed. That creates a walled garden with huge bridging risks.

## 2. The Solution (EquinoxDEX)
Enter **EquinoxDEX**. We are bringing Hyperliquid-level speeds directly to the Stellar ecosystem using Soroban smart contracts. We don't need to build a custom blockchain, because Stellar already gives us 3-5 second finality and sub-cent fees out of the box.

## 3. The "Unfair Advantage" (Why we win)
But here is what makes EquinoxDEX better: **Real-World Connection**.
On other fast chains, getting money in and out is a nightmare of bridges and wrapped tokens. Because we are built on Stellar, EquinoxDEX uses **Native Circle USDC**, and we inherit Stellar's MoneyGram fiat on-ramps. 

A user in the Philippines can literally walk into a MoneyGram, hand over cash, receive Native USDC in their Freighter wallet, and instantly open a 50x leveraged Bitcoin position on EquinoxDEX with zero bridging risk and zero latency.

---

## Technology Stack
*   **Smart Contracts:** Rust (Stellar Soroban Testnet)
*   **Blockchain Integration:** `@stellar/stellar-sdk` (v14)
*   **Frontend Framework:** Next.js (App Router, TypeScript)
*   **Styling:** Tailwind CSS
*   **Wallet Connection:** Freighter Extension (`@stellar/freighter-api`)

---

## Local Development (Workshop Scaffold)

### 1. Run the Frontend
```bash
cd web
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 2. Build & Deploy Smart Contract (Soroban)
The `smart-margin` contract handles the core margin vault and position management logic.
```powershell
# From the repository root
cargo test

# Deploy to testnet and auto-wire contract ID to the frontend
.\scripts\dev.ps1
```
