import { rpc, Networks, Asset } from '@stellar/stellar-sdk';

// Network passphrase
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const USDC_ISSUER = '';
export const CONTRACT_ID = 'CAAITOVUWRENIVCLDX7BOLXWX6UVXGFNCG2564J7NHHSZU4Y4RC72NCJ';

export const server = new rpc.Server(RPC_URL);

export const XLM = Asset.native();
export const USDC = USDC_ISSUER ? new Asset('USDC', USDC_ISSUER) : null;

// Testnet SAC addresses
export const USDC_TOKEN_ID = 'CBIELTK6YBZJU67VBKDS5V2P4IZZWVE7LOOK4RQHBQWUDT5DSSZLV6OJ';
export const XLM_TOKEN_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

/** Fund a testnet account via Friendbot (~10,000 XLM). */
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
  );
  if (!res.ok && res.status !== 400) {
    throw new Error('Friendbot funding failed. Try again in a moment.');
  }
}
