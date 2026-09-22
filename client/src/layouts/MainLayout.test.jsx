import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { AuthProvider } from '../context/AuthContext';
import { SellerProvider } from '../context/SellerContext';
import { CartProvider } from '../context/CartContext';
import { CompareProvider } from '../context/CompareContext';
import MainLayout from './MainLayout';

function TestPage() {
  return <div>Page Content</div>;
}

describe('MainLayout', () => {
  it('renders navbar, footer, page content, and the AI chat toggle together without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <SellerProvider>
                <CartProvider>
                  <CompareProvider>
                    <Routes>
                      <Route element={<MainLayout />}>
                        <Route path="/" element={<TestPage />} />
                      </Route>
                    </Routes>
                  </CompareProvider>
                </CartProvider>
              </SellerProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getAllByText('AURA').length).toBeGreaterThan(0); // Navbar + Footer
    expect(screen.getByText('Page Content')).toBeInTheDocument(); // Outlet
    expect(screen.getByText(/all rights reserved/i)).toBeInTheDocument(); // Footer
    expect(screen.getByLabelText(/ai shopping assistant/i)).toBeInTheDocument(); // ChatWidget toggle
  });
});
