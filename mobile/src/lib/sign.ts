/**
 * Mobile transaction signing module.
 * Replaces Freighter signing with local Keypair signing.
 */
import { TransactionBuilder, Keypair } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE } from './stellar';
import { submitSignedXDR, pollTransaction } from './payment';
import { loadWallet } from './wallet';

/**
 * Sign an unsigned XDR with the local embedded wallet, submit it, and poll to finality.
 * Returns the transaction hash.
 */
export async function signAndSubmit(xdr: string): Promise<string> {
  const wallet = await loadWallet();
  if (!wallet) {
    throw new Error('No wallet found. Please create or import a wallet first.');
  }

  const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
  const keypair = Keypair.fromSecret(wallet.secretKey);
  tx.sign(keypair);

  const signedXdr = tx.toXDR();
  const hash = await submitSignedXDR(signedXdr);
  await pollTransaction(hash);
  return hash;
}

/**
 * Sign and submit a classic transaction directly to Horizon instead of Soroban RPC.
 */
import { horizonServer } from './stellar';

export async function signAndSubmitHorizon(xdr: string): Promise<string> {
  const wallet = await loadWallet();
  if (!wallet) {
    throw new Error('No wallet found. Please create or import a wallet first.');
  }

  let tx;
  try {
    tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
  } catch (e: any) {
    throw new Error(`Parse Error: ${e.message}`);
  }

  const keypair = Keypair.fromSecret(wallet.secretKey);
  tx.sign(keypair);

  const signedXdr = tx.toXDR();
  const body = new URLSearchParams();
  body.append('tx', signedXdr);

  const res = await fetch('https://horizon-testnet.stellar.org/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    const codes = data.extras?.result_codes;
    throw new Error(`Horizon failed: ${JSON.stringify(codes)}`);
  }
  
  return data.hash;
}
