'use client';
import { useRef, useEffect } from 'react';
import { DECIMALS } from '@/lib/constants';

interface PnLShareCardProps {
  asset: string;
  isLong: boolean;
  leverage: number;
  entryPrice: number;
  pnlUsd: number;
  onClose: () => void;
}

export default function PnLShareCard({ asset, isLong, leverage, entryPrice, pnlUsd, onClose }: PnLShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isProfit = pnlUsd >= 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas size
    canvas.width = 1080;
    canvas.height = 1080;

    // Draw Background
    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (isProfit) {
      bgGradient.addColorStop(0, '#022c22');
      bgGradient.addColorStop(1, '#052e16');
    } else {
      bgGradient.addColorStop(0, '#450a0a');
      bgGradient.addColorStop(1, '#1e1b1b');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Decorative Borders & Glass Overlay
    ctx.strokeStyle = isProfit ? '#10b981' : '#ef4444';
    ctx.lineWidth = 12;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    // Header Logo/Text
    ctx.font = 'bold 50px "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('EQUINOX DEX', 80, 140);
    
    ctx.font = '30px "Inter", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('CROSS-MARGIN DECENTRALIZED PERPETUALS', 80, 190);

    // Asset & Direction
    ctx.font = 'bold 80px "Inter", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${asset}-USDC`, 80, 360);

    // Direction Badge
    const dirText = `${leverage}X ${isLong ? 'LONG' : 'SHORT'}`;
    ctx.font = 'bold 45px "Inter", sans-serif';
    const textWidth = ctx.measureText(dirText).width;
    
    ctx.fillStyle = isProfit ? '#065f46' : '#7f1d1d';
    ctx.fillRect(80, 410, textWidth + 60, 70);
    ctx.fillStyle = isProfit ? '#34d399' : '#f87171';
    ctx.fillText(dirText, 110, 460);

    // Entry Price
    ctx.font = '40px "Inter", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`ENTRY PRICE: $${(entryPrice / DECIMALS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 580);

    // Huge PnL Display
    ctx.font = 'bold 150px "Inter", sans-serif';
    ctx.fillStyle = isProfit ? '#10b981' : '#ef4444';
    const sign = isProfit ? '+' : '-';
    // Let's just show the USD amount as a huge number, since ROE requires margin knowledge which we might not have perfectly here.
    ctx.fillText(`${sign}$${Math.abs(pnlUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 800);

    // Draw Footer
    ctx.font = '30px "Courier New", monospace';
    ctx.fillStyle = '#666666';
    ctx.fillText('Trade at equinoxdex.finance', 80, 980);
    
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString(), canvas.width - 80, 980);

  }, [asset, isLong, leverage, entryPrice, pnlUsd, isProfit]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `equinoxdex-pnl-${asset}.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-panel border border-border rounded-xl p-6 flex flex-col items-center max-w-lg w-full shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        
        <h3 className="text-xl font-bold text-white mb-6">Flex your PnL</h3>
        
        <div className="w-full aspect-square bg-black rounded-lg overflow-hidden border border-border shadow-inner mb-6 relative">
          <canvas 
            ref={canvasRef} 
            className="w-full h-full object-contain"
          ></canvas>
        </div>

        <button 
          onClick={handleDownload}
          className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3.5 rounded transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          Download Share Card
        </button>
      </div>
    </div>
  );
}
