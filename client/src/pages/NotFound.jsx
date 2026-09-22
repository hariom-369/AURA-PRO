import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <span className="text-6xl font-black text-brand-500">404</span>
      <h1 className="mt-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/" className="mt-6 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white">
        Back to Home
      </Link>
    </div>
  );
}
