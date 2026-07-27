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
            href="/leaderboard" 
            className={`hover:text-brand transition-colors flex items-center gap-1.5 ${pathname === '/leaderboard' ? 'text-brand font-bold' : ''}`}
          >
            <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
            </svg>
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
