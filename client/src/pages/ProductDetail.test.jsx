import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';
import ProductDetail from './ProductDetail';

const product = {
  _id: 'p1',
  slug: 'test-product',
  name: 'Test Product',
  category: 'Audio',
  description: 'A great product.',
  price: 500,
  originalPrice: 600,
  discountPercentage: 17,
  stock: 10,
  rating: 4.2,
  numReviews: 5,
  images: ['https://example.com/img.jpg'],
  specifications: [{ key: 'Weight', value: '200g' }],
};

vi.mock('../services/productService', () => ({
  getProductBySlug: vi.fn(() => Promise.resolve(product)),
}));

vi.mock('../services/reviewService', () => ({
  getProductReviews: vi.fn(() => Promise.resolve({ reviews: [], pagination: {} })),
  createReview: vi.fn(),
}));

vi.mock('../services/aiService', () => ({
  getSimilarProducts: vi.fn(() => Promise.resolve({ products: [] })),
  getBundle: vi.fn(() => Promise.resolve({ products: [], label: null })),
  getReviewSummary: vi.fn(() => Promise.resolve({ reviewCount: 0, summary: null, message: 'Not enough reviews yet.' })),
}));

vi.mock('../services/wishlistService', () => ({
  getWishlist: vi.fn(() => Promise.resolve({ products: [] })),
  toggleWishlistItem: vi.fn(),
}));

describe('ProductDetail page', () => {
  it('loads a product by slug and renders its details', async () => {
    render(<ProductDetail />, { wrapper: AllProviders });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Product' })).toBeInTheDocument());

    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.getByText('A great product.')).toBeInTheDocument();
    expect(screen.getByText('Weight')).toBeInTheDocument();
    expect(screen.getByText('200g')).toBeInTheDocument();
    expect(screen.getByText(/not enough reviews yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
  });

  it('quantity stepper increments and decrements without crashing', async () => {
    render(<ProductDetail />, { wrapper: AllProviders });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Test Product' })).toBeInTheDocument());

    const plus = screen.getByRole('button', { name: '+' });
    const minus = screen.getByRole('button', { name: '−' });

    expect(screen.getByText('1')).toBeInTheDocument();
    plus.click();
    expect(await screen.findByText('2')).toBeInTheDocument();
    minus.click();
    expect(await screen.findByText('1')).toBeInTheDocument();
  });
});
