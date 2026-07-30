import { rpc, Networks, Asset, Horizon, Operation, TransactionBuilder, BASE_FEE, Keypair } from '@stellar/stellar-sdk';

// Network passphrase
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const CONTRACT_ID = 'CAAITOVUWRENIVCLDX7BOLXWX6UVXGFNCG2564J7NHHSZU4Y4RC72NCJ';

export const server = new rpc.Server(RPC_URL);
export const horizonServer = new Horizon.Server(HORIZON_URL);

export const XLM = Asset.native();
export const USDC = new Asset('USDC', USDC_ISSUER);

import { USDC_TOKEN_ID } from './constants';
export { USDC_TOKEN_ID };
export const XLM_TOKEN_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

/** Fund a testnet account via Friendbot (~10,000 XLM) and swap 1000 XLM to real on-chain USDC. */
export async function fundTestnetAccount(publicKey: string, secretKey?: string): Promise<void> {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`,
  );
  if (!res.ok && res.status !== 400) {
    throw new Error('Friendbot funding failed. Try again in a moment.');
  }

  // If secret key is supplied, open USDC trustline & swap XLM for real USDC on SDEX
  if (secretKey) {
    try {
      const account = await horizonServer.loadAccount(publicKey);
      const usdcAsset = new Asset('USDC', USDC_ISSUER);
      
      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(Operation.changeTrust({ asset: usdcAsset }))
        .addOperation(
          Operation.pathPaymentStrictSend({
            sendAsset: Asset.native(),
            sendAmount: '1000',
            destAsset: usdcAsset,
            destMin: '10',
            destination: publicKey,
          })
        )
        .setTimeout(30)
        .build();

      const pair = Keypair.fromSecret(secretKey);
      tx.sign(pair);
      await horizonServer.submitTransaction(tx);
    } catch {
      // If swap fails or trustline exists, ignore gracefully
    }
  }
}

