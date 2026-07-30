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

/** Build + simulate + assemble open_position invocation */
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
    throw new Error('Simulation failed — Check testnet balance.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/** Build + simulate + assemble close_position invocation */
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

/** Build + simulate + assemble place_limit_order invocation */
export async function buildPlaceLimitOrderXDR(
  caller: string,
  user: string,
  symbol: string,
  margin: number,
  leverage: number,
  isLong: boolean,
  triggerPrice: number,
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
    throw new Error('Simulation failed — Check testnet balance or if order already exists.');
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

/** Read margin balance */
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

/** Read on-chain referral stats for a referrer */
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

/**
 * Read the total pool state and the user's specific shares.
 */
export async function readPoolState(userAddress: string): Promise<{ totalPool: number; totalShares: number; userShares: number }> {
  try {
    if (!contractConfigured()) return { totalPool: 0, totalShares: 0, userShares: 0 };
    const contract = new Contract(CONTRACT_ID);
    const source = new Account(READ_SOURCE, '0');

    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call('get_pool_state', new Address(userAddress || READ_SOURCE).toScVal())
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

/** Build XDR to register referral link */
export async function buildRegisterReferralXDR(referee: string, referrer: string): Promise<string> {
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
    throw new Error('Register referral simulation failed');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/** Build + simulate + assemble an unsigned `withdraw_margin` invocation */
export async function buildWithdrawMarginXDR(
  caller: string,
  user: string,
  amountScaled: number
): Promise<string> {
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
        nativeToScVal(BigInt(Math.trunc(amountScaled)), { type: 'i128' })
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
