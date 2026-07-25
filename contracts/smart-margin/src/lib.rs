#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env};

#[contracttype]
#[derive(Clone)]
pub struct Position {
    pub margin: i128,         // USDC deposited as collateral
    pub leverage: u32,        // e.g., 10x
    pub entry_price: i128,    // BTC price when opened
    pub is_long: bool,        // true = Long, false = Short
}

#[contracttype]
pub enum DataKey {
    Admin,
    UsdcToken,
    MockPrice,
    Position(Address), // User's Address -> Position
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    NoPosition = 4,
    PositionAlreadyExists = 5,
    InvalidMargin = 6,
}

#[contract]
pub struct SmartMarginContract;

#[contractimpl]
impl SmartMarginContract {
    /// Initialize the contract with the Admin address, USDC token address, and starting BTC price.
    pub fn init(env: Env, admin: Address, usdc_token: Address, initial_price: i128) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::MockPrice, &initial_price);
        Ok(())
    }

    /// Admin can update the current mock price of BTC.
    pub fn set_price(env: Env, admin: Address, new_price: i128) -> Result<(), Error> {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }
        env.storage().instance().set(&DataKey::MockPrice, &new_price);
        Ok(())
    }

    pub fn get_price(env: Env) -> Result<i128, Error> {
        env.storage().instance().get(&DataKey::MockPrice).ok_or(Error::NotInitialized)
    }

    /// Open a new leveraged position
    pub fn open_position(env: Env, user: Address, margin: i128, leverage: u32, is_long: bool) -> Result<(), Error> {
        user.require_auth();
        
        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).ok_or(Error::NotInitialized)?;
        let entry_price: i128 = env.storage().instance().get(&DataKey::MockPrice).ok_or(Error::NotInitialized)?;
        
        if margin <= 0 || leverage < 1 {
            return Err(Error::InvalidMargin);
        }

        if env.storage().persistent().has(&DataKey::Position(user.clone())) {
            return Err(Error::PositionAlreadyExists);
        }

        // Transfer USDC from user to contract (acts as the Margin Vault)
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&user, &env.current_contract_address(), &margin);

        let position = Position {
            margin,
            leverage,
            entry_price,
            is_long,
        };

        env.storage().persistent().set(&DataKey::Position(user), &position);
        
        Ok(())
    }

    /// Close an open position and calculate PnL. 
    pub fn close_position(env: Env, user: Address) -> Result<i128, Error> {
        // In a real app, only the user could close it unless bankrupt. 
        // For the workshop, we allow anyone to trigger it so we can easily demo liquidations.
        
        let position: Position = env.storage().persistent().get(&DataKey::Position(user.clone())).ok_or(Error::NoPosition)?;
        let current_price: i128 = env.storage().instance().get(&DataKey::MockPrice).ok_or(Error::NotInitialized)?;
        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).ok_or(Error::NotInitialized)?;
        
        // PnL calculation: price difference = current - entry (if long) or entry - current (if short)
        let price_diff = if position.is_long {
            current_price - position.entry_price
        } else {
            position.entry_price - current_price
        };
        
        // pnl = (price_diff * margin * leverage) / entry_price
        let pnl = (price_diff * position.margin * (position.leverage as i128)) / position.entry_price;
        
        let mut payout = position.margin + pnl;
        
        // If payout is less than 0, user is liquidated and gets nothing.
        if payout < 0 {
            payout = 0;
        }

        // Remove position from storage
        env.storage().persistent().remove(&DataKey::Position(user.clone()));

        // Return the payout to the user if they didn't get liquidated
        if payout > 0 {
            let token_client = token::Client::new(&env, &token_addr);
            token_client.transfer(&env.current_contract_address(), &user, &payout);
        }

        Ok(payout)
    }

    pub fn get_position(env: Env, user: Address) -> Result<Position, Error> {
        env.storage().persistent().get(&DataKey::Position(user)).ok_or(Error::NoPosition)
    }
}

mod test;
