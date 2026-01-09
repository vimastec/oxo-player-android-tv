/**
 * Store global de l'application (Zustand)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSection, Channel, Category, Movie, Series } from '../types';
import type { XtreamCredentials } from '../services/xtreamApi';

interface AppState {
  // Navigation
  currentSection: AppSection;
  setSection: (section: AppSection) => void;
  
  // Connexion
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
  
  // Device
  macAddress: string | null;
  deviceStatus: 'trial' | 'active' | 'expired' | 'unregistered';
  daysRemaining: number;
  expirationDate: string | null;
  setDeviceInfo: (info: {
    macAddress: string;
    status: 'trial' | 'active' | 'expired' | 'unregistered';
    daysRemaining: number;
    expirationDate?: string;
  }) => void;
  
  // Playlist type
  playlistType: 'm3u' | 'xtream';
  setPlaylistType: (type: 'm3u' | 'xtream') => void;
  
  // Xtream credentials
  xtreamCredentials: XtreamCredentials | null;
  setXtreamCredentials: (credentials: XtreamCredentials | null) => void;
  
  // M3U Data
  liveCategories: Category[];
  setLiveCategories: (categories: Category[]) => void;
  
  // VOD Data
  movies: Movie[];
  setMovies: (movies: Movie[]) => void;
  
  // Series Data
  series: Series[];
  setSeries: (series: Series[]) => void;
  
  // Current playback
  currentChannel: Channel | null;
  setCurrentChannel: (channel: Channel | null) => void;
  
  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Error
  error: string | null;
  setError: (error: string | null) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  currentSection: 'home' as AppSection,
  isConnected: false,
  macAddress: null,
  deviceStatus: 'unregistered' as const,
  daysRemaining: 0,
  expirationDate: null,
  playlistType: 'm3u' as const,
  xtreamCredentials: null,
  liveCategories: [],
  movies: [],
  series: [],
  currentChannel: null,
  isLoading: false,
  error: null,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...initialState,
      
      setSection: (section) => set({ currentSection: section }),
      
      setConnected: (connected) => set({ isConnected: connected }),
      
      setDeviceInfo: (info) => set({
        macAddress: info.macAddress,
        deviceStatus: info.status,
        daysRemaining: info.daysRemaining,
        expirationDate: info.expirationDate || null,
      }),
      
      setPlaylistType: (type) => set({ playlistType: type }),
      
      setXtreamCredentials: (credentials) => set({ xtreamCredentials: credentials }),
      
      setLiveCategories: (categories) => set({ liveCategories: categories }),
      
      setMovies: (movies) => set({ movies }),
      
      setSeries: (series) => set({ series }),
      
      setCurrentChannel: (channel) => set({ currentChannel: channel }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      reset: () => set(initialState),
    }),
    {
      name: 'oxo-player-storage',
      partialize: (state) => ({
        isConnected: state.isConnected,
        macAddress: state.macAddress,
        deviceStatus: state.deviceStatus,
        playlistType: state.playlistType,
        xtreamCredentials: state.xtreamCredentials,
      }),
    }
  )
);



