import React from 'react';

export const PriceDisplay = ({ price, originalPrice, currency = '$', className = '' }) => {
  return (
    <div className={`flex items-baseline space-x-2 ${className}`}>
      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
        {currency}{price?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
      {originalPrice > price && (
        <span className="text-sm text-zinc-400 line-through">
          {currency}{originalPrice?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      )}
    </div>
  );
};