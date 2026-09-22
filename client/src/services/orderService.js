import API from '../api/axios';

export const previewOrder = (payload) => API.post('/orders/preview', payload).then((r) => r.data.data);
export const createOrder = (payload) => API.post('/orders', payload).then((r) => r.data.data);
export const payForOrder = (orderId) => API.post(`/orders/${orderId}/pay`).then((r) => r.data.data);
export const getMyOrders = (params) => API.get('/orders/myorders', { params }).then((r) => r.data.data);
export const getOrderById = (id) => API.get(`/orders/${id}`).then((r) => r.data.data);
export const requestReturn = (id, reason) => API.post(`/orders/${id}/request-return`, { reason }).then((r) => r.data.data);
