import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground gap-4">
      <h2 className="text-3xl font-bold text-white">404 - Not Found</h2>
      <p className="text-muted">The page you are looking for does not exist.</p>
      <Link 
        href="/" 
        className="mt-4 px-6 py-2 bg-brand text-white font-semibold rounded hover:bg-brand/90 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
