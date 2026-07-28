export interface MarketInfo {
  symbol: string;         // e.g. "BTCUSDT"
  baseAsset: string;      // e.g. "BTC"
  quoteAsset: string;     // e.g. "USDC"
  name: string;           // e.g. "Bitcoin"
  category: 'Top' | 'Layer 1' | 'Memes' | 'AI' | 'DeFi' | 'RWA';
  maxLeverage: number;    // e.g. 50 or 100
  displayPrice?: number;
  change24h?: number;
}

export const MARKETS: MarketInfo[] = [
  // Top Cryptos
  { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDC', name: 'Bitcoin', category: 'Top', maxLeverage: 50, change24h: 3.42 },
  { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDC', name: 'Ethereum', category: 'Top', maxLeverage: 50, change24h: 2.15 },
  { symbol: 'SOLUSDT', baseAsset: 'SOL', quoteAsset: 'USDC', name: 'Solana', category: 'Top', maxLeverage: 50, change24h: 5.81 },
  { symbol: 'XRPUSDT', baseAsset: 'XRP', quoteAsset: 'USDC', name: 'XRP', category: 'Top', maxLeverage: 50, change24h: 1.20 },
  { symbol: 'DOGEUSDT', baseAsset: 'DOGE', quoteAsset: 'USDC', name: 'Dogecoin', category: 'Memes', maxLeverage: 50, change24h: 8.94 },
  { symbol: 'ADAUSDT', baseAsset: 'ADA', quoteAsset: 'USDC', name: 'Cardano', category: 'Top', maxLeverage: 50, change24h: -0.85 },
  { symbol: 'BNBUSDT', baseAsset: 'BNB', quoteAsset: 'USDC', name: 'BNB', category: 'Top', maxLeverage: 50, change24h: 1.45 },
  { symbol: 'AVAXUSDT', baseAsset: 'AVAX', quoteAsset: 'USDC', name: 'Avalanche', category: 'Layer 1', maxLeverage: 50, change24h: 4.12 },
  { symbol: 'SUIUSDT', baseAsset: 'SUI', quoteAsset: 'USDC', name: 'Sui Network', category: 'Layer 1', maxLeverage: 50, change24h: 12.30 },
  { symbol: 'NEARUSDT', baseAsset: 'NEAR', quoteAsset: 'USDC', name: 'Near Protocol', category: 'Layer 1', maxLeverage: 50, change24h: 6.75 },
  { symbol: 'APTUSDT', baseAsset: 'APT', quoteAsset: 'USDC', name: 'Aptos', category: 'Layer 1', maxLeverage: 50, change24h: 2.90 },
  { symbol: 'SEIUSDT', baseAsset: 'SEI', quoteAsset: 'USDC', name: 'Sei Network', category: 'Layer 1', maxLeverage: 50, change24h: -1.40 },
  { symbol: 'INJUSDT', baseAsset: 'INJ', quoteAsset: 'USDC', name: 'Injective', category: 'Layer 1', maxLeverage: 50, change24h: 3.10 },
  { symbol: 'TIAUSDT', baseAsset: 'TIA', quoteAsset: 'USDC', name: 'Celestia', category: 'Layer 1', maxLeverage: 50, change24h: 7.45 },
  { symbol: 'ARBUSDT', baseAsset: 'ARB', quoteAsset: 'USDC', name: 'Arbitrum', category: 'Layer 1', maxLeverage: 50, change24h: 0.95 },
  { symbol: 'OPUSDT', baseAsset: 'OP', quoteAsset: 'USDC', name: 'Optimism', category: 'Layer 1', maxLeverage: 50, change24h: 1.80 },
  { symbol: 'MATICUSDT', baseAsset: 'POL', quoteAsset: 'USDC', name: 'Polygon', category: 'Layer 1', maxLeverage: 50, change24h: -0.30 },
  { symbol: 'FTMUSDT', baseAsset: 'FTM', quoteAsset: 'USDC', name: 'Fantom', category: 'Layer 1', maxLeverage: 50, change24h: 5.20 },
  { symbol: 'LINKUSDT', baseAsset: 'LINK', quoteAsset: 'USDC', name: 'Chainlink', category: 'DeFi', maxLeverage: 50, change24h: 4.60 },
  { symbol: 'DOTUSDT', baseAsset: 'DOT', quoteAsset: 'USDC', name: 'Polkadot', category: 'Layer 1', maxLeverage: 50, change24h: 1.10 },

  // Memecoins
  { symbol: 'PEPEUSDT', baseAsset: 'PEPE', quoteAsset: 'USDC', name: 'Pepe', category: 'Memes', maxLeverage: 50, change24h: 18.40 },
  { symbol: 'SHIBUSDT', baseAsset: 'SHIB', quoteAsset: 'USDC', name: 'Shiba Inu', category: 'Memes', maxLeverage: 50, change24h: 4.30 },
  { symbol: 'WIFUSDT', baseAsset: 'WIF', quoteAsset: 'USDC', name: 'dogwifhat', category: 'Memes', maxLeverage: 50, change24h: 14.20 },
  { symbol: 'BONKUSDT', baseAsset: 'BONK', quoteAsset: 'USDC', name: 'Bonk', category: 'Memes', maxLeverage: 50, change24h: 9.15 },
  { symbol: 'FLOKIUSDT', baseAsset: 'FLOKI', quoteAsset: 'USDC', name: 'Floki', category: 'Memes', maxLeverage: 50, change24h: 6.80 },
  { symbol: 'POPCATUSDT', baseAsset: 'POPCAT', quoteAsset: 'USDC', name: 'Popcat', category: 'Memes', maxLeverage: 50, change24h: 22.10 },
  { symbol: 'MEWUSDT', baseAsset: 'MEW', quoteAsset: 'USDC', name: 'cat in a dogs world', category: 'Memes', maxLeverage: 50, change24h: 11.50 },
  { symbol: 'BRETTUSDT', baseAsset: 'BRETT', quoteAsset: 'USDC', name: 'Brett', category: 'Memes', maxLeverage: 50, change24h: 8.40 },

  // AI & Infrastructure
  { symbol: 'TAOUSDT', baseAsset: 'TAO', quoteAsset: 'USDC', name: 'Bittensor', category: 'AI', maxLeverage: 50, change24h: 15.60 },
  { symbol: 'RENDERUSDT', baseAsset: 'RENDER', quoteAsset: 'USDC', name: 'Render Network', category: 'AI', maxLeverage: 50, change24h: 7.90 },
  { symbol: 'FETUSDT', baseAsset: 'FET', quoteAsset: 'USDC', name: 'Artificial Superintelligence', category: 'AI', maxLeverage: 50, change24h: 10.20 },
  { symbol: 'WLDUSDT', baseAsset: 'WLD', quoteAsset: 'USDC', name: 'Worldcoin', category: 'AI', maxLeverage: 50, change24h: 3.80 },
  { symbol: 'AKTUSDT', baseAsset: 'AKT', quoteAsset: 'USDC', name: 'Akash Network', category: 'AI', maxLeverage: 50, change24h: 5.40 },

  // DeFi & RWA
  { symbol: 'UNIUSDT', baseAsset: 'UNI', quoteAsset: 'USDC', name: 'Uniswap', category: 'DeFi', maxLeverage: 50, change24h: 2.40 },
  { symbol: 'AAVEUSDT', baseAsset: 'AAVE', quoteAsset: 'USDC', name: 'Aave', category: 'DeFi', maxLeverage: 50, change24h: 6.30 },
  { symbol: 'PENDLEUSDT', baseAsset: 'PENDLE', quoteAsset: 'USDC', name: 'Pendle', category: 'DeFi', maxLeverage: 50, change24h: 8.70 },
  { symbol: 'ONDOUSDT', baseAsset: 'ONDO', quoteAsset: 'USDC', name: 'Ondo Finance', category: 'RWA', maxLeverage: 50, change24h: 11.20 },
  { symbol: 'ENAUSDT', baseAsset: 'ENA', quoteAsset: 'USDC', name: 'Ethena', category: 'DeFi', maxLeverage: 50, change24h: 4.80 },
  { symbol: 'MKRUSDT', baseAsset: 'MKR', quoteAsset: 'USDC', name: 'Maker', category: 'DeFi', maxLeverage: 50, change24h: 1.90 },
  { symbol: 'LDOUSDT', baseAsset: 'LDO', quoteAsset: 'USDC', name: 'Lido DAO', category: 'DeFi', maxLeverage: 50, change24h: -1.10 },
  { symbol: 'CRVUSDT', baseAsset: 'CRV', quoteAsset: 'USDC', name: 'Curve DAO', category: 'DeFi', maxLeverage: 50, change24h: 3.50 },
  { symbol: 'SNXUSDT', baseAsset: 'SNX', quoteAsset: 'USDC', name: 'Synthetix', category: 'DeFi', maxLeverage: 50, change24h: 0.80 },
  { symbol: 'COMPUSDT', baseAsset: 'COMP', quoteAsset: 'USDC', name: 'Compound', category: 'DeFi', maxLeverage: 50, change24h: 2.10 },
];

// Dynamically generate up to 200 perpetual pairs for full catalog coverage
const EXTRA_SYMBOLS = [
  'LTC', 'BCH', 'XLM', 'ETC', 'FIL', 'ATOM', 'ALGO', 'VET', 'ICP', 'THETA',
  'SAND', 'MANA', 'AXS', 'GALA', 'EGLD', 'FLOW', 'CHZ', 'APE', 'EOS', 'XTZ',
  'KAVA', 'MINA', 'NEO', 'IOTA', 'ZEC', 'DASH', 'WAVES', 'SNX', 'RUNE', 'ZIL',
  'ENJ', '1INCH', 'BAT', 'LRC', 'STORJ', 'CELO', 'ANKR', 'HOT', 'OMG', 'RVN',
  'WOO', 'JST', 'SUN', 'ORDI', 'SATS', 'BOME', 'NOT', 'BLUR', 'PYTH', 'JUP',
  'STRK', 'ZK', 'W', 'ZRO', 'LISTA', 'IO', 'ATH', 'ZETA', 'DRIFT', 'BB',
  'OMNI', 'TNSR', 'SAGA', 'WIF', 'ETHFI', 'AEVO', 'PORTAL', 'DYM', 'ALT', 'MANTA',
  'XAI', 'AI', 'NFP', 'ACE', 'JTO', 'VANRY', 'BEAM', 'MEME', 'TIA', 'BIGTIME',
  'CYBER', 'SEI', 'ARKM', 'MAV', 'PENDLE', 'SUI', 'PEPE', 'FLOKI', 'ID', 'SSV',
  'MAGIC', 'HIGH', 'HOOK', 'HFT', 'APT', 'GMX', 'STG', 'OP', 'INJ', 'LDO'
];

EXTRA_SYMBOLS.forEach(sym => {
  const symbol = `${sym}USDT`;
  if (!MARKETS.some(m => m.symbol === symbol)) {
    MARKETS.push({
      symbol,
      baseAsset: sym,
      quoteAsset: 'USDC',
      name: `${sym} Perpetual`,
      category: 'Top',
      maxLeverage: 50,
    });
  }
});
