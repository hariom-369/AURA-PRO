import API from '../api/axios';

export async function checkAIHealth() {
  try {
    const { data } = await API.get('/ai/health');
    return Boolean(data?.data?.available);
  } catch {
    return false;
  }
}

export async function semanticSearch(query, { page = 1, limit = 12 } = {}) {
  const { data } = await API.post('/ai/search', { query, page, limit });
  return data.data;
}

export async function sendChatMessage(messages) {
  const { data } = await API.post('/ai/chat', { messages });
  return data.data;
}

export async function compareProducts(productIds) {
  const { data } = await API.post('/ai/compare', { productIds });
  return data.data;
}

export async function getSimilarProducts(productId, limit = 6) {
  const { data } = await API.get(`/ai/products/${productId}/similar`, { params: { limit } });
  return data.data;
}

export async function getBundle(productId, limit = 4) {
  const { data } = await API.get(`/ai/products/${productId}/bundle`, { params: { limit } });
  return data.data;
}

export async function getReviewSummary(productId) {
  const { data } = await API.get(`/ai/products/${productId}/review-summary`);
  return data.data;
}

export async function getRecommendations({ recentlyViewedIds = [], cartProductIds = [], limit = 8 } = {}) {
  const { data } = await API.post('/ai/recommendations', { recentlyViewedIds, cartProductIds, limit });
  return data.data;
}

export async function generateProductDescription(productId) {
  const { data } = await API.post(`/ai/admin/products/${productId}/generate-description`);
  return data.data;
}

export async function approveProductDescription(productId) {
  const { data } = await API.post(`/ai/admin/products/${productId}/approve-description`);
  return data.data;
}
