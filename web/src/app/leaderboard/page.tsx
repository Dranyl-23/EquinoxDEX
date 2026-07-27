'use client';
import { useState, useEffect } from 'react';
import { useWalletContext } from '@/components/WalletProvider';
import { readLeaderboard, readUserPnL, LeaderboardEntry } from '@/lib/contract';
import { DECIMALS } from '@/lib/constants';

export default function Leaderboard() {
  const wallet = useWalletContext();
  const { publicKey } = wallet;
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userPnl, setUserPnl] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const board = await readLeaderboard();
        // Since contract does insertion sort, it might be ascending or descending.
        // Let's ensure it's sorted descending (highest PnL first).
        board.sort((a, b) => b.total_pnl - a.total_pnl);
        setLeaderboard(board);
        
        if (publicKey) {
          const pnl = await readUserPnL(publicKey);
          setUserPnl(pnl);
        }
      } catch {
        // Silently swallow background polling glitches
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [publicKey]);

  const truncateAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
  };

  return (
    <main className="flex min-h-screen w-full flex-col bg-background">
      {/* Main Leaderboard Content */}
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-400 mx-auto w-full">
        
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-white">Global Leaderboard</h2>
          <p className="text-muted">
            The top 10 most profitable traders on EquinoxDEX. PnL is tracked permanently on-chain in the Soroban smart contract.
          </p>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-panel border border-border/60 rounded-xl overflow-hidden relative">
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-background/50 text-muted text-xs uppercase tracking-wider">
                  <th className="py-5 px-6 font-semibold">Rank</th>
                  <th className="py-5 px-6 font-semibold">Trader</th>
                  <th className="py-5 px-6 font-semibold text-right">Lifetime PnL</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-muted animate-pulse">Syncing on-chain data...</td>
                  </tr>
                ) : leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-muted">No traders found on the leaderboard yet.</td>
                  </tr>
                ) : (
                  leaderboard.map((entry, idx) => (
                    <tr 
                      key={entry.user} 
                      className={`border-b border-border/50 hover:bg-background/40 transition-colors ${entry.user === publicKey ? 'bg-brand/10' : ''}`}
                    >
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-3">
                          {idx === 0 && (
                            <span className="px-2.5 py-1 text-xs font-mono font-extrabold rounded-md bg-linear-to-r from-yellow-400 to-amber-500 text-black shadow-md shadow-yellow-500/20">
                              #1
                            </span>
                          )}
                          {idx === 1 && (
                            <span className="px-2.5 py-1 text-xs font-mono font-extrabold rounded-md bg-linear-to-r from-slate-200 to-slate-400 text-black shadow-md shadow-slate-400/20">
                              #2
                            </span>
                          )}
                          {idx === 2 && (
                            <span className="px-2.5 py-1 text-xs font-mono font-extrabold rounded-md bg-linear-to-r from-amber-600 to-amber-700 text-white shadow-md shadow-amber-600/20">
                              #3
                            </span>
                          )}
                          {idx > 2 && <span className="font-mono text-muted text-sm w-8 text-center">#{idx + 1}</span>}
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                            idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                            idx === 2 ? 'bg-amber-600/20 text-amber-600' :
                            'bg-border text-muted'
                          }`}>
                            {entry.user.slice(1, 3)}
                          </div>
                          <span className={`font-mono text-lg ${entry.user === publicKey ? 'text-brand font-bold' : 'text-white'}`}>
                            {truncateAddress(entry.user)}
                          </span>
                          {entry.user === publicKey && (
                            <span className="bg-brand/20 text-brand text-[10px] uppercase px-2 py-0.5 rounded border border-brand/30">You</span>
                          )}
                        </div>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <span className={`font-mono text-xl font-bold ${entry.total_pnl >= 0 ? 'text-green-500' : 'text-danger'}`}>
                          {entry.total_pnl >= 0 ? '+' : '-'}${Math.abs(entry.total_pnl / DECIMALS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Connected User Sticky Bar */}
        {publicKey && (
          <div className="mt-8 bg-panel/50 border border-border/60 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-brand/5"></div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-12 h-12 bg-brand/20 rounded-full flex items-center justify-center border border-brand/50 text-brand">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              </div>
              <div>
                <div className="text-sm text-brand font-bold uppercase tracking-wider">Your Lifetime PnL</div>
                <div className="font-mono text-muted">{truncateAddress(publicKey)}</div>
              </div>
            </div>
            
            <div className="relative z-10 text-center md:text-right">
              <div className={`text-3xl font-mono font-bold ${userPnl >= 0 ? 'text-green-500' : 'text-danger'}`}>
                {userPnl >= 0 ? '+' : '-'}${Math.abs(userPnl / DECIMALS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted mt-1">Tracked on-chain permanently</div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
