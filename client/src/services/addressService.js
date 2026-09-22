import API from '../api/axios';

export const getAddresses = () => API.get('/addresses').then((r) => r.data.data);
export const createAddress = (payload) => API.post('/addresses', payload).then((r) => r.data.data);
