import API from '../api/axios';

export const updateProfile = (payload) => API.patch('/auth/me', payload).then((r) => r.data.data);
export const uploadAvatar = (file) => {
  const formData = new FormData();
  formData.append('avatar', file);
  return API.post('/auth/me/avatar', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(
    (r) => r.data.data
  );
};
