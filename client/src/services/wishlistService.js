import API from '../api/axios';

export const getWishlist = () => API.get('/wishlist').then((r) => r.data.data);
export const toggleWishlistItem = (productId) =>
  API.post('/wishlist/toggle', { productId }).then((r) => r.data.data);
