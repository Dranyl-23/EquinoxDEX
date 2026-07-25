# SmartMargin

**Track:** Track 3 — DeFi, Stablecoins & Real-World Assets  
**Tagline:** Institutional Trading Logic. Decentralized Wallet Security. Built on Soroban.

## Executive Summary
SmartMargin (formerly PerpWallet) is an advanced, non-custodial Smart Wallet designed specifically for high-performance decentralized finance (DeFi) and perpetual futures trading on the Stellar network. Built using Soroban Smart Contracts (Rust) and a Next.js frontend, SmartMargin abstracts the complexities of margin trading into a seamless, high-speed user experience.

By leveraging Stellar's fast finality (5 seconds) and sub-cent fees, SmartMargin allows traders to open, manage, and liquidate leveraged positions without the exorbitant gas fees or latency associated with traditional Ethereum-based DeFi platforms.

## The Problem
*   **High Cost of Trading:** Opening leveraged positions on Ethereum/L2s requires multiple transactions (Approve, Deposit, Open Trade). Gas fees erase profit margins for smaller traders.
*   **Volatility of Collateral:** Depositing volatile assets (like ETH) as collateral means margin can crash at the exact moment a long position loses money, triggering rapid, unfair liquidations.
*   **Centralized Risk:** Most self-custodial wallets rely on centralized backend servers (keepers) for stop-losses/take-profits. If the server crashes during high volatility, users lose money.

## The Solution
*   **Stablecoin (USDC) Margin Vault:** Users deposit USDC directly into a Soroban Smart Contract to act as collateral. Your margin is always stable.
*   **"One-Click" Smart Account Trading:** Bundles token approvals, collateral locking, and trade execution into a single, seamless click on the frontend.
*   **On-Chain Automated Stop-Loss:** Automation lives entirely on the blockchain via Soroban. There are no central servers that can go offline or crash.
*   **Synthetic Exposure:** Bet on price action using USDC. Profit/loss is calculated and paid out in USDC without needing to buy, hold, or bridge the underlying assets.

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
