import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://oxo-api-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface Captcha {
  captcha_id: string;
  captcha_image: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  device: {
    mac_address: string;
    device_key: string;
    status: string;
    expiration_date: string;
  };
}

export interface Playlist {
  id: number;
  name: string;
  playlist_type: 'm3u' | 'xtream';
  url: string;
  username?: string;
  password?: string;
  epg_url?: string;
  is_protected: boolean;
  is_active: boolean;
  created_at: string;
}

export interface DeviceInfo {
  mac_address: string;
  status: string;
  expiration_date: string;
  playlists: Playlist[];
}

export const portalApi = {
  // Get captcha
  getCaptcha: async (): Promise<Captcha> => {
    const response = await api.get('/portal/captcha');
    return response.data;
  },

  // Login
  login: async (
    mac_address: string,
    device_key: string,
    captcha_id: string,
    captcha_code: string
  ): Promise<LoginResponse> => {
    const response = await api.post('/portal/login', {
      mac_address,
      device_key,
      captcha_id,
      captcha_code,
    });
    return response.data;
  },

  // Get device info and playlists
  getDevice: async (mac_address: string, device_key: string): Promise<DeviceInfo> => {
    const response = await api.get(`/portal/device/${mac_address}`, {
      headers: { 'X-Device-Key': device_key },
    });
    return response.data;
  },

  // Add M3U playlist
  addPlaylist: async (
    mac_address: string,
    device_key: string,
    name: string,
    playlist_url: string,
    epg_url?: string,
    is_protected?: boolean,
    pin?: string
  ) => {
    const response = await api.post('/portal/playlists', {
      mac_address,
      device_key,
      name,
      playlist_url,
      epg_url,
      is_protected,
      pin,
    });
    return response.data;
  },

  // Add Xtream playlist
  addXtreamPlaylist: async (
    mac_address: string,
    device_key: string,
    name: string,
    host: string,
    username: string,
    password: string,
    epg_url?: string,
    is_protected?: boolean,
    pin?: string
  ) => {
    const response = await api.post('/portal/playlists/xtream', {
      mac_address,
      device_key,
      name,
      host,
      username,
      password,
      epg_url,
      is_protected,
      pin,
    });
    return response.data;
  },

  // Update playlist
  updatePlaylist: async (
    playlistId: number,
    mac_address: string,
    device_key: string,
    data: {
      name?: string;
      playlist_url?: string;
      host?: string;
      username?: string;
      password?: string;
      epg_url?: string;
      is_protected?: boolean;
      pin?: string;
      unlock_pin?: string;
    }
  ) => {
    const response = await api.put(`/portal/playlists/${playlistId}`, {
      mac_address,
      device_key,
      ...data,
    });
    return response.data;
  },

  // Delete playlist
  deletePlaylist: async (
    playlistId: number,
    mac_address: string,
    device_key: string,
    unlock_pin?: string
  ) => {
    const response = await api.delete(`/portal/playlists/${playlistId}`, {
      data: { mac_address, device_key, unlock_pin },
    });
    return response.data;
  },

  // Unlock protected playlist
  unlockPlaylist: async (
    playlistId: number,
    mac_address: string,
    device_key: string,
    pin: string
  ) => {
    const response = await api.post(`/portal/playlists/${playlistId}/unlock`, {
      mac_address,
      device_key,
      pin,
    });
    return response.data;
  },

  // Get list of approved sellers (public)
  getSellers: async (): Promise<SellerContact[]> => {
    const response = await api.get('/portal/sellers');
    return response.data;
  },
};

export interface SellerContact {
  id: number;
  name: string;
  city: string;
  phone: string;
  email: string | null;
  address: string | null;
}

export default api;

