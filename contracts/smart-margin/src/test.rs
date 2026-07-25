#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::token::StellarAssetClient as TokenAdminClient;

// Define a simple mock oracle in the same file for testing
#[contract]
pub struct DummyOracle;
#[contractimpl]
impl DummyOracle {
    pub fn get_price(env: Env, _symbol: Symbol) -> i128 {
        env.storage().instance().get(&Symbol::new(&env, "mock_price")).unwrap_or(0)
    }
    pub fn set_price(env: Env, price: i128) {
        env.storage().instance().set(&Symbol::new(&env, "mock_price"), &price);
    }
}

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

fn setup_oracle(env: &Env) -> Address {
    env.register(DummyOracle, ())
}

// Helper to set price on the dummy oracle
fn set_dummy_price(env: &Env, oracle_id: &Address, price: i128) {
    env.invoke_contract::<()>(
        oracle_id,
        &Symbol::new(env, "set_price"),
        vec![env, price.into_val(env)]
    );
}

#[test]
fn test_long_profitable_with_lp() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let lp = Address::generate(&env);
    let user = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    
    // Mint 10,000 USDC to LP, 1000 to user
    token_admin.mint(&lp, &10000_0000000);
    token_admin.mint(&user, &1000_0000000);

    let client = setup(&env);
    let contract_id = client.address.clone();
    let oracle_id = setup_oracle(&env);

    // Init the margin contract
    client.init(&admin, &token.address, &oracle_id);

    // LP adds 10,000 USDC liquidity
    client.add_liquidity(&lp, &10000_0000000);
    
    // Set BTC price to $60,000
    set_dummy_price(&env, &oracle_id, 60000_0000000);

    // User opens 10x Long with 100 USDC margin
    client.open_position(&user, &100_0000000, &10, &true);

    // Check balances
    assert_eq!(token.balance(&user), 900_0000000);
    assert_eq!(token.balance(&lp), 0);
    assert_eq!(token.balance(&contract_id), 10100_0000000); // 10,000 LP + 100 Margin

    // Price pumps to $66,000 (+10%), 10x leverage = +100% PnL = +100 USDC profit
    set_dummy_price(&env, &oracle_id, 66000_0000000);

    // Close position
    let payout = client.close_position(&user);
    
    // Expected payout = margin (100) + profit (100) = 200 USDC
    assert_eq!(payout, 200_0000000);
    assert_eq!(token.balance(&user), 1100_0000000); // 900 + 200 payout
    assert_eq!(token.balance(&contract_id), 9900_0000000); // 10100 - 200 payout

    // LP withdraws their remaining liquidity
    // Since LP pool paid out 100 USDC, LP pool should only have 9900 USDC left
    let usdc_returned = client.remove_liquidity(&lp, &10000_0000000); // they got 10000 shares originally
    assert_eq!(usdc_returned, 9900_0000000);
    assert_eq!(token.balance(&lp), 9900_0000000);
}

#[test]
fn test_long_liquidation_with_lp() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let lp = Address::generate(&env);
    let user = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&lp, &10000_0000000);
    token_admin.mint(&user, &1000_0000000);

    let client = setup(&env);
    let oracle_id = setup_oracle(&env);

    client.init(&admin, &token.address, &oracle_id);

    // LP adds 10,000 USDC
    client.add_liquidity(&lp, &10000_0000000);
    
    set_dummy_price(&env, &oracle_id, 60000_0000000);

    // User opens 10x Long with 100 USDC margin
    client.open_position(&user, &100_0000000, &10, &true);

    // Price dumps to $54,000 (-10%), 10x leverage = -100% PnL = Liquidated
    set_dummy_price(&env, &oracle_id, 54000_0000000);

    let payout = client.close_position(&user);
    
    // Expected payout = 0
    assert_eq!(payout, 0);
    assert_eq!(token.balance(&user), 900_0000000); 

    // The LP pool keeps the user's 100 USDC margin
    let usdc_returned = client.remove_liquidity(&lp, &10000_0000000);
    assert_eq!(usdc_returned, 10100_0000000);
    assert_eq!(token.balance(&lp), 10100_0000000);
}
