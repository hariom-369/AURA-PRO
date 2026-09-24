import API from '../api/axios';

export const register = (payload) => API.post('/auth/register', payload).then((r) => r.data.data);
export const login = (payload) => API.post('/auth/login', payload).then((r) => r.data.data);
export const googleAuth = (idToken) => API.post('/auth/google', { idToken }).then((r) => r.data.data);
export const linkGoogleAccount = (idToken) => API.post('/auth/me/link-google', { idToken }).then((r) => r.data.data);
export const forgotPassword = (payload) => API.post('/auth/forgot-password', payload).then((r) => r.data.data);
export const resetPassword = (payload) => API.post('/auth/reset-password', payload).then((r) => r.data.data);
export const changePassword = (payload) => API.post('/auth/change-password', payload).then((r) => r.data.data);

export const updateProfile = (payload) => API.patch('/auth/me', payload).then((r) => r.data.data);
export const uploadAvatar = (file) => {
  const formData = new FormData();
  formData.append('avatar', file);
  return API.post('/auth/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(
    (r) => r.data.data
  );
};
