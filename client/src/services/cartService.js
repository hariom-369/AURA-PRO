import API from '../api/axios';

export const getCart = () => API.get('/cart').then((r) => r.data.data);

// quantity is a signed delta: positive adds/increments, negative decrements
// (dropping to 0 or below removes the item), matching the backend contract.
export const adjustCartItem = (productId, quantity) =>
  API.post('/cart', { productId, quantity }).then((r) => r.data.data);

export const removeCartItem = (productId) => API.delete(`/cart/${productId}`).then((r) => r.data.data);
