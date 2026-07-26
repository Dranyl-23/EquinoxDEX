# EquinoxDEX — Project Notes & Development Workflows

A monorepo for EquinoxDEX (Decentralized Cross-Margin Perpetual Trading Protocol on Stellar Soroban).

- `web/` — Next.js 16 + TypeScript + Tailwind CSS v4 frontend (Freighter wallet, real-time WebSocket charts, 1-Click trading, cross-margin positions dashboard).
- `contracts/smart-margin/` — Rust Soroban contract (`open_position`, `close_position`, `place_limit_order`, `trigger_orders`, `add_liquidity`, `remove_liquidity`) with unit tests.

## Stack & Architecture

- **Smart Contract**: Soroban Rust SDK 22 (`contracts/smart-margin/`)
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind v4
- **Wallet & Auth**: `@stellar/freighter-api` with ephemeral `sessionStorage` session keys for 1-Click trading
- **RPC & Network**: `@stellar/stellar-sdk` v15 `rpc` namespace on Stellar Testnet

## Testnet Reference

| Resource | Value |
|---|---|
| Soroban RPC | `https://soroban-testnet.stellar.org` |
| Horizon | `https://horizon-testnet.stellar.org` |
| Network passphrase | `Test SDF Network ; September 2015` |
| USDC SAC (Testnet) | `CBIELTK6YBZJU67VBKDS5V2P4IZZWVE7LOOK4RQHBQWUDT5DSSZLV6OJ` |
| XLM SAC (Native) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

## Build & Test Workflows

```bash
# Frontend Lint & Production Build
cd web
npm run lint
npm run build

# Smart Contract Unit Tests
cd contracts/smart-margin
cargo test
```
