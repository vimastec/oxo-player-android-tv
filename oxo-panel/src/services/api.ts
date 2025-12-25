import axios from 'axios';

const API_URL = 'https://oxo-api-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('oxo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('oxo_token');
      localStorage.removeItem('oxo_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  me: () => api.get('/auth/me'),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Admin
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  
  // Resellers
  getResellers: () => api.get('/admin/resellers'),
  createReseller: (data: { email: string; password: string; name: string; credits?: number }) =>
    api.post('/admin/resellers', data),
  updateReseller: (id: number, data: { name?: string; status?: string; password?: string }) =>
    api.put(`/admin/resellers/${id}`, data),
  deleteReseller: (id: number) => api.delete(`/admin/resellers/${id}`),
  addCredits: (id: number, amount: number, description?: string) =>
    api.post(`/admin/resellers/${id}/credits`, { amount, description }),
  
  // Devices
  getDevices: () => api.get('/admin/devices'),
  
  // Transactions
  getTransactions: () => api.get('/admin/transactions'),
  
  // Seller Contacts (public reseller list)
  getSellerContacts: () => api.get('/admin/seller-contacts'),
  createSellerContact: (data: { name: string; city: string; phone: string; email?: string; address?: string }) =>
    api.post('/admin/seller-contacts', data),
  updateSellerContact: (id: number, data: { name?: string; city?: string; phone?: string; email?: string; address?: string; is_active?: boolean }) =>
    api.put(`/admin/seller-contacts/${id}`, data),
  deleteSellerContact: (id: number) => api.delete(`/admin/seller-contacts/${id}`),
};

// Reseller
export const resellerApi = {
  dashboard: () => api.get('/reseller/dashboard'),
  
  // Devices
  getDevices: () => api.get('/reseller/devices'),
  activateDevice: (mac_address: string) =>
    api.post('/reseller/activate', { mac_address }),
  setPlaylistUrl: (mac: string, url: string) =>
    api.put(`/reseller/devices/${mac}/playlist-url`, { url }),
  setXtreamCredentials: (mac: string, host: string, username: string, password: string) =>
    api.put(`/reseller/devices/${mac}/xtream`, { host, username, password }),
  uploadPlaylist: (mac: string, file: File) => {
    const formData = new FormData();
    formData.append('playlist', file);
    return api.post(`/reseller/devices/${mac}/playlist`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // Transactions
  getTransactions: () => api.get('/reseller/transactions'),
};

export default api;
