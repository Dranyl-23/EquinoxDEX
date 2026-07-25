# Deploy both mock-oracle and smart-margin to Stellar testnet, then write the 
# smart-margin contract ID into web\.env.local so the frontend can call it.
#
# Usage:  .\scripts\deploy.ps1 [identityName]   (default identity: workshop)

param([string]$Identity = "workshop")

$ErrorActionPreference = "Stop"
$Network = "testnet"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$OracleWasm = "target\wasm32v1-none\release\mock_oracle.wasm"
$MarginWasm = "target\wasm32v1-none\release\smart_margin.wasm"
$EnvFile = Join-Path $Root "web\.env.local"

Set-Location $Root

# 1. Ensure a funded testnet identity exists
$keys = stellar keys ls
if ($keys -notcontains $Identity) {
  Write-Host "Creating + funding testnet identity '$Identity'..."
  stellar keys generate $Identity --network $Network --fund
}

$AdminAddr = (stellar keys address $Identity).Trim()
$NativeToken = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

# 2. Build the contracts
Write-Host "Building contracts..."
stellar contract build

# 3. Deploy Mock Oracle
Write-Host "Deploying Mock Oracle..."
$OracleId = (stellar contract deploy --wasm $OracleWasm --source-account $Identity --network $Network).Trim()
Write-Host "Deployed Oracle ID: $OracleId"

# 4. Initialize Mock Oracle and set initial price
Write-Host "Initialising Mock Oracle..."
stellar contract invoke --id $OracleId --source-account $Identity --network $Network -- init --admin $AdminAddr
Write-Host "Setting initial BTC price to \$60,000..."
stellar contract invoke --id $OracleId --source-account $Identity --network $Network -- set_price --admin $AdminAddr --symbol BTC --price 600000000000

# 5. Deploy Smart Margin
Write-Host "Deploying Smart Margin..."
$MarginId = (stellar contract deploy --wasm $MarginWasm --source-account $Identity --network $Network).Trim()
Write-Host "Deployed Smart Margin ID: $MarginId"

# 6. Initialize Smart Margin
Write-Host "Initialising Smart Margin..."
stellar contract invoke --id $MarginId --source-account $Identity --network $Network -- init --admin $AdminAddr --usdc_token $NativeToken --oracle_address $OracleId

# 7. Write NEXT_PUBLIC_CONTRACT_ID into web\.env.local
if (Test-Path $EnvFile) {
  (Get-Content $EnvFile) | Where-Object { $_ -notmatch '^NEXT_PUBLIC_CONTRACT_ID=' } | Set-Content $EnvFile
}
Add-Content $EnvFile "NEXT_PUBLIC_CONTRACT_ID=$MarginId"
Write-Host ""
Write-Host "Wrote NEXT_PUBLIC_CONTRACT_ID=$MarginId to web\.env.local"
Write-Host "Restart 'npm run dev' to pick up the new contract ID."
