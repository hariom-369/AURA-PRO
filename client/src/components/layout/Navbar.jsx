import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useTheme } from '../../context/ThemeContext';
import { useSeller } from '../../context/SellerContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { status: sellerStatus } = useSeller();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?q=${encodeURIComponent(search.trim())}`);
    }
  };

  const handleLogout = () => {
    logout();
    setIsProfileOpen(false);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-brand-600 px-2 py-1 text-xs font-black text-white">PRO</span>
          <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            AURA<span className="text-brand-500">.</span>
          </span>
        </Link>

        <form onSubmit={handleSearchSubmit} className="hidden max-w-md flex-1 md:flex">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, brands, and categories..."
            className="w-full rounded-full border border-transparent bg-zinc-100 px-4 py-2 text-sm text-zinc-900 focus:border-brand-500 focus:outline-none dark:bg-zinc-900 dark:text-zinc-100"
          />
        </form>

        <div className="flex items-center gap-4 sm:gap-6">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user && (
            <Link
              to="/wishlist"
              className="hidden text-sm font-medium text-zinc-700 hover:text-brand-600 dark:text-zinc-300 dark:hover:text-brand-400 sm:block"
            >
              Wishlist
            </Link>
          )}

          <Link to="/cart" className="relative flex items-center text-sm font-medium text-zinc-700 hover:text-brand-600 dark:text-zinc-300 dark:hover:text-brand-400">
            Cart
            {itemCount > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">{itemCount}</span>
            )}
          </Link>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen((open) => !open)}
                className="flex items-center gap-2 text-sm font-medium text-zinc-900 focus:outline-none dark:text-zinc-100"
              >
                <span className="hidden sm:inline">{user.name}</span>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-600/20 dark:text-brand-300">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </span>
                )}
              </button>

              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                    <Link to="/account/profile" onClick={() => setIsProfileOpen(false)} className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      My Profile
                    </Link>
                    <Link to="/orders" onClick={() => setIsProfileOpen(false)} className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      My Orders
                    </Link>
                    <Link to="/wishlist" onClick={() => setIsProfileOpen(false)} className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:hidden">
                      Wishlist
                    </Link>
                    <Link to="/account/addresses" onClick={() => setIsProfileOpen(false)} className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      Saved Addresses
                    </Link>
                    {user.role === 'admin' && (
                      <Link to="/admin" onClick={() => setIsProfileOpen(false)} className="block px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-zinc-100 dark:text-brand-400 dark:hover:bg-zinc-800">
                        Admin Studio
                      </Link>
                    )}
                    <Link
                      to={sellerStatus === 'approved' ? '/seller' : sellerStatus ? '/sell/status' : '/sell'}
                      onClick={() => setIsProfileOpen(false)}
                      className="block px-4 py-2 text-sm font-semibold text-brand-600 hover:bg-zinc-100 dark:text-brand-400 dark:hover:bg-zinc-800"
                    >
                      {sellerStatus === 'approved' ? 'Seller Dashboard' : sellerStatus ? 'Seller Application' : 'Become a Seller'}
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full border-t border-zinc-100 px-4 py-2 text-left text-sm text-rose-600 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
