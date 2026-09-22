import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AllProviders } from '../test/testUtils';
import Home from './Home';

vi.mock('../services/productService', () => ({
  getProducts: vi.fn(() =>
    Promise.resolve({
      products: [
        { _id: '1', slug: 'a', name: 'Product A', category: 'Audio', price: 100, stock: 3, images: [] },
        { _id: '2', slug: 'b', name: 'Product B', category: 'Wearables', price: 200, stock: 0, images: [] },
      ],
      pagination: { page: 1, limit: 24, total: 2, pages: 1 },
    })
  ),
}));

vi.mock('../services/aiService', () => ({
  semanticSearch: vi.fn(),
  getRecommendations: vi.fn(() => Promise.resolve({ products: [] })),
}));

describe('Home page', () => {
  it('loads and renders products from the API', async () => {
    render(<Home />, { wrapper: AllProviders });

    await waitFor(() => {
      expect(screen.getByText('Product A')).toBeInTheDocument();
      expect(screen.getByText('Product B')).toBeInTheDocument();
    });

    // Category pills derived from the loaded products
    expect(screen.getByRole('button', { name: 'Audio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wearables' })).toBeInTheDocument();
  });

  it('renders the AI search box and hero copy', async () => {
    render(<Home />, { wrapper: AllProviders });
    expect(screen.getByPlaceholderText(/comfortable shoes/i)).toBeInTheDocument();
    expect(screen.getByText(/next-gen hardware/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Product A')).toBeInTheDocument());
  });
});
