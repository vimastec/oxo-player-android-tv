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
  
  // App Versions (OTA Updates)
  getAppVersions: () => api.get('/app-version'),
  createAppVersion: (data: { 
    versionCode: number; 
    versionName: string; 
    downloadUrl: string; 
    changelog?: string; 
    isMandatory?: boolean; 
    minSupportedVersion?: number 
  }) => api.post('/app-version', data),
  deleteAppVersion: (id: number) => api.delete(`/app-version/${id}`),
  
  // Resellers
  getResellers: () => api.get('/admin/resellers'),
  createReseller: (data: { email: string; password: string; name: string; credits?: number; allow_cross_reseller_activation?: boolean; can_create_subresellers?: boolean }) =>
    api.post('/admin/resellers', data),
  updateReseller: (id: number, data: { name?: string; status?: string; password?: string; allow_cross_reseller_activation?: boolean; can_create_subresellers?: boolean }) =>
    api.put(`/admin/resellers/${id}`, data),
  deleteReseller: (id: number) => api.delete(`/admin/resellers/${id}`),
  addCredits: (id: number, amount: number, description?: string) =>
    api.post(`/admin/resellers/${id}/credits`, { amount, description }),
  
  // Devices
  getDevices: () => api.get('/admin/devices'),
  updateDeviceStatus: (id: number, status: string) => api.put(`/admin/devices/${id}/status`, { status }),
  
  // Transactions
  getTransactions: () => api.get('/admin/transactions'),
  
  // Seller Contacts (public reseller list)
  getSellerContacts: () => api.get('/admin/seller-contacts'),
  createSellerContact: (data: { name: string; city: string; phone: string; email?: string; address?: string }) =>
    api.post('/admin/seller-contacts', data),
  updateSellerContact: (id: number, data: { name?: string; city?: string; phone?: string; email?: string; address?: string; is_active?: boolean }) =>
    api.put(`/admin/seller-contacts/${id}`, data),
  deleteSellerContact: (id: number) => api.delete(`/admin/seller-contacts/${id}`),
  
  // Seller Requests (people wanting to become resellers)
  getSellerRequests: () => api.get('/admin/seller-requests'),
  getSellerRequestsCount: () => api.get('/admin/seller-requests/count'),
  updateSellerRequest: (id: number, data: { status: string }) =>
    api.put(`/admin/seller-requests/${id}`, data),
  deleteSellerRequest: (id: number) => api.delete(`/admin/seller-requests/${id}`),
  
  // Xtream Hosts (for Top 10 service)
  getXtreamHosts: () => api.get('/admin/xtream-hosts'),
  createXtreamHost: (data: { host: string; name?: string; test_username?: string; test_password?: string }) =>
    api.post('/admin/xtream-hosts', data),
  updateXtreamHost: (id: number, data: { name?: string; test_username?: string; test_password?: string; is_active?: boolean }) =>
    api.put(`/admin/xtream-hosts/${id}`, data),
  deleteXtreamHost: (id: number) => api.delete(`/admin/xtream-hosts/${id}`),
  refreshXtreamHostTop10: (id: number) => api.post(`/admin/xtream-hosts/${id}/refresh`),
  refreshAllXtreamHostsTop10: () => api.post('/admin/xtream-hosts/refresh-all'),
};

// Reseller
export const resellerApi = {
  dashboard: () => api.get('/reseller/dashboard'),
  
  // Get current reseller info (including permissions)
  getMe: () => api.get('/reseller/me'),
  
  // Link Code - Get MAC address from link code
  checkLinkCode: (code: string) => api.get(`/reseller/link-code/${code}`),
  
  // Devices
  getDevices: () => api.get('/reseller/devices'),
  activateDevice: (mac_address: string, force_extend = false) =>
    api.post('/reseller/activate', { mac_address, force_extend }),
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
  
  // Multi-Playlist Management
  getDevicePlaylists: (mac: string) => 
    api.get(`/reseller/devices/${mac}/playlists`),
  addDeviceM3UPlaylist: (mac: string, name: string, playlist_url: string, epg_url?: string) =>
    api.post(`/reseller/devices/${mac}/playlists/m3u`, { name, playlist_url, epg_url }),
  addDeviceXtreamPlaylist: (mac: string, name: string, host: string, username: string, password: string, epg_url?: string) =>
    api.post(`/reseller/devices/${mac}/playlists/xtream`, { name, host, username, password, epg_url }),
  uploadDevicePlaylist: (mac: string, name: string, file: File, epg_url?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    if (epg_url) formData.append('epg_url', epg_url);
    return api.post(`/reseller/devices/${mac}/playlists/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  activateDevicePlaylist: (mac: string, playlistId: number) =>
    api.put(`/reseller/devices/${mac}/playlists/${playlistId}/activate`),
  updateDevicePlaylist: (mac: string, playlistId: number, data: { name?: string; playlist_url?: string; host?: string; username?: string; password?: string; epg_url?: string }) =>
    api.put(`/reseller/devices/${mac}/playlists/${playlistId}`, data),
  deleteDevicePlaylist: (mac: string, playlistId: number) =>
    api.delete(`/reseller/devices/${mac}/playlists/${playlistId}`),
  
  // Transactions
  getTransactions: () => api.get('/reseller/transactions'),
  
  // Sub-Resellers Management
  getSubResellers: () => api.get('/reseller/subresellers'),
  createSubReseller: (data: { email: string; password: string; name: string; credits?: number }) =>
    api.post('/reseller/subresellers', data),
  updateSubReseller: (id: number, data: { name?: string; password?: string; status?: string }) =>
    api.put(`/reseller/subresellers/${id}`, data),
  transferCreditsToSubReseller: (id: number, amount: number) =>
    api.post(`/reseller/subresellers/${id}/credits`, { amount }),
  deleteSubReseller: (id: number) => api.delete(`/reseller/subresellers/${id}`),
  getSubResellerTransactions: (id: number) => api.get(`/reseller/subresellers/${id}/transactions`),
};

export default api;