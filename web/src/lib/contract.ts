import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
  rpc,
  nativeToScVal,
  scValToNative,
  Address,
} from '@stellar/stellar-sdk';
import { server, NETWORK_PASSPHRASE, CONTRACT_ID } from './stellar';

// A real, funded testnet account used ONLY as the source for read-only
// simulations. Nothing is signed or submitted for reads, so any existing
// account works — we reuse the Circle USDC issuer.
const READ_SOURCE = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export interface Position {
  margin: number;
  leverage: number;
  entry_price: number;
  is_long: boolean;
  take_profit: number;
  stop_loss: number;
  funding_index_at_entry: number;
}

export function contractConfigured(): boolean {
  return Boolean(CONTRACT_ID);
}

/** Read global market state via simulation */
export async function readMarketState(): Promise<{ long_oi: number; short_oi: number; global_funding: number; total_volume: number }> {
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
}

/** Read position via simulation — no wallet or signature required. */
export async function readPosition(userAddress: string): Promise<Position | null> {
  const contract = new Contract(CONTRACT_ID);
  const source = new Account(READ_SOURCE, '0');

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call('get_position', new Address(userAddress).toScVal())
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    return null;
  }

  const pos = scValToNative(sim.result.retval) as {
    margin: bigint;
    leverage: number;
    entry_price: bigint;
    is_long: boolean;
    take_profit: bigint;
    stop_loss: bigint;
    funding_index_at_entry: bigint;
  };
  
  return {
    margin: Number(pos.margin),
    leverage: pos.leverage,
    entry_price: Number(pos.entry_price),
    is_long: pos.is_long,
    take_profit: Number(pos.take_profit),
    stop_loss: Number(pos.stop_loss),
    funding_index_at_entry: Number(pos.funding_index_at_entry),
  };
}

/**
 * Build + simulate + assemble an unsigned `open_position` invocation.
 */
export async function buildOpenPositionXDR(
  sender: string,
  margin: number, // Already scaled by 10^7
  leverage: number,
  isLong: boolean,
  takeProfit: number, // Scaled by 10^7
  stopLoss: number    // Scaled by 10^7
): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'open_position',
        new Address(sender).toScVal(),
        nativeToScVal(BigInt(Math.trunc(margin)), { type: 'i128' }),
        nativeToScVal(leverage, { type: 'u32' }),
        nativeToScVal(isLong, { type: 'bool' }),
        nativeToScVal(BigInt(Math.trunc(takeProfit)), { type: 'i128' }),
        nativeToScVal(BigInt(Math.trunc(stopLoss)), { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    console.error('Simulation failed', sim.error, sim.events);
    throw new Error('Simulation failed — Check testnet balance or if position exists.');
  }

  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/**
 * Build + simulate + assemble an unsigned `close_position` invocation.
 */
export async function buildClosePositionXDR(sender: string): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call('close_position', new Address(sender).toScVal())
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
export async function buildTriggerOrdersXDR(sender: string, targetUser: string): Promise<string> {
  const contract = new Contract(CONTRACT_ID);
  const account = await server.getAccount(sender);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call('trigger_orders', new Address(targetUser).toScVal())
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
 * Read the total pool state and the user's specific shares.
 */
export async function readPoolState(userAddress: string): Promise<{ totalPool: number; totalShares: number; userShares: number }> {
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
}

/**
 * Build + simulate + assemble an unsigned `add_liquidity` invocation.
 */
export async function buildAddLiquidityXDR(sender: string, amountScaled: number): Promise<string> {
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
export async function buildRemoveLiquidityXDR(sender: string, sharesScaled: number): Promise<string> {
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
