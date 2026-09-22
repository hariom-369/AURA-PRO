import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';
import Cart from './Cart';

describe('Cart page', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows an empty state with no items (guest, nothing in localStorage)', async () => {
    render(<Cart />, { wrapper: AllProviders });
    await waitFor(() => expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /browse products/i })).toBeInTheDocument();
  });

  it('renders a guest-cart item from localStorage without crashing', async () => {
    localStorage.setItem(
      'aura_guest_cart',
      JSON.stringify([{ product: { _id: 'p1', name: 'Local Item', price: 50 }, quantity: 2, price: 50 }])
    );
    render(<Cart />, { wrapper: AllProviders });
    await waitFor(() => expect(screen.getByText('Local Item')).toBeInTheDocument());
    expect(screen.getByText('2')).toBeInTheDocument(); // quantity
  });
});
