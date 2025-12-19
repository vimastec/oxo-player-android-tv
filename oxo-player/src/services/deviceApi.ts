const API_URL = 'http://localhost:3000/api';

// Generate a pseudo-MAC address based on browser fingerprint
export function generateDeviceMac(): string {
  // Check if we already have a stored MAC
  let mac = localStorage.getItem('oxo_device_mac');
  
  if (!mac) {
    // Generate a pseudo-MAC using random values
    // In a real TV app, this would use the actual device MAC
    const segments = [];
    for (let i = 0; i < 6; i++) {
      const segment = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      segments.push(segment.toUpperCase());
    }
    mac = segments.join(':');
    localStorage.setItem('oxo_device_mac', mac);
  }
  
  return mac;
}

export interface DeviceStatus {
  registered: boolean;
  status: 'unregistered' | 'trial' | 'active' | 'expired';
  has_playlist: boolean;
  days_remaining: number;
  expiration_date?: string;
}

export interface DeviceRegistration {
  mac_address: string;
  status: string;
  trial_start?: string;
  activation_date?: string;
  expiration_date?: string;
  days_remaining: number;
  has_playlist: boolean;
}

export interface PlaylistData {
  mac_address: string;
  status: string;
  playlist_url?: string;
  playlist_content?: string;
  expiration_date?: string;
  error?: string;
  message?: string;
}

export async function registerDevice(macAddress: string, deviceInfo?: string): Promise<DeviceRegistration> {
  const response = await fetch(`${API_URL}/device/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mac_address: macAddress,
      device_info: deviceInfo || navigator.userAgent,
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to register device');
  }
  
  return response.json();
}

export async function getDeviceStatus(macAddress: string): Promise<DeviceStatus> {
  const response = await fetch(`${API_URL}/device/status/${macAddress.replace(/:/g, '')}`);
  
  if (!response.ok) {
    throw new Error('Failed to get device status');
  }
  
  return response.json();
}

export async function getPlaylist(macAddress: string): Promise<PlaylistData> {
  const response = await fetch(`${API_URL}/device/playlist/${macAddress.replace(/:/g, '')}`);
  
  const data = await response.json();
  
  if (!response.ok) {
    return {
      mac_address: macAddress,
      status: data.status || 'error',
      error: data.error,
      message: data.message,
    };
  }
  
  return data;
}

// Get playlist content via API proxy (solves CORS issues)
export async function getPlaylistContent(macAddress: string): Promise<string> {
  const response = await fetch(`${API_URL}/device/playlist/${macAddress.replace(/:/g, '')}/content`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to load playlist');
  }
  
  return response.text();
}

// Get the proxy URL for playlist
export function getPlaylistProxyUrl(macAddress: string): string {
  return `${API_URL}/device/playlist/${macAddress.replace(/:/g, '')}/content`;
}
