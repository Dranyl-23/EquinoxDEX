'use client';
import { useState } from 'react';

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<'overview' | 'contracts' | 'session-keys' | 'math' | 'comparison'>('overview');

  const navItems = [
    { id: 'overview', title: '1. System Overview' },
    { id: 'contracts', title: '2. Smart Contract Specs' },
    { id: 'session-keys', title: '3. 1-Click Session Keys' },
    { id: 'math', title: '4. Risk & Funding Math' },
    { id: 'comparison', title: '5. Competitor Analysis' },
  ] as const;

  return (
    <main className="flex min-h-screen w-full flex-col bg-background">
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-400 mx-auto w-full">
        
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="text-3xl font-bold text-white">System Documentation</h2>
          <p className="text-muted text-sm">Technical Specifications & Architecture Matrix</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 flex-1">
          
          {/* Left Sidebar Navigation */}
          <aside className="w-full md:w-64 flex flex-col gap-2 shrink-0">
            {navItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand text-white font-bold shadow-lg shadow-brand/20 border border-brand/50'
                      : 'text-muted hover:text-white hover:bg-panel/60 border border-transparent'
                  }`}
                >
                  <span>{item.title}</span>
                  <span className="text-xs opacity-60">→</span>
                </button>
              );
            })}

            <div className="mt-6 p-4 rounded-xl bg-panel/50 border border-border/60 text-xs flex flex-col gap-2">
              <span className="font-bold text-white">Soroban Network</span>
              <p className="text-muted leading-relaxed text-[11px]">
                EquinoxDEX executes smart contracts on Stellar Soroban Testnet with 500ms ledger finality.
              </p>
            </div>
          </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-panel/70 border border-border/80 rounded-2xl p-8 shadow-2xl backdrop-blur-xl flex flex-col gap-6">
          
          {/* Section 1: Overview */}
          {activeSection === 'overview' && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div className="border-b border-border/60 pb-4">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">System Overview</h2>
                <p className="text-muted text-sm mt-1">High-performance Cross-Margin Perpetual Exchange built on Stellar Soroban.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-1">
                  <span className="text-xs text-muted">Ledger Speed</span>
                  <span className="text-xl font-bold font-mono text-emerald-400">~500ms</span>
                  <span className="text-[11px] text-muted">Sub-second execution</span>
                </div>

                <div className="p-4 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-1">
                  <span className="text-xs text-muted">Avg Gas Fee</span>
                  <span className="text-xl font-bold font-mono text-brand">0.0001 XLM</span>
                  <span className="text-[11px] text-muted">Fractional cent cost</span>
                </div>

                <div className="p-4 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-1">
                  <span className="text-xs text-muted">Perpetual Catalog</span>
                  <span className="text-xl font-bold font-mono text-cyan-400">200+ Markets</span>
                  <span className="text-[11px] text-muted">Multi-position support</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 text-xs leading-relaxed text-muted mt-2">
                <h3 className="text-sm font-bold text-white">Core Value Proposition</h3>
                <p>
                  EquinoxDEX combines the lightning-fast speed and low cost of Centralized Exchanges (CEXs) with the self-custodial transparency and solvency guarantees of Decentralized Exchanges (DEXs).
                </p>
                <p>
                  Featuring <strong>Cross-Margin Account Architecture</strong>, <strong>Ephemeral 1-Click Session Keys</strong>, and <strong>Dynamic Skew-Based Funding Rates</strong>, EquinoxDEX provides institutional-grade trading infrastructure directly on Stellar Soroban.
                </p>
              </div>
            </div>
          )}

          {/* Section 2: Smart Contracts */}
          {activeSection === 'contracts' && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div className="border-b border-border/60 pb-4">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Smart Contract Architecture</h2>
                <p className="text-muted text-sm mt-1">Soroban Rust Contract Layout & State Persistence (`smart-margin/src/lib.rs`)</p>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold text-white">Soroban Persistent Storage Keys</h3>
                <div className="bg-black/80 rounded-xl p-4 border border-border/60 font-mono text-xs text-emerald-400">
                  <pre>{`pub enum DataKey {
    Admin,                           // Contract Admin Address
    MarginBalance(Address),          // Cross-Margin Balance (USDC i128)
    Positions(Address),              // soroban_sdk::Vec<Position> (Multi-Position Vector)
    NextPosId(Address),              // Auto-increment Position Counter
    LimitOrders(Address),            // Active Resting Limit Orders
    MarketState,                     // Global Long/Short Open Interest & Funding Rate
    SessionKey(Address, Address),    // Ephemeral Authorized Session Key
    InsuranceFund,                   // Bad Debt Socialization Vault
}`}</pre>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-xs text-muted">
                <h3 className="text-sm font-bold text-white">Position Struct Layout</h3>
                <p className="leading-relaxed">
                  Each open position contains a unique <code className="text-brand font-mono">id: u64</code>, target <code className="text-brand font-mono">symbol: Symbol</code>, margin locked, leverage multiplier, entry price, direction, TP/SL triggers, and entry funding index.
                </p>
              </div>
            </div>
          )}

          {/* Section 3: Session Keys */}
          {activeSection === 'session-keys' && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div className="border-b border-border/60 pb-4">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Ephemeral 1-Click Session Keys</h2>
                <p className="text-muted text-sm mt-1">Zero-latency sub-second trading without wallet signature popups.</p>
              </div>

              <div className="p-4 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-3 text-xs text-muted">
                <h3 className="text-sm font-bold text-white">How 1-Click Trading Works</h3>
                <ol className="list-decimal list-inside flex flex-col gap-2 leading-relaxed">
                  <li><strong>Key Generation:</strong> The frontend client generates a temporary ED25519 keypair inside local browser memory.</li>
                  <li><strong>On-Chain Delegation:</strong> The trader signs a single Soroban transaction delegating limited trading rights (`add_session_key`) for 24 hours.</li>
                  <li><strong>Instant Execution:</strong> All subsequent order placements, closes, and TP/SL edits are signed in sub-millisecond time by the session key.</li>
                  <li><strong>Non-Custodial Safety:</strong> Session keys can NEVER withdraw margin balance to external wallets (`withdraw_margin` requires original wallet authentication).</li>
                </ol>
              </div>
            </div>
          )}

          {/* Section 4: Risk & Funding Math */}
          {activeSection === 'math' && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div className="border-b border-border/60 pb-4">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Risk Engine & Funding Mathematics</h2>
                <p className="text-muted text-sm mt-1">Dynamic Skew-Based Funding Rate & Liquidation Formulas.</p>
              </div>

              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-2">
                  <h3 className="text-xs font-bold text-brand uppercase tracking-wider">Dynamic Funding Rate Formula</h3>
                  <div className="bg-black/90 p-3 rounded-lg text-emerald-400 font-mono text-xs">
                    Funding Rate = Base Rate + ((Long OI - Short OI) / Total Collateral) * Skew Coefficient
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed mt-1">
                    When Long Open Interest exceeds Short Open Interest, Long position holders pay funding to Short holders every hour, restoring market equilibrium.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-background/80 border border-border/60 flex flex-col gap-2">
                  <h3 className="text-xs font-bold text-danger uppercase tracking-wider">Cross-Margin Liquidation Trigger</h3>
                  <div className="bg-black/90 p-3 rounded-lg text-rose-400 font-mono text-xs">
                    Long Liq Price = Entry Price * (1 - (0.98 / Leverage))
                    <br />
                    Short Liq Price = Entry Price * (1 + (0.98 / Leverage))
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed mt-1">
                    Liquidations trigger automatically when remaining margin reaches 2% of initial collateral. Liquidators earn a 1-2% fee bounty.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Comparison */}
          {activeSection === 'comparison' && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div className="border-b border-border/60 pb-4">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Competitor Architecture Matrix</h2>
                <p className="text-muted text-sm mt-1">EquinoxDEX vs Hyperliquid vs dYdX v4 vs GMX v2</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-background/80 text-muted uppercase font-semibold border-b border-border/60">
                    <tr>
                      <th className="p-3">Feature</th>
                      <th className="p-3 text-brand font-bold">EquinoxDEX</th>
                      <th className="p-3">Hyperliquid</th>
                      <th className="p-3">dYdX v4</th>
                      <th className="p-3">GMX v2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    <tr>
                      <td className="p-3 font-sans font-medium text-white">Blockchain Layer</td>
                      <td className="p-3 text-brand font-bold">Stellar Soroban</td>
                      <td className="p-3 text-muted">HyperEVM Appchain</td>
                      <td className="p-3 text-muted">Cosmos Appchain</td>
                      <td className="p-3 text-muted">Arbitrum / Avalanche</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-white">Block Finality</td>
                      <td className="p-3 text-emerald-400 font-bold">~500ms</td>
                      <td className="p-3 text-muted">~200ms</td>
                      <td className="p-3 text-muted">~1000ms</td>
                      <td className="p-3 text-muted">~2000ms</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-white">Multi-Position Support</td>
                      <td className="p-3 text-emerald-400 font-bold">Unlimited / Market</td>
                      <td className="p-3 text-emerald-400 font-bold">Yes</td>
                      <td className="p-3 text-muted">Single / Market</td>
                      <td className="p-3 text-emerald-400 font-bold">Yes</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-white">1-Click Session Keys</td>
                      <td className="p-3 text-emerald-400 font-bold">Native Soroban</td>
                      <td className="p-3 text-emerald-400 font-bold">Native Agent Keys</td>
                      <td className="p-3 text-muted">No</td>
                      <td className="p-3 text-muted">No</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans font-medium text-white">Avg Gas Cost</td>
                      <td className="p-3 text-emerald-400 font-bold">&lt;$0.0001</td>
                      <td className="p-3 text-muted">Free</td>
                      <td className="p-3 text-muted">~ $0.05</td>
                      <td className="p-3 text-muted">~ $0.20</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
        </div>
      </div>
    </main>
  );
}
