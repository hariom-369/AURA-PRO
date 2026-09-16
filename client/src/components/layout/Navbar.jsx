import React, { useState } from 'react';

export const Navbar = ({ user, cartCount = 0, wishlistCount = 0, onLogout }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <a href="/" className="flex items-center space-x-2">
          <span className="bg-indigo-600 text-white font-black text-xs px-2 py-1 rounded">PRO</span>
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">AURA</span>
        </a>

        {/* Global Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <input
            type="text"
            placeholder="Search products, brands, and categories..."
            className="w-full bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:border-indigo-500 rounded-full px-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none"
          />
        </div>

        {/* User Navigation Links */}
        <div className="flex items-center space-x-6">
          <a href="/cart" className="relative text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 font-medium text-sm flex items-center">
            Cart
            {cartCount > 0 && (
              <span className="ml-1.5 bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {cartCount}
              </span>
            )}
          </a>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none"
              >
                <span>{user.name}</span>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg py-1 z-50">
                  <a href="/account/profile" className="block px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">My Profile</a>
                  <a href="/account/orders" className="block px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">My Orders</a>
                  <a href="/account/addresses" className="block px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">Saved Addresses</a>
                  
                  {user.role === 'admin' && (
                    <a href="/admin" className="block px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800">Admin Studio</a>
                  )}

                  <button
                    onClick={onLogout}
                    className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-t border-zinc-100 dark:border-zinc-800"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a
              href="/login"
              className="bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 text-sm font-medium px-4 py-2 rounded-lg"
            >
              Sign In
            </a>
          )}
        </div>
      </div>
    </header>
  );
};