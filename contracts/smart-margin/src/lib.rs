#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, vec, Address, Env, Symbol, IntoVal};

#[contracttype]
#[derive(Clone)]
pub struct Position {
    pub margin: i128,         
    pub leverage: u32,        
    pub entry_price: i128,    
    pub is_long: bool,        
    pub take_profit: i128,          
    pub stop_loss: i128,            
    pub funding_index_at_entry: i128, 
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
    GlobalFundingRate,
    TotalLongOI,
    TotalShortOI,
    LastFundingTime,
    TotalVolume,
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
    ExcessiveLeverage = 10,
    ZeroSharesMinted = 11,
    OracleError = 12,
    InvalidOrder = 13,
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
        env.storage().instance().set(&DataKey::TotalLongOI, &0i128);
        env.storage().instance().set(&DataKey::TotalShortOI, &0i128);
        env.storage().instance().set(&DataKey::LastFundingTime, &env.ledger().timestamp());
        env.storage().instance().set(&DataKey::TotalVolume, &0i128);
        Ok(())
    }

    /// Dynamic Skew-Math Engine
    /// Accumulates funding interest based on the imbalance between Longs and Shorts
    fn update_funding(env: &Env) {
        let current_time = env.ledger().timestamp();
        let last_time: u64 = env.storage().instance().get(&DataKey::LastFundingTime).unwrap_or(current_time);
        
        if current_time > last_time {
            let time_elapsed = (current_time - last_time) as i128;
            let total_long: i128 = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
            let total_short: i128 = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
            
            // Skew is positive if Longs > Shorts. 
            let skew = total_long - total_short;
            
            // Divide by 10_000 for the demo so numbers don't blow up too fast
            let funding_for_period = (skew * time_elapsed) / 10_000;
            
            let mut global_funding: i128 = env.storage().instance().get(&DataKey::GlobalFundingRate).unwrap_or(0);
            global_funding += funding_for_period;
            
            env.storage().instance().set(&DataKey::GlobalFundingRate, &global_funding);
        }
        
        env.storage().instance().set(&DataKey::LastFundingTime, &current_time);
    }

    pub fn get_market_state(env: Env) -> (i128, i128, i128, i128) {
        let long_oi = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
        let short_oi = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
        let global_funding = env.storage().instance().get(&DataKey::GlobalFundingRate).unwrap_or(0);
        let total_volume = env.storage().instance().get(&DataKey::TotalVolume).unwrap_or(0);
        (long_oi, short_oi, global_funding, total_volume)
    }

    pub fn get_pool_state(env: Env, user: Address) -> (i128, i128, i128) {
        let total_pool = env.storage().instance().get(&DataKey::TotalPoolUsdc).unwrap_or(0);
        let total_shares = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let user_shares = env.storage().persistent().get(&DataKey::LpBalance(user)).unwrap_or(0);
        (total_pool, total_shares, user_shares)
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

        // Protect against inflation attack: never mint 0 shares
        if shares_to_mint <= 0 {
            return Err(Error::ZeroSharesMinted);
        }

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
        let payout = usdc_to_return;

        // LP Lockup: Remaining Pool USDC must be >= Total OI / 5
        let total_long_oi: i128 = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
        let total_short_oi: i128 = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
        let total_oi = total_long_oi + total_short_oi;
        
        let remaining_usdc = total_usdc - payout;
        if total_oi > remaining_usdc * 5 {
            return Err(Error::InsufficientLiquidity); // Cannot withdraw, liquidity is backing active trades
        }

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

    fn fetch_price(env: &Env) -> Result<i128, Error> {
        let oracle_addr: Address = env.storage().instance().get(&DataKey::OracleAddress).ok_or(Error::NotInitialized)?;
        let price: i128 = env.invoke_contract(
            &oracle_addr,
            &Symbol::new(env, "get_price"),
            vec![env, Symbol::new(env, "BTC").into_val(env)]
        );
        if price <= 0 {
            return Err(Error::OracleError);
        }
        Ok(price)
    }

    pub fn open_position(env: Env, user: Address, margin: i128, leverage: u32, is_long: bool, take_profit: i128, stop_loss: i128) -> Result<(), Error> {
        user.require_auth();
        
        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).ok_or(Error::NotInitialized)?;
        let entry_price = Self::fetch_price(&env)?;
        
        if margin <= 0 || leverage < 1 {
            return Err(Error::InvalidMargin);
        }
        if leverage > 50 {
            return Err(Error::ExcessiveLeverage);
        }
        if is_long {
            if take_profit > 0 && take_profit <= entry_price { return Err(Error::InvalidOrder); }
            if stop_loss > 0 && stop_loss >= entry_price { return Err(Error::InvalidOrder); }
        } else {
            if take_profit > 0 && take_profit >= entry_price { return Err(Error::InvalidOrder); }
            if stop_loss > 0 && stop_loss <= entry_price { return Err(Error::InvalidOrder); }
        }
        if env.storage().persistent().has(&DataKey::Position(user.clone())) {
            return Err(Error::PositionAlreadyExists);
        }

        let position_size = margin * (leverage as i128);

        // Max OI Cap: Total OI + new position cannot exceed 5x Total Pool USDC
        let total_usdc: i128 = env.storage().instance().get(&DataKey::TotalPoolUsdc).unwrap_or(0);
        let total_long_oi: i128 = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
        let total_short_oi: i128 = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
        
        let total_oi = total_long_oi + total_short_oi + position_size;
        if total_oi > total_usdc * 5 {
            return Err(Error::InsufficientLiquidity);
        }

        Self::update_funding(&env);
        let current_funding = env.storage().instance().get(&DataKey::GlobalFundingRate).unwrap_or(0);

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

        let mut total_volume: i128 = env.storage().instance().get(&DataKey::TotalVolume).unwrap_or(0);
        total_volume += position_size;
        env.storage().instance().set(&DataKey::TotalVolume, &total_volume);

        if is_long {
            let mut total_long: i128 = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
            total_long += position_size;
            env.storage().instance().set(&DataKey::TotalLongOI, &total_long);
        } else {
            let mut total_short: i128 = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
            total_short += position_size;
            env.storage().instance().set(&DataKey::TotalShortOI, &total_short);
        }

        Ok(())
    }

    pub fn close_position(env: Env, user: Address) -> Result<i128, Error> {
        user.require_auth();
        let position: Position = env.storage().persistent().get(&DataKey::Position(user.clone())).ok_or(Error::NoPosition)?;
        let current_price = Self::fetch_price(&env)?;
        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).ok_or(Error::NotInitialized)?;
        
        Self::update_funding(&env);
        let current_funding = env.storage().instance().get(&DataKey::GlobalFundingRate).unwrap_or(0);
        
        // PnL from Price Action
        let price_diff = if position.is_long {
            current_price - position.entry_price
        } else {
            position.entry_price - current_price
        };
        let pnl = (price_diff * position.margin * (position.leverage as i128)) / position.entry_price;
        
        // PnL from Funding Rates (scaled by position size)
        let position_size = position.margin * (position.leverage as i128);
        let funding_diff = current_funding - position.funding_index_at_entry;
        let funding_pnl = if position.is_long {
            -(funding_diff * position_size) / 10_000_000_000 // Longs pay when rate goes up
        } else {
            (funding_diff * position_size) / 10_000_000_000  // Shorts earn when rate goes up
        };

        // Total Payout
        let mut final_pnl = pnl + funding_pnl;
        let mut payout = position.margin + final_pnl;

        if payout < 0 {
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

        // Remove from Open Interest
        let position_size = position.margin * (position.leverage as i128);
        if position.is_long {
            let mut total_long: i128 = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
            total_long -= position_size;
            env.storage().instance().set(&DataKey::TotalLongOI, &total_long);
        } else {
            let mut total_short: i128 = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
            total_short -= position_size;
            env.storage().instance().set(&DataKey::TotalShortOI, &total_short);
        }

        if payout > 0 {
            let token_client = token::Client::new(&env, &token_addr);
            token_client.transfer(&env.current_contract_address(), &user, &payout);
        }

        Ok(payout)
    }

    pub fn trigger_orders(env: Env, user: Address) -> Result<i128, Error> {
        let position: Position = env.storage().persistent().get(&DataKey::Position(user.clone())).ok_or(Error::NoPosition)?;
        let current_price = Self::fetch_price(&env)?;
        
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
