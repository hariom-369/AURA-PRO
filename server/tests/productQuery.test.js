import { describe, it, expect } from 'vitest';
import { buildProductQuery } from '../utils/productQuery.js';

describe('buildProductQuery', () => {
  it('builds an empty query with default "newest" sort when no filters are given', () => {
    const { query, sort } = buildProductQuery({});
    expect(query).toEqual({});
    expect(sort).toEqual({ createdAt: -1 });
  });

  it('escapes regex special characters in category/brand so they cannot be used for ReDoS or injection', () => {
    const { query } = buildProductQuery({ category: 'Audio)(a+)+$' });
    // Should compile without throwing, and the pattern should be treated literally.
    expect(() => new RegExp(query.category.$regex)).not.toThrow();
    expect(query.category.$regex.source).toContain('\\)\\(a\\+\\)\\+\\$');
  });

  it('applies min/max price as a range on the legacy price field', () => {
    const { query } = buildProductQuery({ minPrice: 100, maxPrice: 500 });
    expect(query.price).toEqual({ $gte: 100, $lte: 500 });
  });

  it('maps sort keywords to the correct sort spec', () => {
    expect(buildProductQuery({ sort: 'price-low' }).sort).toEqual({ price: 1 });
    expect(buildProductQuery({ sort: 'price-high' }).sort).toEqual({ price: -1 });
    expect(buildProductQuery({ sort: 'rating' }).sort).toEqual({ rating: -1 });
  });

  it('ignores category "All" (treated as no filter)', () => {
    const { query } = buildProductQuery({ category: 'All' });
    expect(query.category).toBeUndefined();
  });
});
