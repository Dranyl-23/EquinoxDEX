/**
 * Official EquinoxDEX Institutional TypeScript Client SDK
 * Enables quantitative trading bots, market makers, and algorithmic traders
 * to query markets, orderbooks, user positions, and execute trades on Stellar Soroban.
 */

export interface MarketMetadata {
  symbol: string;
  name: string;
  category: string;
  price: number;
  fundingRate: number;
  volume24h: number;
  maxLeverage: number;
}

export interface OrderbookDepth {
  symbol: string;
  bids: Array<{ price: number; amount: number; total: number }>;
  asks: Array<{ price: number; amount: number; total: number }>;
  timestamp: number;
}

export interface UserPosition {
  id: number;
  symbol: string;
  margin: number;
  leverage: number;
  entryPrice: number;
  isLong: boolean;
  takeProfit: number;
  stopLoss: number;
}

export interface EquinoxClientConfig {
  baseUrl?: string;
  network?: 'testnet' | 'mainnet';
}

export class EquinoxDEXClient {
  private baseUrl: string;

  constructor(config: EquinoxClientConfig = {}) {
    this.baseUrl = config.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  }

  /**
   * Fetch 200+ Perpetual Markets Catalog
   */
  async getMarkets(): Promise<MarketMetadata[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/markets`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    const data = await res.json();
    return data.markets;
  }

  /**
   * Fetch Orderbook Depth for a specific market symbol
   */
  async getOrderbook(symbol: string = 'BTCUSDT'): Promise<OrderbookDepth> {
    const res = await fetch(`${this.baseUrl}/api/v1/orderbook?symbol=${symbol}`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    return await res.json();
  }

  /**
   * Fetch active open positions for a trader address
   */
  async getPositions(userAddress: string): Promise<UserPosition[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/positions?user=${userAddress}`);
    if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
    const data = await res.json();
    return data.positions;
  }
}
