const KEY = 'aura_recently_viewed';
const MAX = 20;

export function getRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function addRecentlyViewed(product) {
  try {
    const current = getRecentlyViewed().filter((p) => p._id !== product._id);
    const next = [
      { _id: product._id, name: product.name, slug: product.slug, primaryImage: product.primaryImage, price: product.price },
      ...current,
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Non-fatal — recently-viewed just won't persist.
  }
}
