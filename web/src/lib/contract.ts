import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
  rpc,
  nativeToScVal,
  scValToNative,
  Address,
  Operation,
} from '@stellar/stellar-sdk';
import { server, NETWORK_PASSPHRASE, CONTRACT_ID } from './stellar';
import { DECIMALS } from './constants';

// A real, funded testnet account used ONLY as the source for read-only
// simulations. Nothing is signed or submitted for reads, so any existing
// account works — we reuse the Circle USDC issuer.
const READ_SOURCE = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export interface Position {
  id: number;
  symbol: string;
  margin: number;
  leverage: number;
  entry_price: number;
  is_long: boolean;
  take_profit: number;
  stop_loss: number;
  funding_index_at_entry: number;
  trailing_stop_distance: number;
}

export interface Order {
  margin: number;
  leverage: number;
  is_long: boolean;
  trigger_price: number;
  take_profit: number;
  stop_loss: number;
  trailing_stop_distance: number;
}

export function contractConfigured(): boolean {
  return Boolean(CONTRACT_ID);
}

/** Read global market state via simulation */
export async function readMarketState(): Promise<{ long_oi: number; short_oi: number; global_funding: number; total_volume: number }> {
  try {
    const contract = new Contract(CONTRACT_ID);
    const source = new Account(READ_SOURCE, '0');

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_market_state'))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      return { long_oi: 0, short_oi: 0, global_funding: 0, total_volume: 0 };
    }
    
    const res = scValToNative(sim.result.retval) as [bigint, bigint, bigint, bigint];
    return {
      long_oi: Number(res[0]),
      short_oi: Number(res[1]),
      global_funding: Number(res[2]),
      total_volume: Number(res[3])
    };
  } catch {
    return { long_oi: 0, short_oi: 0, global_funding: 0, total_volume: 0 };
  }
}

/** Read positions array via simulation — no wallet or signature required. */
export async function readPositions(userAddress: string): Promise<Position[]> {
  try {
    const contract = new Contract(CONTRACT_ID);
    const source = new Account(READ_SOURCE, '0');

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('get_positions', new Address(userAddress).toScVal())
      )
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      return [];
    }

    const rawList = scValToNative(sim.result.retval) as Array<{
      id: bigint;
      symbol: string;
      margin: bigint;
      leverage: number;
      entry_price: bigint;
      is_long: boolean;
      take_profit: bigint;
      stop_loss: bigint;
      funding_index_at_entry: bigint;
      trailing_stop_distance: bigint;
    }>;
    
    return rawList.map(pos => ({
      id: Number(pos.id),
      symbol: typeof pos.symbol === 'string' ? pos.symbol : 'BTCUSDT',
      margin: Number(pos.margin),
      leverage: pos.leverage,
      entry_price: Number(pos.entry_price),
      is_long: pos.is_long,
      take_profit: Number(pos.take_profit),
      stop_loss: Number(pos.stop_loss),
      funding_index_at_entry: Number(pos.funding_index_at_entry),
      trailing_stop_distance: Number(pos.trailing_stop_distance),
    }));
  } catch {
    return [];
  }
}

/** Read limit orders */
export async function readLimitOrders(userAddress: string): Promise<Order[]> {
  try {
    const contract = new Contract(CONTRACT_ID);
    const source = new Account(READ_SOURCE, '0');

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('get_limit_orders', new Address(userAddress).toScVal())
      )
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      return [];
    }

    const rawList = scValToNative(sim.result.retval) as Array<{
      margin: bigint;
      leverage: number;
      is_long: boolean;
      trigger_price: bigint;
      take_profit: bigint;
      stop_loss: bigint;
      trailing_stop_distance: bigint;
    }>;

    return rawList.map(obj => ({
      margin: Number(obj.margin),
      leverage: obj.leverage,
      is_long: obj.is_long,
      trigger_price: Number(obj.trigger_price),
      take_profit: Number(obj.take_profit),
      stop_loss: Number(obj.stop_loss),
      trailing_stop_distance: Number(obj.trailing_stop_distance),
    }));
  } catch {
    return [];
  }
}

/**
 * Build + simulate + assemble an unsigned `open_position` invocation.
 */
export async function buildOpenPositionXDR(
  caller: string,
  user: string,
  symbol: string,
  margin: number,
  leverage: number,
  isLong: boolean,
  takeProfit: number,
  stopLoss: number,
  trailingStopDistance: number = 0
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'open_position',
        new Address(caller).toScVal(),
        new Address(user).toScVal(),
        nativeToScVal(symbol, { type: 'symbol' }),
        nativeToScVal(BigInt(Math.trunc(margin)), { type: 'i128' }),
        nativeToScVal(leverage, { type: 'u32' }),
        nativeToScVal(isLong, { type: 'bool' }),
        nativeToScVal(BigInt(Math.trunc(takeProfit)), { type: 'i128' }),
        nativeToScVal(BigInt(Math.trunc(stopLoss)), { type: 'i128' }),
        nativeToScVal(BigInt(Math.trunc(trailingStopDistance)), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    console.error('Simulation failed', sim.error, sim.events);
    throw new Error('Simulation failed — Check testnet balance.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Build + simulate + assemble an unsigned `close_position` invocation.
 */
export async function buildClosePositionXDR(
  caller: string, 
  user: string, 
  positionId: number, 
  marginToClose: number = 0
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'close_position',
        new Address(caller).toScVal(),
        new Address(user).toScVal(),
        nativeToScVal(positionId, { type: 'u64' }),
        nativeToScVal(BigInt(Math.trunc(marginToClose)), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed to close position.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Keeper function: trigger orders
 */
export async function buildTriggerOrdersXDR(caller: string, targetUser: string): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call('trigger_orders', new Address(caller).toScVal(), new Address(targetUser).toScVal())
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Trigger orders simulation failed - TP/SL likely not hit yet.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Build + simulate + assemble an unsigned `place_limit_order` invocation.
 */
export async function buildPlaceLimitOrderXDR(
  caller: string,
  user: string,
  symbol: string,
  margin: number, // Scaled by 10^7
  leverage: number,
  isLong: boolean,
  triggerPrice: number, // Scaled by 10^7
  takeProfit: number, // Scaled by 10^7
  stopLoss: number,   // Scaled by 10^7
  trailingStopDistance: number = 0 // Scaled by 10^7
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'place_limit_order',
        new Address(caller).toScVal(),
        new Address(user).toScVal(),
        nativeToScVal(symbol, { type: 'symbol' }),
        nativeToScVal(BigInt(Math.trunc(margin)), { type: 'i128' }),
        nativeToScVal(leverage, { type: 'u32' }),
        nativeToScVal(isLong, { type: 'bool' }),
        nativeToScVal(BigInt(Math.trunc(triggerPrice)), { type: 'i128' }),
        nativeToScVal(BigInt(Math.trunc(takeProfit)), { type: 'i128' }),
        nativeToScVal(BigInt(Math.trunc(stopLoss)), { type: 'i128' }),
        nativeToScVal(BigInt(Math.trunc(trailingStopDistance)), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    console.error('Simulation failed', sim.error, sim.events);
    throw new Error('Simulation failed — Check testnet balance or if order already exists.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Build + simulate + assemble an unsigned `update_trailing_stop` invocation.
 */
export async function buildUpdateTrailingStopXDR(sender: string): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call('update_trailing_stop', new Address(sender).toScVal())
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Trailing stop update simulation failed - likely no valid stop loss increase.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Build + simulate + assemble an unsigned `modify_tpsl` invocation.
 */
export async function buildModifyTpSlXDR(
  caller: string,
  user: string,
  positionId: number,
  takeProfit: number,
  stopLoss: number,
  trailingStopDistance: number = 0
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'modify_tpsl',
        new Address(caller).toScVal(),
        new Address(user).toScVal(),
        nativeToScVal(positionId, { type: 'u64' }),
        nativeToScVal(BigInt(Math.trunc(takeProfit)), { type: 'i128' }),
        nativeToScVal(BigInt(Math.trunc(stopLoss)), { type: 'i128' }),
        nativeToScVal(BigInt(Math.trunc(trailingStopDistance)), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed to modify TP/SL.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Read the total pool state and the user's specific shares.
 */
export async function readPoolState(userAddress: string): Promise<{ totalPool: number; totalShares: number; userShares: number }> {
  try {
    const contract = new Contract(CONTRACT_ID);
    const source = new Account(READ_SOURCE, '0');

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('get_pool_state', new Address(userAddress).toScVal())
      )
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      return { totalPool: 0, totalShares: 0, userShares: 0 };
    }

    const res = scValToNative(sim.result.retval) as [bigint, bigint, bigint];
    return {
      totalPool: Number(res[0]),
      totalShares: Number(res[1]),
      userShares: Number(res[2]),
    };
  } catch {
    return { totalPool: 0, totalShares: 0, userShares: 0 };
  }
}

/**
 * Build + simulate + assemble an unsigned `add_liquidity` invocation.
 */
export async function buildAddLiquidityXDR(sender: string, tokenAddress: string, amountScaled: number): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'add_liquidity',
        new Address(sender).toScVal(),
        new Address(tokenAddress).toScVal(),
        nativeToScVal(BigInt(Math.trunc(amountScaled)), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed to add liquidity.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Build + simulate + assemble an unsigned `remove_liquidity` invocation.
 */
export async function buildRemoveLiquidityXDR(sender: string, tokenAddress: string, sharesScaled: number): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'remove_liquidity',
        new Address(sender).toScVal(),
        new Address(tokenAddress).toScVal(),
        nativeToScVal(BigInt(Math.trunc(sharesScaled)), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed to remove liquidity.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Build + simulate + assemble an unsigned `cancel_limit_order` invocation.
 */
export async function buildCancelLimitOrderXDR(caller: string, user: string, orderIndex: number): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'cancel_limit_order',
        new Address(caller).toScVal(),
        new Address(user).toScVal(),
        nativeToScVal(orderIndex, { type: 'u32' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed to cancel limit order.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

export interface LeaderboardEntry {
  user: string;
  total_pnl: number;
}

/** Read global leaderboard via simulation */
export async function readLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    if (!contractConfigured()) return [];
    const contract = new Contract(CONTRACT_ID);
    const source = new Account(READ_SOURCE, '0');

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_leaderboard'))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      return [];
    }
    
    const res = scValToNative(sim.result.retval) as { user: string; total_pnl: bigint }[];
    if (!res) return [];
    return res.map(r => ({
      user: r.user,
      total_pnl: Number(r.total_pnl)
    }));
  } catch {
    return [];
  }
}

/** Read user PnL via simulation */
export async function readUserPnL(userAddress: string): Promise<number> {
  try {
    if (!contractConfigured() || !userAddress) return 0;
    const contract = new Contract(CONTRACT_ID);
    const source = new Account(READ_SOURCE, '0');

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_user_pnl', new Address(userAddress).toScVal()))
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      return 0;
    }
    
    const res = scValToNative(sim.result.retval) as bigint;
    return Number(res);
  } catch {
    return 0;
  }
}
/**
 * Build + simulate + assemble an unsigned `deposit_margin` invocation.
 */
export async function buildDepositMarginXDR(sender: string, amount: number): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'deposit_margin',
        new Address(sender).toScVal(),
        nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed to deposit margin.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Build + simulate + assemble an unsigned `withdraw_margin` invocation.
 */
export async function buildWithdrawMarginXDR(caller: string, user: string, amount: number): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'withdraw_margin',
        new Address(caller).toScVal(),
        new Address(user).toScVal(),
        nativeToScVal(BigInt(Math.trunc(amount)), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed to withdraw margin.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Build a classic Stellar transaction to fund the session key account.
 * This is separate from the Soroban call because assembleTransaction
 * only handles Soroban operations, and createAccount will fail if
 * the account already exists.
 */
export async function buildFundSessionKeyXDR(sender: string, sessionKeyPublicKey: string): Promise<string> {
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.createAccount({
        destination: sessionKeyPublicKey,
        startingBalance: '2', // 2 XLM to cover gas fees for the session
      })
    )
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

/**
 * Build + simulate + assemble an unsigned `add_session_key` invocation.
 */
export async function buildAddSessionKeyXDR(sender: string, sessionKeyPublicKey: string): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'add_session_key',
        new Address(sender).toScVal(),
        new Address(sessionKeyPublicKey).toScVal()
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Simulation failed to add session key.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Read margin balance
 */
export async function readMarginBalance(userAddress: string): Promise<number> {
  try {
    const contract = new Contract(CONTRACT_ID);
    const source = new Account(READ_SOURCE, '0');

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('get_margin_balance', new Address(userAddress).toScVal())
      )
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      return 0;
    }

    return Number(scValToNative(sim.result.retval));
  } catch {
    return 0;
  }
}

/** Shape of a closed-trade record parsed from on-chain pos_close events */
export interface TradeRecord {
  id: string;
  positionId: number;
  marginClosed: number;   // raw scaled i128
  pnl: number;            // raw scaled i128 (can be negative)
  timestamp: number;      // unix seconds from ledger
  txHash: string;
}

/**
 * Read the user's closed-trade history by querying Soroban RPC contract events.
 * The contract emits `pos_close` events every time a position is fully or
 * partially closed:  topic = ["pos_close", user_address]
 *                    body  = (position_id: u64, margin_closed: i128, pnl: i128)
 */
export async function readTradeHistory(userAddress: string): Promise<TradeRecord[]> {
  try {
    let startLedger = 1;
    try {
      const latest = await server.getLatestLedger();
      startLedger = Math.max(1, latest.sequence - 50000);
    } catch {
      startLedger = 1;
    }

    const response = await server.getEvents({
      startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [CONTRACT_ID],
          topics: [
            ['*', '*'],   // topic[0] wildcard — SDK requires matching length
          ],
        },
      ],
      limit: 100,
    });

    const records: TradeRecord[] = [];

    for (const event of response.events) {
      // Match only pos_close events for this specific user
      const topics = event.topic;
      if (topics.length < 2) continue;

      const topicStr0 = scValToNative(topics[0]);
      const topicStr1 = scValToNative(topics[1]);

      if (topicStr0 !== 'pos_close') continue;

      // topic[1] is the user address — filter to current user
      let eventUser = '';
      try {
        eventUser = String(topicStr1);
      } catch {
        continue;
      }
      if (eventUser !== userAddress) continue;

      // Parse event body: (position_id, margin_closed, pnl)
      try {
        const body = scValToNative(event.value) as [bigint, bigint, bigint];
        records.push({
          id: event.id,
          positionId: Number(body[0]),
          marginClosed: Number(body[1]),
          pnl: Number(body[2]),
          timestamp: event.ledgerClosedAt
            ? Math.floor(new Date(event.ledgerClosedAt).getTime() / 1000)
            : 0,
          txHash: event.txHash ?? '',
        });
      } catch {
        continue;
      }
    }

    // Sort newest first
    records.sort((a, b) => b.timestamp - a.timestamp);
    return records;
  } catch {
    return [];
  }
}

/**
 * Read on-chain referral stats for a referrer:
 * returns { kickback: number, lifetime: number, count: number }
 */
export async function readReferralStats(referrerAddress: string): Promise<{
  kickback: number;
  lifetime: number;
  count: number;
}> {
  try {
    if (!contractConfigured()) return { kickback: 0, lifetime: 0, count: 0 };
    const contract = new Contract(CONTRACT_ID);
    const source = new Account(READ_SOURCE, '0');

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('get_referral_stats', new Address(referrerAddress).toScVal())
      )
      .setTimeout(30)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
      return { kickback: 0, lifetime: 0, count: 0 };
    }

    const res = scValToNative(sim.result.retval) as [bigint, bigint, number];
    return {
      kickback: Number(res[0]) / DECIMALS,
      lifetime: Number(res[1]) / DECIMALS,
      count: Number(res[2]),
    };
  } catch {
    return { kickback: 0, lifetime: 0, count: 0 };
  }
}

/** Build XDR to register a referral relationship on-chain */
export async function buildRegisterReferralXDR(
  referee: string,
  referrer: string
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(referee);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'register_referral',
        new Address(referee).toScVal(),
        new Address(referrer).toScVal()
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Referral registration simulation failed');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/** Build XDR to claim accumulated referral kickback into cross-margin balance */
export async function buildClaimReferralKickbackXDR(referrer: string): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(referrer);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call('claim_referral_kickback', new Address(referrer).toScVal())
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error('Claim referral kickback simulation failed');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}


