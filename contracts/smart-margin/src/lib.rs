#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, vec, Address, Env, Symbol, IntoVal};

#[contracttype]
#[derive(Clone)]
pub struct Position {
    pub margin: i128,         
    pub leverage: u32,        
    pub entry_price: i128,    
    pub is_long: bool,        
    pub take_profit: i128,          // 0 means not set
    pub stop_loss: i128,            // 0 means not set
    pub funding_index_at_entry: i128, // Snapshotted at entry
}

#[contracttype]
pub enum DataKey {
    Admin,
    UsdcToken,
    OracleAddress,
    Position(Address),
    TotalShares,
    TotalPoolUsdc,
    LpBalance(Address),
    GlobalFundingRate, // Simplistic representation for workshop demo
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
    InsufficientLiquidity = 7,
    InsufficientShares = 8,
    OrderNotTriggered = 9,
}

#[contract]
pub struct SmartMarginContract;

#[contractimpl]
impl SmartMarginContract {
    pub fn init(env: Env, admin: Address, usdc_token: Address, oracle_address: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::OracleAddress, &oracle_address);
        
        env.storage().instance().set(&DataKey::TotalShares, &0i128);
        env.storage().instance().set(&DataKey::TotalPoolUsdc, &0i128);
        env.storage().instance().set(&DataKey::GlobalFundingRate, &0i128);
        Ok(())
    }

    /// Admin can manually adjust the mock funding rate for demo purposes
    pub fn set_funding_rate(env: Env, admin: Address, rate: i128) -> Result<(), Error> {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }
        env.storage().instance().set(&DataKey::GlobalFundingRate, &rate);
        Ok(())
    }

    pub fn get_funding_rate(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::GlobalFundingRate).unwrap_or(0)
    }

    pub fn add_liquidity(env: Env, lp: Address, amount: i128) -> Result<i128, Error> {
        lp.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidMargin);
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).ok_or(Error::NotInitialized)?;
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&lp, &env.current_contract_address(), &amount);

        let mut total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let mut total_usdc: i128 = env.storage().instance().get(&DataKey::TotalPoolUsdc).unwrap_or(0);

        let shares_to_mint = if total_shares == 0 || total_usdc == 0 {
            amount
        } else {
            (amount * total_shares) / total_usdc
        };

        total_shares += shares_to_mint;
        total_usdc += amount;

        env.storage().instance().set(&DataKey::TotalShares, &total_shares);
        env.storage().instance().set(&DataKey::TotalPoolUsdc, &total_usdc);

        let mut lp_bal: i128 = env.storage().persistent().get(&DataKey::LpBalance(lp.clone())).unwrap_or(0);
        lp_bal += shares_to_mint;
        env.storage().persistent().set(&DataKey::LpBalance(lp), &lp_bal);

        Ok(shares_to_mint)
    }

    pub fn remove_liquidity(env: Env, lp: Address, shares: i128) -> Result<i128, Error> {
        lp.require_auth();
        if shares <= 0 {
            return Err(Error::InvalidMargin);
        }

        let mut lp_bal: i128 = env.storage().persistent().get(&DataKey::LpBalance(lp.clone())).unwrap_or(0);
        if lp_bal < shares {
            return Err(Error::InsufficientShares);
        }

        let mut total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let mut total_usdc: i128 = env.storage().instance().get(&DataKey::TotalPoolUsdc).unwrap_or(0);

        let usdc_to_return = (shares * total_usdc) / total_shares;

        total_shares -= shares;
        total_usdc -= usdc_to_return;
        lp_bal -= shares;

        env.storage().instance().set(&DataKey::TotalShares, &total_shares);
        env.storage().instance().set(&DataKey::TotalPoolUsdc, &total_usdc);
        env.storage().persistent().set(&DataKey::LpBalance(lp.clone()), &lp_bal);

        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &lp, &usdc_to_return);

        Ok(usdc_to_return)
    }

    fn fetch_price(env: &Env) -> i128 {
        let oracle_addr: Address = env.storage().instance().get(&DataKey::OracleAddress).unwrap();
        env.invoke_contract(
            &oracle_addr,
            &Symbol::new(env, "get_price"),
            vec![env, Symbol::new(env, "BTC").into_val(env)]
        )
    }

    pub fn open_position(env: Env, user: Address, margin: i128, leverage: u32, is_long: bool, take_profit: i128, stop_loss: i128) -> Result<(), Error> {
        user.require_auth();
        
        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).ok_or(Error::NotInitialized)?;
        let entry_price = Self::fetch_price(&env);
        let current_funding = Self::get_funding_rate(env.clone());
        
        if margin <= 0 || leverage < 1 {
            return Err(Error::InvalidMargin);
        }

        if env.storage().persistent().has(&DataKey::Position(user.clone())) {
            return Err(Error::PositionAlreadyExists);
        }

        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&user, &env.current_contract_address(), &margin);

        let position = Position {
            margin,
            leverage,
            entry_price,
            is_long,
            take_profit,
            stop_loss,
            funding_index_at_entry: current_funding,
        };

        env.storage().persistent().set(&DataKey::Position(user), &position);
        Ok(())
    }

    pub fn close_position(env: Env, user: Address) -> Result<i128, Error> {
        let position: Position = env.storage().persistent().get(&DataKey::Position(user.clone())).ok_or(Error::NoPosition)?;
        let current_price = Self::fetch_price(&env);
        let current_funding = Self::get_funding_rate(env.clone());
        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).ok_or(Error::NotInitialized)?;
        
        // PnL from Price Action
        let price_diff = if position.is_long {
            current_price - position.entry_price
        } else {
            position.entry_price - current_price
        };
        let pnl = (price_diff * position.margin * (position.leverage as i128)) / position.entry_price;
        
        // PnL from Funding Rates (Simple logic for demo: Longs pay shorts when positive)
        let funding_diff = current_funding - position.funding_index_at_entry;
        let funding_pnl = if position.is_long {
            -funding_diff // Longs lose money when rate goes up
        } else {
            funding_diff  // Shorts make money when rate goes up
        };

        // Total Payout
        let mut final_pnl = pnl + funding_pnl;
        let mut payout = position.margin + final_pnl;

        if payout < 0 {
            // Liquidated. Payout is 0, user loses entire margin.
            payout = 0;
            final_pnl = -position.margin;
        }

        let mut total_usdc: i128 = env.storage().instance().get(&DataKey::TotalPoolUsdc).unwrap_or(0);
        total_usdc -= final_pnl; 
        
        if total_usdc < 0 {
            payout = position.margin + (total_usdc + final_pnl); 
            total_usdc = 0;
        }

        env.storage().instance().set(&DataKey::TotalPoolUsdc, &total_usdc);
        env.storage().persistent().remove(&DataKey::Position(user.clone()));

        if payout > 0 {
            let token_client = token::Client::new(&env, &token_addr);
            token_client.transfer(&env.current_contract_address(), &user, &payout);
        }

        Ok(payout)
    }

    /// Keepers call this to automatically trigger a user's Stop Loss or Take Profit
    pub fn trigger_orders(env: Env, user: Address) -> Result<i128, Error> {
        let position: Position = env.storage().persistent().get(&DataKey::Position(user.clone())).ok_or(Error::NoPosition)?;
        let current_price = Self::fetch_price(&env);
        
        let mut should_trigger = false;
        
        if position.is_long {
            if position.take_profit > 0 && current_price >= position.take_profit { should_trigger = true; }
            if position.stop_loss > 0 && current_price <= position.stop_loss { should_trigger = true; }
        } else {
            if position.take_profit > 0 && current_price <= position.take_profit { should_trigger = true; }
            if position.stop_loss > 0 && current_price >= position.stop_loss { should_trigger = true; }
        }

        if should_trigger {
            return Self::close_position(env, user);
        }
        
        Err(Error::OrderNotTriggered)
    }

    pub fn get_position(env: Env, user: Address) -> Result<Position, Error> {
        env.storage().persistent().get(&DataKey::Position(user)).ok_or(Error::NoPosition)
    }
}

mod test;
