import API from '../api/axios';

export const getProductReviews = (productId, params) =>
  API.get(`/reviews/product/${productId}`, { params }).then((r) => r.data.data);
export const createReview = (payload) => API.post('/reviews', payload).then((r) => r.data.data);
export const deleteReview = (id) => API.delete(`/reviews/${id}`).then((r) => r.data.data);
