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
}

export function contractConfigured(): boolean {
  return Boolean(CONTRACT_ID);
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
    // Fails if position doesn't exist (returns NoPosition error)
    return null;
  }

  const pos = scValToNative(sim.result.retval) as {
    margin: bigint;
    leverage: number;
    entry_price: bigint;
    is_long: boolean;
  };
  
  return {
    margin: Number(pos.margin),
    leverage: pos.leverage,
    entry_price: Number(pos.entry_price),
    is_long: pos.is_long,
  };
}

/**
 * Build + simulate + assemble an unsigned `open_position` invocation.
 */
export async function buildOpenPositionXDR(
  sender: string,
  margin: number, // Already scaled by 10^7
  leverage: number,
  isLong: boolean
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
        nativeToScVal(isLong, { type: 'bool' })
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
