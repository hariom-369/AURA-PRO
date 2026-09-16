import React, { useState } from 'react';

const ProductCard = ({ product, onAddToCart, onCartUpdated }) => {
  const [added, setAdded] = useState(false);

  if (!product) return null;

  const imageUrl =
    product.primaryImage ||
    product.image ||
    (product.images && product.images[0]) ||
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=1000&auto=format&fit=crop';

  const handleCartClick = (e) => {
    e.stopPropagation();

    // 1. Retrieve current cart from localStorage
    const savedCart = JSON.parse(localStorage.getItem('aura_cart') || '[]');
    const productId = product._id || product.id;

    // 2. Check if product exists; increment quantity or append
    const existingIndex = savedCart.findIndex(
      (item) => (item._id || item.id) === productId
    );

    if (existingIndex > -1) {
      savedCart[existingIndex].quantity = (savedCart[existingIndex].quantity || 1) + 1;
    } else {
      savedCart.push({ ...product, quantity: 1 });
    }

    // 3. Persist to localStorage
    localStorage.setItem('aura_cart', JSON.stringify(savedCart));

    // 4. Trigger visual feedback on button
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);

    // 5. Notify parent components & trigger global event for Navbar
    const handler = onAddToCart || onCartUpdated;
    if (handler) {
      handler(savedCart);
    }
    window.dispatchEvent(new Event('cartUpdated'));
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div 
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md"
      style={{ 
        border: '1px solid #e5e7eb', 
        borderRadius: '12px', 
        overflow: 'hidden', 
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      {/* Strictly Bounded Image Wrapper */}
      <div 
        style={{ 
          width: '100%', 
          height: '220px', 
          overflow: 'hidden', 
          position: 'relative', 
          backgroundColor: '#f3f4f6' 
        }}
      >
        <img
          src={imageUrl}
          alt={product.name || 'Product'}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover', 
            objectPosition: 'center',
            display: 'block' 
          }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src =
              'https://images.unsplash.com/photo-1560343090-f0409e92791a?q=80&w=1000&auto=format&fit=crop';
          }}
        />
        {product.category && (
          <span 
            style={{ 
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.9)', 
              backdropFilter: 'blur(4px)',
              padding: '4px 10px', 
              borderRadius: '20px', 
              fontSize: '11px', 
              fontWeight: 600,
              color: '#374151', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {product.category}
          </span>
        )}
      </div>

      {/* Product Details */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
        <div>
          <h3 
            style={{ 
              margin: '0 0 6px 0', 
              fontSize: '16px', 
              fontWeight: 600, 
              color: '#111827',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {product.name}
          </h3>
          {product.description && (
            <p 
              style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                margin: '0 0 14px 0',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: '1.4'
              }}
            >
              {product.description}
            </p>
          )}
        </div>

        {/* Action Bar with Price & Indigo/Blue Add to Cart Button */}
        <div 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: 'auto', 
            paddingTop: '12px', 
            borderTop: '1px solid #f3f4f6' 
          }}
        >
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
            ${product.price}
          </span>

          <button
            onClick={handleCartClick}
            title="Add to Cart"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: added ? '#10b981' : '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseOver={(e) => {
              if (!added) e.currentTarget.style.backgroundColor = '#4f46e5';
            }}
            onMouseOut={(e) => {
              if (!added) e.currentTarget.style.backgroundColor = '#6366f1';
            }}
          >
            <svg 
              width="15" 
              height="15" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {added ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </>
              )}
            </svg>
            <span>{added ? 'Added!' : 'Add to Cart'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export { ProductCard };
export default ProductCard;