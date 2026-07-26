#!/usr/bin/env bash
set -euo pipefail

echo "=== Building Soroban Smart Margin Contract ==="
cd contracts/smart-margin
cargo test
stellar contract build

echo "=== Deploying to Stellar Testnet ==="
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/smart_margin.wasm \
  --source alice \
  --network testnet)

echo "Contract deployed successfully! Contract ID: $CONTRACT_ID"
echo "NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID" > ../../web/.env.local
