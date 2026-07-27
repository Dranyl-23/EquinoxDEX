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
    pub fn get_price(env: Env, symbol: Symbol) -> i128 {
        env.storage().instance().get(&symbol).unwrap_or(0)
    }
    pub fn set_price(env: Env, symbol: Symbol, price: i128) {
        env.storage().instance().set(&symbol, &price);
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

fn set_dummy_price(env: &Env, oracle_id: &Address, symbol: &str, price: i128) {
    env.invoke_contract::<()>(
        oracle_id,
        &Symbol::new(env, "set_price"),
        vec![env, Symbol::new(env, symbol).into_val(env), price.into_val(env)]
    );
}

fn advance_time(env: &Env, seconds: u64) {
    let mut li = env.ledger().get();
    li.timestamp += seconds;
    env.ledger().set(li);
}

#[test]
fn test_dynamic_skew_funding() {
    let env = Env::default();
    env.mock_all_auths();

    let mut li = env.ledger().get();
    li.timestamp = 1000;
    env.ledger().set(li);

    let admin = Address::generate(&env);
    let lp = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&lp, &10000_0000000);
    token_admin.mint(&user1, &1000_0000000);
    token_admin.mint(&user2, &1000_0000000);

    let client = setup(&env);
    let oracle_id = setup_oracle(&env);

    client.init(&admin, &token.address, &oracle_id);
    client.add_supported_token(&admin, &token.address, &Symbol::new(&env, "USDC"));
    set_dummy_price(&env, &oracle_id, "USDC", 10_000000); // 1.00 USD for easy math
    client.add_liquidity(&lp, &token.address, &10000_0000000);
    set_dummy_price(&env, &oracle_id, "BTC", 60000_0000000);

    client.deposit_margin(&user1, &102_0000000); // Extra 2 USDC to cover 0.1% open_fee (C4 FIX)
    let pos_id1 = client.open_position(&user1, &user1, &Symbol::new(&env, "BTC"), &100_0000000, &10, &true, &0, &0, &0);
    
    let state1 = client.get_market_state();
    assert_eq!(state1.0, 1000_0000000); // Long OI (100 margin * 10 leverage)
    assert_eq!(state1.1, 0);            // Short OI
    assert_eq!(state1.2, 0);            // Global Funding Index
    assert_eq!(state1.3, 1000_0000000); // Total Volume

    advance_time(&env, 100);

    client.deposit_margin(&user2, &102_0000000);
    let pos_id2 = client.open_position(&user2, &user2, &Symbol::new(&env, "BTC"), &100_0000000, &10, &false, &0, &0, &0);

    let state2 = client.get_market_state();
    assert_eq!(state2.0, 1000_0000000); // Long OI
    assert_eq!(state2.1, 1000_0000000); // Short OI
    assert_eq!(state2.2, 10_0000000);   // Global Funding is now 10 USDC

    advance_time(&env, 100);

    let payout1 = client.close_position(&user1, &user1, &pos_id1, &0);
    assert_eq!(payout1, -11_0000000); // -10 USDC funding loss, -1 USDC close fee

    let payout2 = client.close_position(&user2, &user2, &pos_id2, &0);
    assert_eq!(payout2, -1_0000000);  // 0 funding diff, -1 USDC close fee
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
    client.add_supported_token(&admin, &token.address, &Symbol::new(&env, "USDC"));
    set_dummy_price(&env, &oracle_id, "USDC", 10_000000); // $1 for LP deposit
    client.add_liquidity(&lp, &token.address, &10000_0000000);
    set_dummy_price(&env, &oracle_id, "BTC", 60000_0000000);

    client.deposit_margin(&user, &102_0000000);
    client.open_position(&user, &user, &Symbol::new(&env, "BTC"), &100_0000000, &10, &true, &66000_0000000, &54000_0000000, &0);

    set_dummy_price(&env, &oracle_id, "BTC", 66000_0000000);

    let keeper = Address::generate(&env); // H1 Verification: Third-party keeper can trigger orders!
    let payout = client.trigger_orders(&keeper, &user);
    assert_eq!(payout, 990_000000); // Cross-margin net PnL (+100 USDC profit minus 1 USDC close fee)
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
    client.add_supported_token(&admin, &token.address, &Symbol::new(&env, "USDC"));
    set_dummy_price(&env, &oracle_id, "USDC", 10_000000);
    client.add_liquidity(&lp, &token.address, &10000_0000000);
    set_dummy_price(&env, &oracle_id, "BTC", 60000_0000000);

    client.deposit_margin(&user, &102_0000000);
    client.open_position(&user, &user, &Symbol::new(&env, "BTC"), &100_0000000, &10, &true, &66000_0000000, &54000_0000000, &0);

    set_dummy_price(&env, &oracle_id, "BTC", 65000_0000000);

    client.trigger_orders(&user, &user);
}

#[test]
fn test_leaderboard() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let lp = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&lp, &10000_0000000);
    token_admin.mint(&user1, &1000_0000000);
    token_admin.mint(&user2, &1000_0000000);
    token_admin.mint(&user3, &1000_0000000);

    let client = setup(&env);
    let oracle_id = setup_oracle(&env);

    client.init(&admin, &token.address, &oracle_id);
    client.add_supported_token(&admin, &token.address, &Symbol::new(&env, "USDC"));
    set_dummy_price(&env, &oracle_id, "USDC", 10_000000);
    client.add_liquidity(&lp, &token.address, &10000_0000000);
    
    // User 1 makes profit
    set_dummy_price(&env, &oracle_id, "BTC", 60000_0000000);
    client.deposit_margin(&user1, &102_0000000); // Extra 2 USDC to cover 0.1% open_fee (C4 FIX)
    let p1 = client.open_position(&user1, &user1, &Symbol::new(&env, "BTC"), &100_0000000, &10, &true, &0, &0, &0);
    set_dummy_price(&env, &oracle_id, "BTC", 66000_0000000);
    client.close_position(&user1, &user1, &p1, &0);
    
    // User 2 takes a loss
    client.deposit_margin(&user2, &102_0000000);
    let p2 = client.open_position(&user2, &user2, &Symbol::new(&env, "BTC"), &100_0000000, &10, &true, &0, &0, &0);
    set_dummy_price(&env, &oracle_id, "BTC", 60000_0000000);
    client.close_position(&user2, &user2, &p2, &0);
    
    // User 3 makes more profit
    client.deposit_margin(&user3, &102_0000000);
    let p3 = client.open_position(&user3, &user3, &Symbol::new(&env, "BTC"), &100_0000000, &20, &true, &0, &0, &0);
    set_dummy_price(&env, &oracle_id, "BTC", 66000_0000000);
    client.close_position(&user3, &user3, &p3, &0);

    let leaderboard = client.get_leaderboard();
    assert_eq!(leaderboard.len(), 3);
    
    // user3 > user1 > user2
    assert_eq!(leaderboard.get(0).unwrap().user, user3);
    assert_eq!(leaderboard.get(1).unwrap().user, user1);
    assert_eq!(leaderboard.get(2).unwrap().user, user2);
    
    let user1_pnl = client.get_user_pnl(&user1);
    assert!(user1_pnl > 0);
    assert!(client.get_user_pnl(&user2) < 0);
}

#[test]
fn test_session_keys() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let lp = Address::generate(&env);
    let user = Address::generate(&env);
    let session = Address::generate(&env);
    let _evil_hacker = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&lp, &10000_0000000);
    token_admin.mint(&user, &1000_0000000);

    let client = setup(&env);
    let oracle_id = setup_oracle(&env);

    client.init(&admin, &token.address, &oracle_id);
    client.add_supported_token(&admin, &token.address, &Symbol::new(&env, "USDC"));
    set_dummy_price(&env, &oracle_id, "USDC", 10_000000);
    client.add_liquidity(&lp, &token.address, &10000_0000000);
    set_dummy_price(&env, &oracle_id, "BTC", 60000_0000000);

    // Register session key
    client.add_session_key(&user, &session);

    client.deposit_margin(&user, &102_0000000);
    // Open position using session key as caller!
    let p_id = client.open_position(&session, &user, &Symbol::new(&env, "BTC"), &100_0000000, &10, &true, &0, &0, &0);
    
    // Check it worked
    let positions = client.get_positions(&user);
    assert_eq!(positions.len(), 1);
    assert_eq!(positions.get(0).unwrap().id, p_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_session_keys_hacker() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let lp = Address::generate(&env);
    let user = Address::generate(&env);
    let evil_hacker = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&lp, &10000_0000000);
    token_admin.mint(&user, &1000_0000000);

    let client = setup(&env);
    let oracle_id = setup_oracle(&env);

    client.init(&admin, &token.address, &oracle_id);
    client.add_supported_token(&admin, &token.address, &Symbol::new(&env, "USDC"));
    set_dummy_price(&env, &oracle_id, "USDC", 10_000000);
    client.add_liquidity(&lp, &token.address, &10000_0000000);
    set_dummy_price(&env, &oracle_id, "BTC", 60000_0000000);

    client.deposit_margin(&user, &102_0000000);
    // Try opening position using hacker as caller
    client.open_position(&evil_hacker, &user, &Symbol::new(&env, "BTC"), &100_0000000, &10, &true, &0, &0, &0);
}

#[test]
fn test_limit_orders() {
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
    client.add_supported_token(&admin, &token.address, &Symbol::new(&env, "USDC"));
    set_dummy_price(&env, &oracle_id, "USDC", 10_000000);
    client.add_liquidity(&lp, &token.address, &10000_0000000);
    set_dummy_price(&env, &oracle_id, "BTC", 60000_0000000);

    client.deposit_margin(&user, &102_0000000);
    client.place_limit_order(&user, &user, &100_0000000, &10, &true, &55000_0000000, &65000_0000000, &50000_0000000, &0);

    let orders = client.get_limit_orders(&user);
    assert_eq!(orders.len(), 1);

    // Price drops to trigger limit buy
    set_dummy_price(&env, &oracle_id, "BTC", 54000_0000000);
    let keeper = Address::generate(&env);
    client.trigger_orders(&keeper, &user);

    let positions = client.get_positions(&user);
    assert_eq!(positions.len(), 1);
    assert_eq!(positions.get(0).unwrap().entry_price, 54000_0000000);
}

#[test]
fn test_liquidity_removal() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let lp = Address::generate(&env);

    let (token, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&lp, &10000_0000000);

    let client = setup(&env);
    let oracle_id = setup_oracle(&env);

    client.init(&admin, &token.address, &oracle_id);
    client.add_supported_token(&admin, &token.address, &Symbol::new(&env, "USDC"));
    set_dummy_price(&env, &oracle_id, "USDC", 10_000000);

    let minted = client.add_liquidity(&lp, &token.address, &5000_0000000);
    assert!(minted > 0);

    let returned = client.remove_liquidity(&lp, &token.address, &minted);
    assert_eq!(returned, 5000_0000000);
}

#[test]
fn test_oracle_unit() {
    let env = Env::default();
    let oracle_id = setup_oracle(&env);
    set_dummy_price(&env, &oracle_id, "BTC", 65000_0000000);

    let price: i128 = env.invoke_contract(
        &oracle_id,
        &Symbol::new(&env, "get_price"),
        vec![&env, Symbol::new(&env, "BTC").into_val(&env)]
    );
    assert_eq!(price, 65000_0000000);
}
