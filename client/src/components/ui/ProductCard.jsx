import React from 'react';
import { PriceDisplay } from './PriceDisplay';
import { Badge } from './Badge';

export const ProductCard = ({ product, onAddToCart, onToggleWishlist }) => {
  return (
    <div className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col h-full">
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img
          src={product.primaryImage}
          alt={product.name}
          className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => {
            e.target.src = 'https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=1000&auto=format&fit=crop';
          }}
        />
        {product.discountPercentage > 0 && (
          <div className="absolute top-3 left-3">
            <Badge variant="rose">-{product.discountPercentage}%</Badge>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider mb-1">
          {product.brand}
        </div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1 mb-2">
          {product.name}
        </h3>
        
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
          <PriceDisplay price={product.price} originalPrice={product.originalPrice} />
          <button
            onClick={() => onAddToCart(product)}
            className="p-2 text-zinc-700 hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400 font-medium text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
};