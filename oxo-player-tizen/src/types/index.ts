/**
 * Types partagés pour OXO Player Tizen
 */

// Navigation
export type AppSection = 'home' | 'live' | 'movies' | 'series' | 'settings';

// Playlist
export interface Channel {
  id: string;
  name: string;
  logo?: string;
  url: string;
  group?: string;
  epgId?: string;
}

export interface Category {
  id: string;
  name: string;
  channels: Channel[];
}

export interface Movie {
  id: number;
  name: string;
  poster?: string;
  backdrop?: string;
  plot?: string;
  rating?: number;
  year?: string;
  duration?: string;
  genre?: string;
  streamUrl: string;
  extension?: string;
}

export interface Series {
  id: number;
  name: string;
  poster?: string;
  backdrop?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  rating?: number;
  year?: string;
}

export interface Season {
  number: number;
  name: string;
  episodeCount: number;
}

export interface Episode {
  id: string;
  number: number;
  title: string;
  plot?: string;
  duration?: string;
  streamUrl: string;
}

// Player
export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

// Device
export interface DeviceInfo {
  macAddress: string;
  model: string;
  ip: string;
  status: 'trial' | 'active' | 'expired' | 'unregistered';
  daysRemaining: number;
  expirationDate?: string;
}



