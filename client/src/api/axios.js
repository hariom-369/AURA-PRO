import axios from 'axios';
import { getToken } from '../utils/tokenStorage';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
});

// Automatically attach JWT token to every request if present — token may
// live in localStorage ("remember me") or sessionStorage (see tokenStorage.js).
API.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;