#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};
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

#[test]
fn test_funding_rate_impact() {
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

    // Funding rate starts at 0. User opens long.
    client.open_position(&user, &100_0000000, &10, &true, &0, &0);

    // Admin hikes funding rate to 20 USDC per margin unit
    client.set_funding_rate(&admin, &20_0000000);

    // Price stays the same, but user closes position. 
    // They are long, rate went up by 20, so they owe 20 USDC.
    let payout = client.close_position(&user);
    
    // Expected: 100 margin - 20 funding loss = 80 USDC
    assert_eq!(payout, 80_0000000);
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
