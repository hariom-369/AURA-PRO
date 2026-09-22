import API from '../api/axios';

export const getProducts = (params) => API.get('/products', { params }).then((r) => r.data.data);
export const getProductBySlug = (slug) => API.get(`/products/${slug}`).then((r) => r.data.data);
