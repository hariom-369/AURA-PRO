import API from '../api/axios';

export const verifySignupOtp = (payload) => API.post('/auth/verify-signup-otp', payload).then((r) => r.data.data);
export const verifyLoginOtp = (payload) => API.post('/auth/verify-login-otp', payload).then((r) => r.data.data);
export const resendOtp = (payload) => API.post('/auth/resend-otp', payload).then((r) => r.data.data);
export const forgotPassword = (email) => API.post('/auth/forgot-password', { email }).then((r) => r.data.data);
export const resetPassword = (payload) => API.post('/auth/reset-password', payload).then((r) => r.data.data);

export const updateProfile = (payload) => API.patch('/auth/me', payload).then((r) => r.data.data);
export const changePassword = (payload) => API.post('/auth/change-password', payload).then((r) => r.data.data);
export const uploadAvatar = (file) => {
  const formData = new FormData();
  formData.append('avatar', file);
  return API.post('/auth/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(
    (r) => r.data.data
  );
};
