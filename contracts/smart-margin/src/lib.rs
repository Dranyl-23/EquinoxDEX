#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, vec, Address, Env, Symbol, IntoVal};

#[contracttype]
#[derive(Clone)]
pub struct Position {
    pub margin: i128,         
    pub leverage: u32,        
    pub entry_price: i128,    
    pub is_long: bool,        
}

#[contracttype]
pub enum DataKey {
    Admin,
    UsdcToken,
    OracleAddress,
    Position(Address), // User -> Position
    TotalShares,
    TotalPoolUsdc,
    LpBalance(Address), // User -> LP Shares
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
        Ok(())
    }

    /// Add liquidity to the GLP-style pool
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

    /// Remove liquidity from the pool
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

    pub fn open_position(env: Env, user: Address, margin: i128, leverage: u32, is_long: bool) -> Result<(), Error> {
        user.require_auth();
        
        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).ok_or(Error::NotInitialized)?;
        let entry_price = Self::fetch_price(&env);
        
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
        };

        env.storage().persistent().set(&DataKey::Position(user), &position);
        Ok(())
    }

    pub fn close_position(env: Env, user: Address) -> Result<i128, Error> {
        let position: Position = env.storage().persistent().get(&DataKey::Position(user.clone())).ok_or(Error::NoPosition)?;
        let current_price = Self::fetch_price(&env);
        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).ok_or(Error::NotInitialized)?;
        
        let price_diff = if position.is_long {
            current_price - position.entry_price
        } else {
            position.entry_price - current_price
        };
        
        let pnl = (price_diff * position.margin * (position.leverage as i128)) / position.entry_price;
        
        let mut payout = position.margin + pnl;
        let mut final_pnl = pnl;

        if payout < 0 {
            // Liquidated. Payout is 0, user loses entire margin.
            payout = 0;
            final_pnl = -position.margin;
        }

        // The LP pool is the counterparty.
        // If user made profit (pnl > 0), pool loses that much.
        // If user lost money (pnl < 0), pool gains that much.
        let mut total_usdc: i128 = env.storage().instance().get(&DataKey::TotalPoolUsdc).unwrap_or(0);
        total_usdc -= final_pnl; 
        
        if total_usdc < 0 {
            // Extreme edge case: Protocol insolvency. The pool cannot cover the payout.
            // For MVP, we'll cap the payout to whatever the pool has left.
            // Payout = Margin + Pool's remaining balance
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

    pub fn get_position(env: Env, user: Address) -> Result<Position, Error> {
        env.storage().persistent().get(&DataKey::Position(user)).ok_or(Error::NoPosition)
    }
}

mod test;
