import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentlyViewed, addRecentlyViewed } from './recentlyViewed';

describe('recentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('adds a product to the front of the list', () => {
    addRecentlyViewed({ _id: '1', name: 'A', slug: 'a', primaryImage: '', price: 10 });
    addRecentlyViewed({ _id: '2', name: 'B', slug: 'b', primaryImage: '', price: 20 });
    const list = getRecentlyViewed();
    expect(list.map((p) => p._id)).toEqual(['2', '1']);
  });

  it('deduplicates and moves a re-viewed product back to the front', () => {
    addRecentlyViewed({ _id: '1', name: 'A' });
    addRecentlyViewed({ _id: '2', name: 'B' });
    addRecentlyViewed({ _id: '1', name: 'A' });
    const list = getRecentlyViewed();
    expect(list.map((p) => p._id)).toEqual(['1', '2']);
  });

  it('caps the list at 20 items', () => {
    for (let i = 0; i < 25; i++) {
      addRecentlyViewed({ _id: String(i), name: `Product ${i}` });
    }
    expect(getRecentlyViewed().length).toBe(20);
  });
});
