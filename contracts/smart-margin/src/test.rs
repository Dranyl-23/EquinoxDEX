#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Ledger, Address, Env, Symbol};
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::token::StellarAssetClient as TokenAdminClient;

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

fn set_dummy_price(env: &Env, oracle_id: &Address, price: i128) {
    env.invoke_contract::<()>(
        oracle_id,
        &Symbol::new(env, "set_price"),
        vec![env, price.into_val(env)]
    );
}

// In soroban SDK 22+, we can set timestamp via testutils
fn advance_time(env: &Env, seconds: u64) {
    let mut li = env.ledger().get();
    li.timestamp += seconds;
    env.ledger().set(li);
}

#[test]
fn test_dynamic_skew_funding() {
    let env = Env::default();
    env.mock_all_auths();

    // Start ledger at t=1000
    let mut li = env.ledger().get();
    li.timestamp = 1000;
    env.ledger().set(li);

    let admin = Address::generate(&env);
    let lp = Address::generate(&env);
    let user1 = Address::generate(&env); // Long trader
    let user2 = Address::generate(&env); // Short trader

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&lp, &10000_0000000);
    token_admin.mint(&user1, &1000_0000000);
    token_admin.mint(&user2, &1000_0000000);

    let client = setup(&env);
    let oracle_id = setup_oracle(&env);

    client.init(&admin, &token.address, &oracle_id);
    client.add_liquidity(&lp, &10000_0000000);
    set_dummy_price(&env, &oracle_id, 60000_0000000);

    // User 1 opens 10x Long with 100 USDC (Position size = 1000)
    // Skew becomes +1000
    client.open_position(&user1, &100_0000000, &10, &true, &0, &0);
    
    let state1 = client.get_market_state();
    assert_eq!(state1.0, 1000_0000000); // Long OI
    assert_eq!(state1.1, 0);            // Short OI
    assert_eq!(state1.2, 0);            // Global Funding Index (time hasn't passed)
    assert_eq!(state1.3, 1000_0000000); // Total Volume

    // Advance time by 100 seconds
    advance_time(&env, 100);

    // User 2 opens 10x Short with 100 USDC (Position size = 1000)
    // This action will trigger `update_funding()`.
    // Skew was +1000. Time = 100s.
    // Funding added = (1000_0000000 * 100) / 10000 = 10000000 (which is 1 USDC).
    client.open_position(&user2, &100_0000000, &10, &false, &0, &0);

    let state2 = client.get_market_state();
    assert_eq!(state2.0, 1000_0000000); // Long OI
    assert_eq!(state2.1, 1000_0000000); // Short OI
    assert_eq!(state2.2, 10_0000000);   // Global Funding is now 10 USDC
    assert_eq!(state2.3, 2000_0000000); // Total Volume is now 2000

    // Advance time by another 100 seconds
    advance_time(&env, 100);

    // Skew is now 0 (Long OI == Short OI). So funding shouldn't change when we close.
    // User 1 (Long) closes. They entered at Index 0. Current Index is 10.
    // Funding PnL = -(10_0000000 * 1000_0000000) / 10_000_000_000 = -10_0000000 = -10 USDC
    let payout1 = client.close_position(&user1);
    // 100 margin - 10 funding = 90 payout
    assert_eq!(payout1, 90_0000000);

    // User 2 (Short) closes. They entered at Index 10. Current Index is 10.
    // Funding diff = 0, so funding PnL = 0.
    let payout2 = client.close_position(&user2);
    // 100 margin + 0 funding = 100 payout
    assert_eq!(payout2, 100_0000000);
}

#[test]
fn test_take_profit_trigger() {
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
    client.add_liquidity(&lp, &10000_0000000);
    set_dummy_price(&env, &oracle_id, 60000_0000000);

    // Open Long at 60k, TP at 66k, SL at 54k
    client.open_position(&user, &100_0000000, &10, &true, &66000_0000000, &54000_0000000);

    // Price hits TP exactly
    set_dummy_price(&env, &oracle_id, 66000_0000000);

    // A keeper bot triggers it
    let payout = client.trigger_orders(&user);
    
    // +10% move * 10x leverage = +100%. Payout = 200 USDC.
    assert_eq!(payout, 200_0000000);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_order_not_triggered() {
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
    client.add_liquidity(&lp, &10000_0000000);
    set_dummy_price(&env, &oracle_id, 60000_0000000);

    // TP at 66k, SL at 54k
    client.open_position(&user, &100_0000000, &10, &true, &66000_0000000, &54000_0000000);

    // Price moves to 65k (Not at TP yet)
    set_dummy_price(&env, &oracle_id, 65000_0000000);

    // Keeper tries to trigger, should panic with OrderNotTriggered
    client.trigger_orders(&user);
}
