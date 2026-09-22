import API from '../api/axios';

export const getAnalyticsOverview = () => API.get('/admin/analytics/overview').then((r) => r.data.data);
export const getLowStockProducts = () => API.get('/admin/products/low-stock').then((r) => r.data.data);

export const adminListOrders = (params) => API.get('/orders/admin/all', { params }).then((r) => r.data.data);
export const adminUpdateOrderStatus = (id, payload) =>
  API.patch(`/orders/admin/${id}/status`, payload).then((r) => r.data.data);
export const adminApproveReturn = (id) => API.post(`/orders/admin/${id}/approve-return`).then((r) => r.data.data);

export const adminCreateProduct = (payload) => API.post('/products', payload).then((r) => r.data.data);
export const adminUpdateProduct = (id, payload) => API.put(`/products/${id}`, payload).then((r) => r.data.data);
export const adminDeleteProduct = (id) => API.delete(`/products/${id}`).then((r) => r.data.data);
export const adminUploadProductImage = (id, file) => {
  const formData = new FormData();
  formData.append('image', file);
  return API.post(`/products/${id}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(
    (r) => r.data.data
  );
};

export const adminListUsers = (params) => API.get('/admin/users', { params }).then((r) => r.data.data);
export const adminUpdateUserRole = (id, role) => API.patch(`/admin/users/${id}/role`, { role }).then((r) => r.data.data);
export const adminUpdateUserStatus = (id, isActive) =>
  API.patch(`/admin/users/${id}/status`, { isActive }).then((r) => r.data.data);

export const adminListCoupons = (params) => API.get('/admin/coupons', { params }).then((r) => r.data.data);
export const adminCreateCoupon = (payload) => API.post('/admin/coupons', payload).then((r) => r.data.data);
export const adminUpdateCoupon = (id, payload) => API.patch(`/admin/coupons/${id}`, payload).then((r) => r.data.data);
export const adminDeleteCoupon = (id) => API.delete(`/admin/coupons/${id}`).then((r) => r.data.data);

export const getAiBusinessInsights = () => API.get('/ai/admin/insights').then((r) => r.data.data);
