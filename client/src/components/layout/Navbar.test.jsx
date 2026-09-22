import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AllProviders } from '../../test/testUtils';
import Navbar from './Navbar';

describe('Navbar', () => {
  it('renders the logo, search, cart link, and a sign-in link for a guest', () => {
    render(<Navbar />, { wrapper: AllProviders });
    expect(screen.getByText('AURA')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cart/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('toggles the theme without throwing', () => {
    render(<Navbar />, { wrapper: AllProviders });
    const themeButton = screen.getByLabelText(/toggle theme/i);
    expect(() => fireEvent.click(themeButton)).not.toThrow();
  });
});
