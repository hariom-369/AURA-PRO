import API from '../api/axios';

// --- Onboarding ---
export const getSellerApplication = () => API.get('/seller/application').then((r) => r.data.data);
export const updateAccountStep = (payload) => API.patch('/seller/application/account', payload).then((r) => r.data.data);
export const updateBusinessStep = (payload) => API.patch('/seller/application/business', payload).then((r) => r.data.data);
export const updatePayoutStep = (payload) => API.patch('/seller/application/payout', payload).then((r) => r.data.data);
export const submitSellerApplication = () => API.post('/seller/application/submit').then((r) => r.data.data);

export const uploadVerificationDocument = (type, file) => {
  const formData = new FormData();
  formData.append('type', type);
  formData.append('document', file);
  return API.post('/seller/application/verification/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data.data);
};
export const deleteVerificationDocument = (docId) =>
  API.delete(`/seller/application/verification/documents/${docId}`).then((r) => r.data.data);
export const getOwnDocumentUrl = (docId) =>
  API.get(`/seller/application/verification/documents/${docId}/url`).then((r) => r.data.data);

// --- Store settings (post-approval) ---
export const getSellerStore = () => API.get('/seller/store').then((r) => r.data.data);
export const updateSellerStore = (payload) => API.put('/seller/store', payload).then((r) => r.data.data);

// --- Products ---
export const sellerListProducts = (params) => API.get('/seller/products', { params }).then((r) => r.data.data);
export const sellerCreateProduct = (payload) => API.post('/seller/products', payload).then((r) => r.data.data);
export const sellerUpdateProduct = (id, payload) => API.put(`/seller/products/${id}`, payload).then((r) => r.data.data);
export const sellerDeleteProduct = (id) => API.delete(`/seller/products/${id}`).then((r) => r.data.data);
export const sellerUploadProductImage = (id, file) => {
  const formData = new FormData();
  formData.append('image', file);
  return API.post(`/seller/products/${id}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(
    (r) => r.data.data
  );
};

// --- Orders ---
export const sellerListOrders = (params) => API.get('/seller/orders', { params }).then((r) => r.data.data);
export const sellerUpdateItemFulfillment = (orderId, itemId, status) =>
  API.patch(`/seller/orders/${orderId}/items/${itemId}/fulfillment`, { status }).then((r) => r.data.data);

// --- Analytics, transactions, reviews ---
export const getSellerAnalytics = () => API.get('/seller/analytics/overview').then((r) => r.data.data);
export const listSellerTransactions = (params) => API.get('/seller/transactions', { params }).then((r) => r.data.data);
export const listSellerReviews = (params) => API.get('/seller/reviews', { params }).then((r) => r.data.data);
