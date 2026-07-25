'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground gap-4">
      <h2 className="text-2xl font-bold text-danger">Something went wrong!</h2>
      <p className="text-muted max-w-md text-center">
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="flex gap-4 mt-4">
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-panel border border-border rounded hover:bg-panel/80 transition-colors"
        >
          Try again
        </button>
        <Link 
          href="/" 
          className="px-4 py-2 bg-brand text-white font-semibold rounded hover:bg-brand/90 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
