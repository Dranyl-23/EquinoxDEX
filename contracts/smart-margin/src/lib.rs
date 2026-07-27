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
    pub trailing_stop_distance: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct Order {
    pub margin: i128,
    pub leverage: u32,
    pub is_long: bool,
    pub trigger_price: i128,
    pub take_profit: i128,
    pub stop_loss: i128,
    pub trailing_stop_distance: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LeaderboardEntry {
    pub user: Address,
    pub total_pnl: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    UsdcToken,
    OracleAddress,
    Position(Address),
    TotalShares,
    LpBalance(Address),
    GlobalFundingRate,
    TotalLongOI,
    TotalShortOI,
    LastFundingTime,
    TotalVolume,
    LimitOrders(Address),
    PoolBalance(Address), // token_address -> pool balance
    SupportedTokensArray, // Vec<Address>
    SupportedTokenSymbol(Address), // token_address -> Symbol
    UserTotalPnL(Address),
    GlobalLeaderboard,
    SessionKey(Address),
    MarginBalance(Address),
    InsuranceFundBalance,
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
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::OracleAddress, &oracle_address);
        
        env.storage().instance().set(&DataKey::TotalShares, &0i128);
        
        env.storage().instance().set(&DataKey::GlobalFundingRate, &0i128);
        env.storage().instance().set(&DataKey::TotalLongOI, &0i128);
        env.storage().instance().set(&DataKey::TotalShortOI, &0i128);
        env.storage().instance().set(&DataKey::LastFundingTime, &env.ledger().timestamp());
        env.storage().instance().set(&DataKey::TotalVolume, &0i128);
        
        let empty_tokens: soroban_sdk::Vec<Address> = soroban_sdk::Vec::new(&env);
        env.storage().instance().set(&DataKey::SupportedTokensArray, &empty_tokens);
        Ok(())
    }

    /// App-Level Auth Delegation (Session Keys)
    pub fn add_session_key(env: Env, user: Address, session_key: Address) {
        user.require_auth();
        env.storage().persistent().set(&DataKey::SessionKey(user.clone()), &session_key);
        env.storage().persistent().extend_ttl(&DataKey::SessionKey(user), 10_000, 100_000);
    }

    pub fn remove_session_key(env: Env, user: Address) {
        user.require_auth();
        env.storage().persistent().remove(&DataKey::SessionKey(user));
    }

    fn verify_caller(env: &Env, user: &Address, caller: &Address) -> Result<(), Error> {
        if user == caller {
            user.require_auth();
            Ok(())
        } else {
            let registered_key: Address = env.storage().persistent()
                .get(&DataKey::SessionKey(user.clone()))
                .ok_or(Error::Unauthorized)?;
            
            if caller == &registered_key {
                caller.require_auth();
                Ok(())
            } else {
                Err(Error::Unauthorized)
            }
        }
    }

    /// Internal Account Balances (Required for Session Keys to bypass token auth)
    pub fn deposit_margin(env: Env, user: Address, amount: i128) {
        user.require_auth();
        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        let mut bal: i128 = env.storage().persistent().get(&DataKey::MarginBalance(user.clone())).unwrap_or(0);
        bal += amount;
        env.storage().persistent().set(&DataKey::MarginBalance(user.clone()), &bal);
        env.storage().persistent().extend_ttl(&DataKey::MarginBalance(user), 10_000, 100_000);
    }

    pub fn withdraw_margin(env: Env, _caller: Address, user: Address, amount: i128) -> Result<(), Error> {
        user.require_auth(); // H4 FIX: Require direct user auth; session keys cannot withdraw funds!
        let bal: i128 = env.storage().persistent().get(&DataKey::MarginBalance(user.clone())).unwrap_or(0);
        if bal < amount {
            return Err(Error::InvalidMargin);
        }

        // C1 FIX: Calculate reserved margin from open position
        let reserved_margin: i128 = env.storage().persistent()
            .get(&DataKey::Position(user.clone()))
            .map(|p: Position| p.margin)
            .unwrap_or(0);
        
        let available = bal - reserved_margin;
        if amount > available {
            return Err(Error::InvalidMargin); // Cannot withdraw margin backing an open position
        }

        let new_bal = bal - amount;
        env.storage().persistent().set(&DataKey::MarginBalance(user.clone()), &new_bal);
        env.storage().persistent().extend_ttl(&DataKey::MarginBalance(user.clone()), 10_000, 100_000);

        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &user, &amount);
        Ok(())
    }

    pub fn get_margin_balance(env: Env, user: Address) -> i128 {
        if env.storage().persistent().has(&DataKey::MarginBalance(user.clone())) {
            env.storage().persistent().extend_ttl(&DataKey::MarginBalance(user.clone()), 10_000, 100_000);
        }
        env.storage().persistent().get(&DataKey::MarginBalance(user)).unwrap_or(0)
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
        let total_pool = Self::get_aum(&env);
        let total_shares = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let user_shares = env.storage().persistent().get(&DataKey::LpBalance(user)).unwrap_or(0);
        (total_pool, total_shares, user_shares)
    }

    pub fn update_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), Error> {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        Ok(())
    }

    pub fn update_oracle(env: Env, admin: Address, new_oracle: Address) -> Result<(), Error> {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::OracleAddress, &new_oracle);
        Ok(())
    }

    pub fn add_supported_token(env: Env, admin: Address, token: Address, symbol: Symbol) -> Result<(), Error> {
        let stored_admin: Address = env.storage().instance().get(&DataKey::Admin).ok_or(Error::NotInitialized)?;
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        
        env.storage().instance().set(&DataKey::SupportedTokenSymbol(token.clone()), &symbol);
        
        let mut tokens: soroban_sdk::Vec<Address> = env.storage().instance().get(&DataKey::SupportedTokensArray).unwrap_or(soroban_sdk::Vec::new(&env));
        if !tokens.contains(&token) {
            tokens.push_back(token);
            env.storage().instance().set(&DataKey::SupportedTokensArray, &tokens);
        }
        Ok(())
    }

    pub fn get_aum(env: &Env) -> i128 {
        let tokens: soroban_sdk::Vec<Address> = env.storage().instance().get(&DataKey::SupportedTokensArray).unwrap_or(soroban_sdk::Vec::new(env));
        let mut total_aum = 0;
        
        let oracle_addr: Address = env.storage().instance().get(&DataKey::OracleAddress).unwrap();
        
        for token in tokens.iter() {
            let balance: i128 = env.storage().instance().get(&DataKey::PoolBalance(token.clone())).unwrap_or(0);
            if balance > 0 {
                let symbol: Symbol = env.storage().instance().get(&DataKey::SupportedTokenSymbol(token.clone())).unwrap();
                let price: i128 = env.invoke_contract(
                    &oracle_addr,
                    &Symbol::new(env, "get_price"),
                    soroban_sdk::vec![env, symbol.into_val(env)]
                );
                // balance and price both scaled by 10^7. So (balance * price) / 10^7
                total_aum += (balance * price) / 10_000_000;
            }
        }
        total_aum
    }

    pub fn get_funding_rate(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::GlobalFundingRate).unwrap_or(0)
    }

    pub fn add_liquidity(env: Env, lp: Address, token_address: Address, amount: i128) -> Result<i128, Error> {
        lp.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidMargin);
        }

        // Verify token is supported
        let tokens: soroban_sdk::Vec<Address> = env.storage().instance().get(&DataKey::SupportedTokensArray).unwrap_or(soroban_sdk::Vec::new(&env));
        if !tokens.contains(&token_address) {
            return Err(Error::Unauthorized); // Or InvalidOrder
        }

        // Transfer token to pool
        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&lp, &env.current_contract_address(), &amount);

        // Get oracle price to calculate deposit USD value
        let oracle_addr: Address = env.storage().instance().get(&DataKey::OracleAddress).unwrap();
        let symbol: Symbol = env.storage().instance().get(&DataKey::SupportedTokenSymbol(token_address.clone())).unwrap();
        let price: i128 = env.invoke_contract(
            &oracle_addr,
            &Symbol::new(&env, "get_price"),
            soroban_sdk::vec![&env, symbol.into_val(&env)]
        );
        
        let deposit_usd_value = (amount * price) / 10_000_000;

        let mut total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let total_usdc = Self::get_aum(&env); // This represents the total AUM

        let shares_to_mint = if total_shares == 0 || total_usdc == 0 {
            deposit_usd_value
        } else {
            (deposit_usd_value * total_shares) / total_usdc
        };

        if shares_to_mint <= 0 {
            return Err(Error::ZeroSharesMinted);
        }

        total_shares += shares_to_mint;
        env.storage().instance().set(&DataKey::TotalShares, &total_shares);

        let mut lp_bal: i128 = env.storage().persistent().get(&DataKey::LpBalance(lp.clone())).unwrap_or(0);
        lp_bal += shares_to_mint;
        env.storage().persistent().set(&DataKey::LpBalance(lp), &lp_bal);

        let mut pool_bal: i128 = env.storage().instance().get(&DataKey::PoolBalance(token_address.clone())).unwrap_or(0);
        pool_bal += amount;
        env.storage().instance().set(&DataKey::PoolBalance(token_address), &pool_bal);

        Ok(shares_to_mint)
    }

    pub fn remove_liquidity(env: Env, lp: Address, token_address: Address, shares: i128) -> Result<i128, Error> {
        lp.require_auth();
        if shares <= 0 {
            return Err(Error::InvalidMargin);
        }

        let mut lp_bal: i128 = env.storage().persistent().get(&DataKey::LpBalance(lp.clone())).unwrap_or(0);
        if lp_bal < shares {
            return Err(Error::InsufficientShares);
        }

        let mut total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let total_aum = Self::get_aum(&env);
        if total_shares <= 0 || total_aum <= 0 {
            return Err(Error::ZeroSharesMinted);
        }

        let usd_value_to_return = (shares * total_aum) / total_shares;
        
        let oracle_addr: Address = env.storage().instance().get(&DataKey::OracleAddress).unwrap();
        let symbol: Symbol = env.storage().instance().get(&DataKey::SupportedTokenSymbol(token_address.clone())).unwrap();
        let price: i128 = env.invoke_contract(
            &oracle_addr,
            &Symbol::new(&env, "get_price"),
            soroban_sdk::vec![&env, symbol.into_val(&env)]
        );
        
        if price <= 0 {
            return Err(Error::InvalidMargin);
        }
        
        let tokens_to_return = (usd_value_to_return * 10_000_000) / price;

        let mut pool_bal: i128 = env.storage().instance().get(&DataKey::PoolBalance(token_address.clone())).unwrap_or(0);
        if tokens_to_return > pool_bal {
            return Err(Error::InsufficientLiquidity);
        }

        // LP Lockup check based on total AUM
        let total_long_oi: i128 = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
        let total_short_oi: i128 = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
        let total_oi = total_long_oi + total_short_oi;
        
        let remaining_aum = total_aum - usd_value_to_return;
        if total_oi > remaining_aum * 5 {
            return Err(Error::InsufficientLiquidity); 
        }

        total_shares -= shares;
        lp_bal -= shares;
        pool_bal -= tokens_to_return;

        env.storage().instance().set(&DataKey::TotalShares, &total_shares);
        env.storage().persistent().set(&DataKey::LpBalance(lp.clone()), &lp_bal);
        env.storage().instance().set(&DataKey::PoolBalance(token_address.clone()), &pool_bal);

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &lp, &tokens_to_return);

        Ok(tokens_to_return)
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

    pub fn open_position(env: Env, caller: Address, user: Address, margin: i128, leverage: u32, is_long: bool, take_profit: i128, stop_loss: i128, trailing_stop_distance: i128) -> Result<(), Error> {
        Self::verify_caller(&env, &user, &caller)?;
        
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
        let open_fee = position_size / 1000; // 0.1% fee
        
        // Max OI Cap: Total OI + new position cannot exceed 5x Total Pool AUM
        let total_aum = Self::get_aum(&env);
        let total_long_oi: i128 = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
        let total_short_oi: i128 = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
        
        let total_oi = total_long_oi + total_short_oi + position_size;
        if total_oi > total_aum * 5 {
            return Err(Error::InsufficientLiquidity);
        }

        Self::update_funding(&env);
        let current_funding = env.storage().instance().get(&DataKey::GlobalFundingRate).unwrap_or(0);

        let mut bal: i128 = env.storage().persistent().get(&DataKey::MarginBalance(user.clone())).unwrap_or(0);
        // BUG FIX C4: Check margin + open_fee to prevent under-collateralization
        if bal < margin + open_fee {
            return Err(Error::InvalidMargin);
        }
        
        // In Cross-Margin, we do NOT lock the margin. We only deduct the opening fee.
        bal -= open_fee;
        env.storage().persistent().set(&DataKey::MarginBalance(user.clone()), &bal);
        env.storage().persistent().extend_ttl(&DataKey::MarginBalance(user.clone()), 10_000, 100_000);

        // Task #11: 10% of opening fee goes to Insurance Fund for bad debt socialization
        let insurance_cut = open_fee / 10;
        let pool_cut = open_fee - insurance_cut;

        let mut pool_bal: i128 = env.storage().instance().get(&DataKey::PoolBalance(token_addr.clone())).unwrap_or(0);
        pool_bal += pool_cut;
        env.storage().instance().set(&DataKey::PoolBalance(token_addr.clone()), &pool_bal);

        let mut ins_bal: i128 = env.storage().instance().get(&DataKey::InsuranceFundBalance).unwrap_or(0);
        ins_bal += insurance_cut;
        env.storage().instance().set(&DataKey::InsuranceFundBalance, &ins_bal);

        let position = Position {
            margin, // Conceptually the "initial margin required"
            leverage,
            entry_price,
            is_long,
            take_profit,
            stop_loss,
            funding_index_at_entry: current_funding,
            trailing_stop_distance,
        };
        env.storage().persistent().set(&DataKey::Position(user.clone()), &position);
        env.storage().persistent().extend_ttl(&DataKey::Position(user.clone()), 10_000, 100_000);

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

        // Task #7: Emits pos_open event
        env.events().publish((Symbol::new(&env, "pos_open"), user), (margin, leverage, is_long, entry_price));

        Ok(())
    }

    pub fn place_limit_order(env: Env, caller: Address, user: Address, margin: i128, leverage: u32, is_long: bool, trigger_price: i128, take_profit: i128, stop_loss: i128, trailing_stop_distance: i128) -> Result<(), Error> {
        Self::verify_caller(&env, &user, &caller)?;
        if margin <= 0 || leverage < 1 {
            return Err(Error::InvalidMargin);
        }
        
        let bal: i128 = env.storage().persistent().get(&DataKey::MarginBalance(user.clone())).unwrap_or(0);
        if bal < margin {
            return Err(Error::InvalidMargin);
        }
        // Do not deduct for limit order, it will be checked upon execution.

        let order = Order {
            margin,
            leverage,
            is_long,
            trigger_price,
            take_profit,
            stop_loss,
            trailing_stop_distance,
        };

        let mut orders: soroban_sdk::Vec<Order> = env.storage().persistent().get(&DataKey::LimitOrders(user.clone())).unwrap_or(soroban_sdk::Vec::new(&env));
        orders.push_back(order);
        env.storage().persistent().set(&DataKey::LimitOrders(user.clone()), &orders);
        env.storage().persistent().extend_ttl(&DataKey::LimitOrders(user.clone()), 10_000, 100_000);
        
        // Event #7: OrderPlaced
        env.events().publish((Symbol::new(&env, "order_place"), user), (trigger_price, is_long, margin, leverage));
        
        Ok(())
    }

    pub fn cancel_limit_order(env: Env, caller: Address, user: Address, index: u32) -> Result<(), Error> {
        Self::verify_caller(&env, &user, &caller)?;
        let mut orders: soroban_sdk::Vec<Order> = env.storage().persistent().get(&DataKey::LimitOrders(user.clone())).unwrap_or(soroban_sdk::Vec::new(&env));
        if (index as u32) >= orders.len() {
            return Err(Error::InvalidMargin);
        }
        orders.remove(index);
        env.storage().persistent().set(&DataKey::LimitOrders(user.clone()), &orders);
        env.storage().persistent().extend_ttl(&DataKey::LimitOrders(user.clone()), 10_000, 100_000);
        
        // Event #7: OrderCancelled
        env.events().publish((Symbol::new(&env, "order_cancel"), user), index);
        Ok(())
    }

    pub fn execute_limit_orders(env: Env, user: Address) -> Result<u32, Error> {
        let orders: soroban_sdk::Vec<Order> = env.storage().persistent().get(&DataKey::LimitOrders(user.clone())).unwrap_or(soroban_sdk::Vec::new(&env));
        if orders.is_empty() {
            return Ok(0);
        }
        
        let current_price = Self::fetch_price(&env)?;
        let mut executed_count = 0;
        let mut remaining_orders = soroban_sdk::Vec::new(&env);
        
        for order in orders.iter() {
            let mut triggered = false;
            if order.is_long && current_price <= order.trigger_price {
                triggered = true;
            } else if !order.is_long && current_price >= order.trigger_price {
                triggered = true;
            }
            
            if triggered && !env.storage().persistent().has(&DataKey::Position(user.clone())) {
                // Execute by using the margin that was already locked during place_limit_order
                
                // This simulates the user calling open_position. In a real contract, user.require_auth() inside open_position 
                // would fail here because the keeper invoked it. To fix this for the demo without massive refactoring, 
                // we bypass auth for executed orders by duplicating the core logic.
                
                let position_size = order.margin * (order.leverage as i128);
                let open_fee = position_size / 1000; // 0.1% fee — consistent with open_position
                
                let total_aum = Self::get_aum(&env);
                let total_long_oi: i128 = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
                let total_short_oi: i128 = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
                
                let total_oi = total_long_oi + total_short_oi + position_size;
                if total_oi <= total_aum * 5 {
                    // BUG FIX C4: Check margin + open_fee (not just fee) to prevent under-collateralization
                    let mut user_bal: i128 = env.storage().persistent().get(&DataKey::MarginBalance(user.clone())).unwrap_or(0);
                    if user_bal < order.margin + open_fee {
                        remaining_orders.push_back(order); // Insufficient balance for margin + fee
                        continue;
                    }
                    user_bal -= open_fee;
                    env.storage().persistent().set(&DataKey::MarginBalance(user.clone()), &user_bal);

                    Self::update_funding(&env);
                    let current_funding = env.storage().instance().get(&DataKey::GlobalFundingRate).unwrap_or(0);
                    let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
                    
                    // Add fee to pool balance
                    let mut pool_bal: i128 = env.storage().instance().get(&DataKey::PoolBalance(token_addr.clone())).unwrap_or(0);
                    pool_bal += open_fee;
                    env.storage().instance().set(&DataKey::PoolBalance(token_addr.clone()), &pool_bal);
                    
                    let position = Position {
                        margin: order.margin, // Use full margin (fee comes from balance, not margin)
                        leverage: order.leverage,
                        entry_price: current_price,
                        is_long: order.is_long,
                        take_profit: order.take_profit,
                        stop_loss: order.stop_loss,
                        funding_index_at_entry: current_funding,
                        trailing_stop_distance: order.trailing_stop_distance,
                    };
                    env.storage().persistent().set(&DataKey::Position(user.clone()), &position);
                    
                    let mut total_volume: i128 = env.storage().instance().get(&DataKey::TotalVolume).unwrap_or(0);
                    total_volume += position_size;
                    env.storage().instance().set(&DataKey::TotalVolume, &total_volume);
                    
                    if order.is_long {
                        let mut total_long: i128 = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
                        total_long += position_size;
                        env.storage().instance().set(&DataKey::TotalLongOI, &total_long);
                    } else {
                        let mut total_short: i128 = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
                        total_short += position_size;
                        env.storage().instance().set(&DataKey::TotalShortOI, &total_short);
                    }
                    executed_count += 1;
                } else {
                    remaining_orders.push_back(order); // Failed to execute due to liquidity, keep it
                }
            } else {
                remaining_orders.push_back(order);
            }
        }
        
        env.storage().persistent().set(&DataKey::LimitOrders(user), &remaining_orders);
        Ok(executed_count)
    }

    pub fn update_trailing_stop(env: Env, user: Address) -> Result<(), Error> {
        let mut position: Position = env.storage().persistent().get(&DataKey::Position(user.clone())).ok_or(Error::NoPosition)?;
        if position.trailing_stop_distance <= 0 {
            return Ok(());
        }
        
        let current_price = Self::fetch_price(&env)?;
        let mut updated = false;
        
        if position.is_long {
            let new_sl = current_price - position.trailing_stop_distance;
            if new_sl > position.stop_loss {
                position.stop_loss = new_sl;
                updated = true;
            }
        } else {
            let new_sl = current_price + position.trailing_stop_distance;
            if new_sl < position.stop_loss || position.stop_loss == 0 {
                position.stop_loss = new_sl;
                updated = true;
            }
        }
        if updated {
            env.storage().persistent().set(&DataKey::Position(user), &position);
        }
        Ok(())
    }

    fn internal_close_position(env: &Env, user: &Address, margin_to_close: i128, keeper_opt: Option<&Address>) -> Result<i128, Error> {
        let position_opt: Option<Position> = env.storage().persistent().get(&DataKey::Position(user.clone()));
        if position_opt.is_none() {
            return Err(Error::NoPosition);
        }
        let position = position_opt.unwrap();
        let current_price = Self::fetch_price(env)?;

        let current_funding = env.storage().instance().get(&DataKey::GlobalFundingRate).unwrap_or(0);

        let mut actual_margin_to_close = margin_to_close;
        if actual_margin_to_close <= 0 || actual_margin_to_close > position.margin {
            actual_margin_to_close = position.margin;
        }

        // PnL from Price Action
        let price_diff = if position.is_long {
            current_price - position.entry_price
        } else {
            position.entry_price - current_price
        };
        let pnl = (price_diff * actual_margin_to_close * (position.leverage as i128)) / position.entry_price;
        
        // PnL from Funding Rates (scaled by position size)
        let position_size = actual_margin_to_close * (position.leverage as i128);
        let funding_diff = current_funding - position.funding_index_at_entry;
        let funding_pnl = if position.is_long {
            -(funding_diff * position_size) / 10_000_000_000
        } else {
            (funding_diff * position_size) / 10_000_000_000
        };

        let close_fee = position_size / 1000; // 0.1% closing fee (in USDC value)

        // Task #11: Insurance fund receives 10% of closing fee
        let ins_fee_cut = close_fee / 10;
        let pool_fee_cut = close_fee - ins_fee_cut;

        let trader_pnl = pnl + funding_pnl - close_fee;

        let token_addr: Address = env.storage().instance().get(&DataKey::UsdcToken).unwrap();
        let mut pool_bal: i128 = env.storage().instance().get(&DataKey::PoolBalance(token_addr.clone())).unwrap_or(0);
        let raw_pnl = pnl + funding_pnl;
        pool_bal -= raw_pnl;
        pool_bal += pool_fee_cut;

        let mut ins_bal: i128 = env.storage().instance().get(&DataKey::InsuranceFundBalance).unwrap_or(0);
        ins_bal += ins_fee_cut;

        let mut actual_trader_pnl = trader_pnl;
        if pool_bal < 0 {
            actual_trader_pnl += pool_bal;
            pool_bal = 0;
        }

        let mut bal: i128 = env.storage().persistent().get(&DataKey::MarginBalance(user.clone())).unwrap_or(0);
        let new_bal_raw = bal + actual_trader_pnl;
        
        // Task #11: Bad Debt Socialization — if equity < 0, cover deficit from Insurance Fund
        if new_bal_raw < 0 {
            let bad_debt = -new_bal_raw;
            if ins_bal >= bad_debt {
                ins_bal -= bad_debt;
            } else {
                let remaining_deficit = bad_debt - ins_bal;
                ins_bal = 0;
                if pool_bal >= remaining_deficit {
                    pool_bal -= remaining_deficit;
                } else {
                    pool_bal = 0;
                }
            }
            bal = 0;
        } else {
            bal = new_bal_raw;
        }

        // Task #9: Keeper Liquidation Bounty (1.5% of position margin paid to keeper)
        if let Some(keeper) = keeper_opt {
            if keeper != user {
                let keeper_reward = (position.margin * 15) / 1000;
                if bal >= keeper_reward {
                    bal -= keeper_reward;
                    let mut keeper_bal: i128 = env.storage().persistent().get(&DataKey::MarginBalance(keeper.clone())).unwrap_or(0);
                    keeper_bal += keeper_reward;
                    env.storage().persistent().set(&DataKey::MarginBalance(keeper.clone()), &keeper_bal);
                    env.storage().persistent().extend_ttl(&DataKey::MarginBalance(keeper.clone()), 10_000, 100_000);
                    
                    // Task #7: Emits liquidate event
                    env.events().publish((Symbol::new(env, "liquidate"), user.clone()), (keeper.clone(), keeper_reward));
                }
            }
        }

        env.storage().persistent().set(&DataKey::MarginBalance(user.clone()), &bal);
        env.storage().persistent().extend_ttl(&DataKey::MarginBalance(user.clone()), 10_000, 100_000);

        env.storage().instance().set(&DataKey::PoolBalance(token_addr.clone()), &pool_bal);
        env.storage().instance().set(&DataKey::InsuranceFundBalance, &ins_bal);
        
        if actual_margin_to_close == position.margin {
            env.storage().persistent().remove(&DataKey::Position(user.clone()));
        } else {
            let mut updated_pos = position.clone();
            updated_pos.margin -= actual_margin_to_close;
            env.storage().persistent().set(&DataKey::Position(user.clone()), &updated_pos);
            env.storage().persistent().extend_ttl(&DataKey::Position(user.clone()), 10_000, 100_000);
        }

        if position.is_long {
            let total_long: i128 = env.storage().instance().get(&DataKey::TotalLongOI).unwrap_or(0);
            let updated_long = total_long.saturating_sub(position_size);
            env.storage().instance().set(&DataKey::TotalLongOI, &updated_long);
        } else {
            let total_short: i128 = env.storage().instance().get(&DataKey::TotalShortOI).unwrap_or(0);
            let updated_short = total_short.saturating_sub(position_size);
            env.storage().instance().set(&DataKey::TotalShortOI, &updated_short);
        }

        let mut total_pnl: i128 = env.storage().persistent().get(&DataKey::UserTotalPnL(user.clone())).unwrap_or(0);
        total_pnl += actual_trader_pnl;
        env.storage().persistent().set(&DataKey::UserTotalPnL(user.clone()), &total_pnl);
        env.storage().persistent().extend_ttl(&DataKey::UserTotalPnL(user.clone()), 10_000, 100_000);
        
        if actual_trader_pnl != 0 {
            Self::update_leaderboard(env, user.clone(), total_pnl);
        }

        // Task #7: Emits pos_close event
        env.events().publish((Symbol::new(env, "pos_close"), user.clone()), (actual_margin_to_close, actual_trader_pnl));

        Ok(actual_trader_pnl)
    }

    pub fn close_position(env: Env, caller: Address, user: Address, margin_to_close: i128) -> Result<i128, Error> {
        Self::verify_caller(&env, &user, &caller)?;
        Self::internal_close_position(&env, &user, margin_to_close, None)
    }

    pub fn trigger_orders(env: Env, caller: Address, user: Address) -> Result<i128, Error> {
        let executed_limits = Self::execute_limit_orders(env.clone(), user.clone())?;
        
        let position_opt: Option<Position> = env.storage().persistent().get(&DataKey::Position(user.clone()));
        if position_opt.is_none() {
            if executed_limits > 0 {
                return Ok(executed_limits as i128);
            }
            return Err(Error::NoPosition);
        }
        let position = position_opt.unwrap();
        let current_price = Self::fetch_price(&env)?;
        
        let mut should_trigger = false;
        
        // 1. TP / SL Checks
        if position.is_long {
            if position.take_profit > 0 && current_price >= position.take_profit { should_trigger = true; }
            if position.stop_loss > 0 && current_price <= position.stop_loss { should_trigger = true; }
        } else {
            if position.take_profit > 0 && current_price <= position.take_profit { should_trigger = true; }
            if position.stop_loss > 0 && current_price >= position.stop_loss { should_trigger = true; }
        }

        // 2. Global Cross-Margin Liquidation Check
        if !should_trigger {
            let price_diff = if position.is_long {
                current_price - position.entry_price
            } else {
                position.entry_price - current_price
            };
            let pnl = (price_diff * position.margin * (position.leverage as i128)) / position.entry_price;
            
            let position_size = position.margin * (position.leverage as i128);
            
            Self::update_funding(&env);
            let current_funding = env.storage().instance().get(&DataKey::GlobalFundingRate).unwrap_or(0);
            let funding_diff = current_funding - position.funding_index_at_entry;
            let funding_pnl = if position.is_long {
                -(funding_diff * position_size) / 10_000_000_000
            } else {
                (funding_diff * position_size) / 10_000_000_000
            };

            let unrealized_pnl = pnl + funding_pnl;
            let bal: i128 = env.storage().persistent().get(&DataKey::MarginBalance(user.clone())).unwrap_or(0);
            let account_equity = bal + unrealized_pnl;
            
            // Maintenance Margin = 2% of Position Size
            let maintenance_margin = position_size * 2 / 100;
            
            if account_equity < maintenance_margin {
                should_trigger = true;
            }
        }

        if should_trigger {
            caller.require_auth();
            return Self::internal_close_position(&env, &user, position.margin, Some(&caller));
        }
        
        if executed_limits > 0 {
            return Ok(executed_limits as i128);
        }

        Err(Error::OrderNotTriggered)
    }

    pub fn get_position(env: Env, user: Address) -> Result<Position, Error> {
        env.storage().persistent().get(&DataKey::Position(user)).ok_or(Error::NoPosition)
    }

    pub fn get_limit_orders(env: Env, user: Address) -> soroban_sdk::Vec<Order> {
        env.storage().persistent().get(&DataKey::LimitOrders(user)).unwrap_or(soroban_sdk::Vec::new(&env))
    }

    pub fn get_leaderboard(env: Env) -> soroban_sdk::Vec<LeaderboardEntry> {
        env.storage().persistent().get(&DataKey::GlobalLeaderboard).unwrap_or(soroban_sdk::Vec::new(&env))
    }

    pub fn get_user_pnl(env: Env, user: Address) -> i128 {
        env.storage().persistent().get(&DataKey::UserTotalPnL(user)).unwrap_or(0)
    }

    fn update_leaderboard(env: &Env, user: Address, total_pnl: i128) {
        let mut board: soroban_sdk::Vec<LeaderboardEntry> = env.storage().persistent().get(&DataKey::GlobalLeaderboard).unwrap_or(soroban_sdk::Vec::new(env));
        
        let mut user_idx = None;
        for i in 0..board.len() {
            if board.get(i).unwrap().user == user {
                user_idx = Some(i);
                break;
            }
        }
        if let Some(idx) = user_idx {
            board.remove(idx);
        }
        
        let mut insert_idx = board.len();
        for i in 0..board.len() {
            if total_pnl > board.get(i).unwrap().total_pnl {
                insert_idx = i;
                break;
            }
        }
        
        board.insert(insert_idx, LeaderboardEntry { user, total_pnl });
        
        if board.len() > 10 {
            board.pop_back();
        }
        
        env.storage().persistent().set(&DataKey::GlobalLeaderboard, &board);
        env.storage().persistent().extend_ttl(&DataKey::GlobalLeaderboard, 10_000, 100_000);
    }
}

mod test;
