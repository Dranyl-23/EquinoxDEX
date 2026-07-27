'use client';
import { useState } from 'react';

export default function ApiDocsPage() {
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<'curl' | 'ts' | 'python'>('ts');
  const [apiResult, setApiResult] = useState<string | null>(null);
  const [loadingApi, setLoadingApi] = useState<boolean>(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(id);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const testEndpoint = async (url: string) => {
    setLoadingApi(true);
    setApiResult('Fetching live REST API endpoint...');
    try {
      const res = await fetch(url);
      const data = await res.json();
      setApiResult(JSON.stringify(data, null, 2));
    } catch (e: unknown) {
      setApiResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingApi(false);
    }
  };

  const codeSnippets = {
    ts: `import { EquinoxDEXClient } from '@equinox-dex/sdk';

// Initialize Client on Stellar Testnet
const client = new EquinoxDEXClient({ network: 'testnet' });

async function main() {
  // 1. Fetch 200+ Perpetual Markets
  const markets = await client.getMarkets();
  console.log('Active Markets:', markets.length);

  // 2. Fetch Live Orderbook Depth
  const depth = await client.getOrderbook('BTCUSDT');
  console.log('Top Bid:', depth.bids[0]);

  // 3. Fetch Trader Open Positions
  const positions = await client.getPositions('GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
  console.log('Open Positions:', positions);
}

main();`,
    python: `import requests

BASE_URL = "http://localhost:3000/api/v1"

# 1. Fetch 200+ Perpetual Markets Catalog
markets_response = requests.get(f"{BASE_URL}/markets").json()
print("Total Markets:", markets_response["total"])

# 2. Fetch Orderbook Depth for BTCUSDT
orderbook = requests.get(f"{BASE_URL}/orderbook?symbol=BTCUSDT").json()
print("Top Ask:", orderbook["asks"][0])

# 3. Query Open Positions for Address
user_address = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
positions = requests.get(f"{BASE_URL}/positions?user={user_address}").json()
print("Positions:", positions["positions"])`,
    curl: `# Fetch 200+ Perpetual Markets Catalog
curl -X GET "http://localhost:3000/api/v1/markets"

# Fetch Real-Time Orderbook Depth
curl -X GET "http://localhost:3000/api/v1/orderbook?symbol=BTCUSDT"

# Fetch Trader Open Positions
curl -X GET "http://localhost:3000/api/v1/positions?user=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"`
  };

  return (
    <main className="flex min-h-screen w-full flex-col bg-background">
      <div className="flex flex-col flex-1 p-6 lg:p-10 max-w-400 mx-auto w-full">
        
        {/* Header */}
        <div className="mb-8 flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-white">Institutional Developer API & SDK</h2>
          <p className="text-muted">
            EquinoxDEX provides ultra-low latency REST endpoints and official TypeScript & Python Client SDKs for quantitative funds, algorithmic bots, and market makers on Stellar Soroban.
          </p>
        </div>

        {/* Quickstart Code Section */}
        <div className="bg-panel/70 border border-border/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-border/60 pb-4">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white text-lg">Developer SDK Quickstart</h2>
            </div>

            {/* Language Selector */}
            <div className="flex bg-background/80 rounded-lg p-1 border border-border/60 text-xs font-semibold">
              {(['ts', 'python', 'curl'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveLang(lang)}
                  className={`px-3 py-1 rounded-md transition-all uppercase font-mono ${
                    activeLang === lang ? 'bg-brand text-white font-bold shadow-sm' : 'text-muted hover:text-white'
                  }`}
                >
                  {lang === 'ts' ? 'TypeScript' : lang === 'python' ? 'Python' : 'cURL'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative bg-black/80 rounded-xl p-4 border border-border/60 font-mono text-xs overflow-x-auto text-emerald-400">
            <button
              onClick={() => copyToClipboard(codeSnippets[activeLang], activeLang)}
              className="absolute top-3 right-3 flex items-center gap-1 bg-panel border border-border/80 hover:border-brand text-muted hover:text-white px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer"
            >
              <span>{copiedTab === activeLang ? 'Copied' : 'Copy'}</span>
            </button>
            <pre>{codeSnippets[activeLang]}</pre>
          </div>
        </div>

        {/* Live Interactive REST API Endpoint Playground */}
        <div className="bg-panel/70 border border-border/80 rounded-2xl p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-border/60 pb-4">
            <h2 className="font-bold text-white text-lg">Live Interactive REST API Playground</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => testEndpoint('/api/v1/markets')}
              className="flex flex-col gap-1 p-4 bg-background/80 hover:bg-background border border-border/60 hover:border-brand rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">GET</span>
                <span className="text-xs font-mono text-brand font-bold">Run</span>
              </div>
              <span className="font-mono font-bold text-white text-xs mt-1">/api/v1/markets</span>
              <span className="text-[11px] text-muted">200+ Perpetual Markets Metadata</span>
            </button>

            <button
              onClick={() => testEndpoint('/api/v1/orderbook?symbol=BTCUSDT')}
              className="flex flex-col gap-1 p-4 bg-background/80 hover:bg-background border border-border/60 hover:border-brand rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">GET</span>
                <span className="text-xs font-mono text-brand font-bold">Run</span>
              </div>
              <span className="font-mono font-bold text-white text-xs mt-1">/api/v1/orderbook</span>
              <span className="text-[11px] text-muted">Real-Time Depth & Price Ladder</span>
            </button>

            <button
              onClick={() => testEndpoint('/api/v1/positions?user=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')}
              className="flex flex-col gap-1 p-4 bg-background/80 hover:bg-background border border-border/60 hover:border-brand rounded-xl text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">GET</span>
                <span className="text-xs font-mono text-brand font-bold">Run</span>
              </div>
              <span className="font-mono font-bold text-white text-xs mt-1">/api/v1/positions</span>
              <span className="text-[11px] text-muted">Trader Active Open Positions</span>
            </button>
          </div>

          {/* Response Box */}
          {apiResult && (
            <div className="flex flex-col gap-2 pt-2">
              <span className="text-xs font-semibold text-muted">Live JSON Response:</span>
              <pre className="bg-black/90 p-4 rounded-xl border border-border/60 text-xs font-mono text-emerald-400 max-h-80 overflow-y-auto">
                {apiResult}
              </pre>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
