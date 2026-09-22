import API from '../api/axios';

export const adminListSellers = (params) => API.get('/admin/sellers', { params }).then((r) => r.data.data);
export const adminGetSeller = (id) => API.get(`/admin/sellers/${id}`).then((r) => r.data.data);
export const adminGetSellerDocumentUrl = (id, docId) =>
  API.get(`/admin/sellers/${id}/documents/${docId}/url`).then((r) => r.data.data);
export const adminUpdateSellerStatus = (id, payload) =>
  API.patch(`/admin/sellers/${id}/status`, payload).then((r) => r.data.data);
