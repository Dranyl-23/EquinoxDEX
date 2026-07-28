import { NETWORK_PASSPHRASE } from './stellar';
import { submitSignedXDR, pollTransaction } from './payment';
import { getSessionKey } from './sessionKey';
import { TransactionBuilder, Keypair } from '@stellar/stellar-sdk';

/**
 * Sign an unsigned XDR with Freighter, submit it, and poll to finality.
 * Returns the transaction hash. Use for simple "one-shot" actions
 * (trustlines, contract calls) that don't need granular status UI.
 */
export async function signAndSubmit(xdr: string, address: string, forceFreighter: boolean = false): Promise<string> {
  const sessionKey = await getSessionKey();
  
  let finalXdr = xdr;
  
  if (sessionKey && !forceFreighter) {
    // 1-Click Trading enabled! Sign locally without a popup.
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    const keypair = Keypair.fromSecret(sessionKey.secretKey);
    tx.sign(keypair);
    finalXdr = tx.toXDR();
  } else {
    // Dynamic import only — static import of freighter-api breaks SSR.
    const freighter = await import('@stellar/freighter-api');
    const signed = await freighter.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });
    if (signed.error) {
      throw new Error(
        typeof signed.error === 'string' ? signed.error : 'Signing was rejected',
      );
    }
    finalXdr = signed.signedTxXdr;
  }
  
  const hash = await submitSignedXDR(finalXdr);
  await pollTransaction(hash);
  return hash;
}
