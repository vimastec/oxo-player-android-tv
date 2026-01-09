/**
 * API OXO - Communication avec le serveur backend
 */

import { getDeviceMac, getDeviceModel } from './tizenApi';

// URL de l'API Railway
const API_URL = 'https://oxo-api-production.up.railway.app/api';

export interface DeviceStatus {
  registered: boolean;
  status: 'unregistered' | 'trial' | 'active' | 'expired';
  has_playlist: boolean;
  playlist_type?: string;
  days_remaining: number;
  expiration_date?: string;
}

export interface DeviceRegistration {
  mac_address: string;
  device_key?: string;
  status: string;
  trial_start?: string;
  activation_date?: string;
  expiration_date?: string;
  days_remaining: number;
  has_playlist: boolean;
  playlist_type?: string;
}

export interface PlaylistData {
  mac_address: string;
  status: string;
  playlist_type?: string;
  playlist_url?: string;
  playlist_content?: string;
  expiration_date?: string;
  xtream?: {
    host: string;
    username: string;
    password: string;
  };
  error?: string;
  message?: string;
}

export interface LinkCodeResponse {
  code: string;
  mac_address: string;
  expires_at: string;
  expires_in_seconds: number;
}

/**
 * Enregistre l'appareil sur le serveur OXO
 */
export async function registerDevice(): Promise<DeviceRegistration> {
  const macAddress = getDeviceMac();
  const deviceInfo = `Samsung TV - ${getDeviceModel()}`;
  
  const response = await fetch(`${API_URL}/device/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mac_address: macAddress,
      device_info: deviceInfo,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Échec de l\'enregistrement');
  }
  
  return response.json();
}

/**
 * Récupère le statut de l'appareil
 */
export async function getDeviceStatus(): Promise<DeviceStatus> {
  const macAddress = getDeviceMac().replace(/:/g, '');
  
  const response = await fetch(`${API_URL}/device/status/${macAddress}`);
  
  if (!response.ok) {
    throw new Error('Échec de récupération du statut');
  }
  
  return response.json();
}

/**
 * Récupère les informations de playlist
 */
export async function getPlaylist(): Promise<PlaylistData> {
  const macAddress = getDeviceMac().replace(/:/g, '');
  
  const response = await fetch(`${API_URL}/device/playlist/${macAddress}`);
  
  const data = await response.json();
  
  if (!response.ok) {
    return {
      mac_address: getDeviceMac(),
      status: data.status || 'error',
      error: data.error,
      message: data.message,
    };
  }
  
  return data;
}

/**
 * Récupère le contenu M3U de la playlist
 */
export async function getPlaylistContent(): Promise<string> {
  const macAddress = getDeviceMac().replace(/:/g, '');
  
  const response = await fetch(`${API_URL}/device/playlist/${macAddress}/content`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Échec du chargement de la playlist');
  }
  
  return response.text();
}

/**
 * Génère un code de liaison pour l'activation
 */
export async function generateLinkCode(): Promise<LinkCodeResponse> {
  const macAddress = getDeviceMac();
  
  const response = await fetch(`${API_URL}/device/link-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mac_address: macAddress }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Échec de génération du code');
  }
  
  return response.json();
}

/**
 * URL du proxy de stream (pour CORS)
 */
export function getStreamProxyUrl(streamUrl: string): string {
  return `${API_URL}/stream/proxy?url=${encodeURIComponent(streamUrl)}`;
}



