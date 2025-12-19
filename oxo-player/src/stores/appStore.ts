import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  XtreamCredentials,
  UserInfo,
  ServerInfo,
  AppSection,
  Category,
  LiveChannel,
  VODInfo,
  SeriesInfo,
  PlaybackProgress,
  Favorite,
} from '../types';

interface AppStore {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  credentials: XtreamCredentials | null;
  userInfo: UserInfo | null;
  serverInfo: ServerInfo | null;

  // Navigation
  currentSection: AppSection;
  setCurrentSection: (section: AppSection) => void;

  // Categories
  liveCategories: Category[];
  vodCategories: Category[];
  seriesCategories: Category[];
  setLiveCategories: (categories: Category[]) => void;
  setVodCategories: (categories: Category[]) => void;
  setSeriesCategories: (categories: Category[]) => void;

  // Content
  liveChannels: LiveChannel[];
  movies: VODInfo[];
  series: SeriesInfo[];
  setLiveChannels: (channels: LiveChannel[]) => void;
  setMovies: (movies: VODInfo[]) => void;
  setSeries: (series: SeriesInfo[]) => void;

  // Connection actions
  setCredentials: (credentials: XtreamCredentials) => void;
  setUserInfo: (userInfo: UserInfo) => void;
  setServerInfo: (serverInfo: ServerInfo) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  disconnect: () => void;

  // Playback progress (resume feature)
  playbackProgress: { [key: string]: PlaybackProgress };
  updatePlaybackProgress: (key: string, progress: PlaybackProgress) => void;
  getPlaybackProgress: (key: string) => PlaybackProgress | null;
  clearPlaybackProgress: (key: string) => void;

  // Favorites
  favorites: Favorite[];
  addFavorite: (favorite: Favorite) => void;
  removeFavorite: (id: number, type: 'live' | 'movie' | 'series') => void;
  isFavorite: (id: number, type: 'live' | 'movie' | 'series') => boolean;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isConnected: false,
      isLoading: false,
      credentials: null,
      userInfo: null,
      serverInfo: null,
      currentSection: 'live',

      // Categories
      liveCategories: [],
      vodCategories: [],
      seriesCategories: [],

      // Content
      liveChannels: [],
      movies: [],
      series: [],

      // Playback progress
      playbackProgress: {},

      // Favorites
      favorites: [],

      // Search
      searchQuery: '',

      // Navigation
      setCurrentSection: (section) => set({ currentSection: section }),

      // Categories setters
      setLiveCategories: (categories) => set({ liveCategories: categories }),
      setVodCategories: (categories) => set({ vodCategories: categories }),
      setSeriesCategories: (categories) => set({ seriesCategories: categories }),

      // Content setters
      setLiveChannels: (channels) => set({ liveChannels: channels }),
      setMovies: (movies) => set({ movies: movies }),
      setSeries: (series) => set({ series: series }),

      // Connection actions
      setCredentials: (credentials) => set({ credentials }),
      setUserInfo: (userInfo) => set({ userInfo }),
      setServerInfo: (serverInfo) => set({ serverInfo }),
      setConnected: (connected) => set({ isConnected: connected }),
      setLoading: (loading) => set({ isLoading: loading }),

      disconnect: () =>
        set({
          isConnected: false,
          credentials: null,
          userInfo: null,
          serverInfo: null,
          liveCategories: [],
          vodCategories: [],
          seriesCategories: [],
          liveChannels: [],
          movies: [],
          series: [],
        }),

      // Playback progress
      updatePlaybackProgress: (key, progress) =>
        set((state) => ({
          playbackProgress: {
            ...state.playbackProgress,
            [key]: progress,
          },
        })),

      getPlaybackProgress: (key) => {
        const state = get();
        return state.playbackProgress[key] || null;
      },

      clearPlaybackProgress: (key) =>
        set((state) => {
          const newProgress = { ...state.playbackProgress };
          delete newProgress[key];
          return { playbackProgress: newProgress };
        }),

      // Favorites
      addFavorite: (favorite) =>
        set((state) => ({
          favorites: [...state.favorites, favorite],
        })),

      removeFavorite: (id, type) =>
        set((state) => ({
          favorites: state.favorites.filter(
            (f) => !(f.id === id && f.type === type)
          ),
        })),

      isFavorite: (id, type) => {
        const state = get();
        return state.favorites.some((f) => f.id === id && f.type === type);
      },

      // Search
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: 'oxo-player-storage',
      partialize: (state) => ({
        isConnected: state.isConnected,
        credentials: state.credentials,
        liveChannels: state.liveChannels,
        liveCategories: state.liveCategories,
        playbackProgress: state.playbackProgress,
        favorites: state.favorites,
      }),
    }
  )
);

