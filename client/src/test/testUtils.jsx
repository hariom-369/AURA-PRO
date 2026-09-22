import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';
import { SellerProvider } from '../context/SellerContext';
import { CartProvider } from '../context/CartContext';
import { CompareProvider } from '../context/CompareContext';

// Wraps a component with every real provider the app uses, so rendering it
// exercises the same context tree as production. No network mocking here —
// individual tests mock whichever service calls they actually trigger.
export function AllProviders({ children, initialEntries = ['/'] }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SellerProvider>
              <CartProvider>
                <CompareProvider>{children}</CompareProvider>
              </CartProvider>
            </SellerProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}
