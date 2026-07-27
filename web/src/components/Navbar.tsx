'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWalletContext } from './WalletProvider';
import ConnectWallet from './ConnectWallet';
import { contractConfigured } from '@/lib/contract';

export default function Navbar() {
  const wallet = useWalletContext();
  const pathname = usePathname();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-panel px-4">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold tracking-tight text-white">EquinoxDEX</h1>
        <nav className="flex gap-4 text-sm font-medium text-muted">
          <Link 
            href="/" 
            className={`hover:text-white transition-colors ${pathname === '/' ? 'text-white' : ''}`}
          >
            Trade
          </Link>
          <Link 
            href="/portfolio" 
            className={`hover:text-white transition-colors ${pathname === '/portfolio' ? 'text-white' : ''}`}
          >
            Portfolio
          </Link>
          <Link 
            href="/vaults" 
            className={`hover:text-white transition-colors ${pathname === '/vaults' ? 'text-white font-bold' : ''}`}
          >
            Vaults
          </Link>
          <Link 
            href="/history" 
            className={`hover:text-white transition-colors ${pathname === '/history' ? 'text-white font-bold' : ''}`}
          >
            History
          </Link>
          <Link 
            href="/rewards" 
            className={`hover:text-white transition-colors ${pathname === '/rewards' ? 'text-white font-bold' : ''}`}
          >
            Rewards
          </Link>
          <Link 
            href="/leaderboard" 
            className={`hover:text-white transition-colors ${pathname === '/leaderboard' ? 'text-white font-bold' : ''}`}
          >
            Leaderboard
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {!contractConfigured() && (
          <div className="text-sm text-brand font-bold bg-brand/20 px-3 py-1 rounded">
            Contract Not Configured
          </div>
        )}
        <div className="text-sm text-muted">Testnet</div>
        <ConnectWallet {...wallet} />
      </div>
    </header>
  );
}
