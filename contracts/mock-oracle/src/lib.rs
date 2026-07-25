#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
pub enum DataKey {
    Admin,
    Price(Symbol), // Asset symbol (e.g. BTC) -> Price
}

#[contract]
pub struct MockOracleContract;

#[contractimpl]
impl MockOracleContract {
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_price(env: Env, admin: Address, symbol: Symbol, price: i128) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != stored_admin {
            panic!("unauthorized");
        }
        env.storage().instance().set(&DataKey::Price(symbol), &price);
    }

    pub fn get_price(env: Env, symbol: Symbol) -> i128 {
        env.storage().instance().get(&DataKey::Price(symbol)).unwrap_or(0)
    }
}
