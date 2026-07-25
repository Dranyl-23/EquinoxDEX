#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::token::StellarAssetClient as TokenAdminClient;

fn create_token_contract<'a>(env: &Env, admin: &Address) -> (TokenClient<'a>, TokenAdminClient<'a>) {
    let contract_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
    (
        TokenClient::new(env, &contract_address),
        TokenAdminClient::new(env, &contract_address),
    )
}

fn setup(env: &Env) -> SmartMarginContractClient<'_> {
    let contract_id = env.register(SmartMarginContract, ());
    SmartMarginContractClient::new(env, &contract_id)
}

#[test]
fn test_long_profitable() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    
    // Mint 1000 USDC to user
    token_admin.mint(&user, &1000_0000000);

    let client = setup(&env);
    let contract_id = client.address.clone();

    // Mint liquidity to the contract so it can pay out winning trades
    token_admin.mint(&contract_id, &10000_0000000);

    // Init with BTC price at $60,000 (scaled by 10^7, so 600,000,000,000)
    let btc_price: i128 = 60000_0000000;
    client.init(&admin, &token.address, &btc_price);

    // User opens 10x Long with 100 USDC margin
    let margin: i128 = 100_0000000;
    client.open_position(&user, &margin, &10, &true);

    // Check balances (user should have 900, contract 10100)
    assert_eq!(token.balance(&user), 900_0000000);
    assert_eq!(token.balance(&contract_id), 10100_0000000);

    // Price pumps to $66,000 (+10%)
    // 10x leverage = +100% PnL (profit = 100 USDC)
    client.set_price(&admin, &66000_0000000);

    // Close position
    let payout = client.close_position(&user);
    
    // Expected payout = margin (100) + profit (100) = 200 USDC
    assert_eq!(payout, 200_0000000);
    assert_eq!(token.balance(&user), 1100_0000000); // 900 + 200
    assert_eq!(token.balance(&contract_id), 9900_0000000); // 10100 - 200
}

#[test]
fn test_long_liquidation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&user, &1000_0000000);

    let client = setup(&env);
    let contract_id = client.address.clone();

    token_admin.mint(&contract_id, &10000_0000000);

    let btc_price: i128 = 60000_0000000;
    client.init(&admin, &token.address, &btc_price);

    let margin: i128 = 100_0000000;
    client.open_position(&user, &margin, &10, &true);

    // Price dumps to $54,000 (-10%)
    // 10x leverage = -100% PnL (profit = -100 USDC) -> Liquidated
    client.set_price(&admin, &54000_0000000);

    let payout = client.close_position(&user);
    
    // Expected payout = 0
    assert_eq!(payout, 0);
    assert_eq!(token.balance(&user), 900_0000000); 
    // The contract keeps the 100 USDC
    assert_eq!(token.balance(&contract_id), 10100_0000000);
}
