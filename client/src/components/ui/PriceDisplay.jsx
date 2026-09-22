export const PriceDisplay = ({ price, originalPrice, currency = '₹', className = '' }) => {
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
        {currency}
        {Number(price || 0).toLocaleString('en-IN')}
      </span>
      {originalPrice > price && (
        <span className="text-sm text-zinc-400 line-through">
          {currency}
          {Number(originalPrice).toLocaleString('en-IN')}
        </span>
      )}
    </div>
  );
};