import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';
import ProductCard from './ProductCard';

const product = {
  _id: 'p1',
  slug: 'test-product',
  name: 'Test Headphones',
  category: 'Audio',
  price: 999,
  originalPrice: 1299,
  rating: 4.5,
  numReviews: 12,
  stock: 5,
  images: ['https://example.com/img.jpg'],
};

describe('ProductCard', () => {
  it('renders product name, price, and rating', () => {
    render(<ProductCard product={product} />, { wrapper: AllProviders });
    expect(screen.getByText('Test Headphones')).toBeInTheDocument();
    expect(screen.getByText('₹999')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('shows "Out of stock" and disables add-to-cart when stock is 0', () => {
    render(<ProductCard product={{ ...product, stock: 0 }} />, { wrapper: AllProviders });
    expect(screen.getAllByText(/out of stock/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /unavailable/i })).toBeDisabled();
  });

  it('clicking "Add to Cart" flips the button to "Added!" without crashing (guest cart path)', async () => {
    render(<ProductCard product={product} />, { wrapper: AllProviders });
    const button = screen.getByRole('button', { name: /add to cart/i });
    fireEvent.click(button);
    expect(await screen.findByText('Added!')).toBeInTheDocument();
  });

  it('renders nothing when no product is given', () => {
    render(<ProductCard product={null} />, { wrapper: AllProviders });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
