import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getCart, adjustCartItem, removeCartItem } from '../services/cartService';

const CartContext = createContext();

const GUEST_CART_KEY = 'aura_guest_cart';

function readGuestCart() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeGuestCart(items) {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // Non-fatal — the cart just won't persist across reloads for this guest.
  }
}

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadServerCart = useCallback(async () => {
    setLoading(true);
    try {
      const cart = await getCart();
      setItems(cart.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGuestCart = useCallback(() => {
    setItems(readGuestCart());
    setLoading(false);
  }, []);

  // On login, merge any guest-cart items into the server cart once, then
  // switch to server-backed mode. On logout, fall back to the local guest cart.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (user) {
        const guestItems = readGuestCart();
        if (guestItems.length > 0) {
          for (const item of guestItems) {
            const productId = item.product?._id || item.productId;
            if (!productId) continue;
            try {
              await adjustCartItem(productId, item.quantity || 1);
            } catch {
              // Best-effort merge — an individual item failing (e.g. now out of stock)
              // shouldn't block the rest of the merge or the cart from loading.
            }
          }
          writeGuestCart([]);
        }
        if (!cancelled) await loadServerCart();
      } else if (!cancelled) {
        loadGuestCart();
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [user, loadServerCart, loadGuestCart]);

  const addToCart = async (product, quantity = 1) => {
    setError(null);
    if (user) {
      try {
        const cart = await adjustCartItem(product._id, quantity);
        setItems(cart.items || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not add item to cart');
        throw err;
      }
    } else {
      const current = readGuestCart();
      const idx = current.findIndex((i) => i.product?._id === product._id);
      const next =
        idx > -1
          ? current.map((i, ix) => (ix === idx ? { ...i, quantity: i.quantity + quantity } : i))
          : [...current, { product, quantity, price: product.price }];
      writeGuestCart(next);
      setItems(next);
    }
  };

  const changeQuantity = async (productId, delta) => {
    setError(null);
    if (user) {
      try {
        const cart = await adjustCartItem(productId, delta);
        setItems(cart.items || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not update quantity');
        throw err;
      }
    } else {
      const next = readGuestCart()
        .map((i) => (i.product?._id === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0);
      writeGuestCart(next);
      setItems(next);
    }
  };

  const removeFromCart = async (productId) => {
    setError(null);
    if (user) {
      try {
        const cart = await removeCartItem(productId);
        setItems(cart.items || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not remove item');
        throw err;
      }
    } else {
      const next = readGuestCart().filter((i) => i.product?._id !== productId);
      writeGuestCart(next);
      setItems(next);
    }
  };

  const refreshCart = user ? loadServerCart : loadGuestCart;

  const itemCount = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const subtotal = items.reduce((sum, i) => sum + (i.price ?? i.product?.price ?? 0) * (i.quantity || 0), 0);

  return (
    <CartContext.Provider
      value={{ items, loading, error, itemCount, subtotal, addToCart, changeQuantity, removeFromCart, refreshCart, isGuest: !user }}
    >
      {children}
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- hook co-located with its Provider by design
export const useCart = () => useContext(CartContext);
