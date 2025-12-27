/**
 * PlaylistDB - Stockage IndexedDB pour les grosses playlists
 * Permet de stocker des playlists de 50+ Mo sans les limitations de localStorage
 * Optimisé pour les Smart TV (quota limité)
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { LiveChannel, VODInfo, SeriesInfo, Category } from '../types';

// Schema de la base de données
interface PlaylistDBSchema extends DBSchema {
  channels: {
    key: number;
    value: LiveChannel;
    indexes: { 'by-category': string };
  };
  movies: {
    key: number;
    value: VODInfo;
    indexes: { 'by-category': string };
  };
  series: {
    key: number;
    value: SeriesInfo;
    indexes: { 'by-category': string };
  };
  categories: {
    key: string;
    value: Category & { type: 'live' | 'vod' | 'series' };
    indexes: { 'by-type': string };
  };
  metadata: {
    key: string;
    value: {
      lastUpdated: number;
      totalChannels: number;
      totalMovies: number;
      totalSeries: number;
      playlistUrl?: string;
    };
  };
}

const DB_NAME = 'oxo-player-db';
const DB_VERSION = 1;

class PlaylistDB {
  private db: IDBPDatabase<PlaylistDBSchema> | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialise la base de données IndexedDB
   */
  async init(): Promise<void> {
    if (this.db) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    try {
      this.db = await openDB<PlaylistDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Store pour les chaînes live
          if (!db.objectStoreNames.contains('channels')) {
            const channelStore = db.createObjectStore('channels', { keyPath: 'stream_id' });
            channelStore.createIndex('by-category', 'category_id');
          }

          // Store pour les films
          if (!db.objectStoreNames.contains('movies')) {
            const movieStore = db.createObjectStore('movies', { keyPath: 'stream_id' });
            movieStore.createIndex('by-category', 'category_id');
          }

          // Store pour les séries
          if (!db.objectStoreNames.contains('series')) {
            const seriesStore = db.createObjectStore('series', { keyPath: 'series_id' });
            seriesStore.createIndex('by-category', 'category_id');
          }

          // Store pour les catégories
          if (!db.objectStoreNames.contains('categories')) {
            const categoryStore = db.createObjectStore('categories', { keyPath: 'category_id' });
            categoryStore.createIndex('by-type', 'type');
          }

          // Store pour les métadonnées
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata');
          }
        },
      });
      console.log('PlaylistDB initialized');
    } catch (error) {
      console.error('Failed to initialize PlaylistDB:', error);
      // Fallback: on continue sans IndexedDB (utilisera le store en mémoire)
      this.db = null;
    }
  }

  /**
   * Vérifie si IndexedDB est disponible
   */
  isAvailable(): boolean {
    return this.db !== null;
  }

  // =====================
  // CHANNELS (Live TV)
  // =====================

  /**
   * Sauvegarde les chaînes par batch (optimisé pour les grosses playlists)
   */
  async saveChannels(channels: LiveChannel[]): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('channels', 'readwrite');
    const store = tx.objectStore('channels');

    // Clear existing channels
    await store.clear();

    // Insert by batches of 1000 for performance
    const batchSize = 1000;
    for (let i = 0; i < channels.length; i += batchSize) {
      const batch = channels.slice(i, i + batchSize);
      await Promise.all(batch.map(channel => store.put(channel)));
    }

    await tx.done;
    console.log(`Saved ${channels.length} channels to IndexedDB`);
  }

  /**
   * Récupère toutes les chaînes
   */
  async getAllChannels(): Promise<LiveChannel[]> {
    if (!this.db) return [];
    return this.db.getAll('channels');
  }

  /**
   * Récupère les chaînes par catégorie
   */
  async getChannelsByCategory(categoryId: string): Promise<LiveChannel[]> {
    if (!this.db) return [];
    return this.db.getAllFromIndex('channels', 'by-category', categoryId);
  }

  /**
   * Récupère le nombre de chaînes
   */
  async getChannelCount(): Promise<number> {
    if (!this.db) return 0;
    return this.db.count('channels');
  }

  /**
   * Récupère une plage de chaînes (pour la virtualisation)
   */
  async getChannelsRange(start: number, count: number): Promise<LiveChannel[]> {
    if (!this.db) return [];
    
    const tx = this.db.transaction('channels', 'readonly');
    const store = tx.objectStore('channels');
    const channels: LiveChannel[] = [];
    
    let cursor = await store.openCursor();
    let skipped = 0;
    
    while (cursor && channels.length < count) {
      if (skipped >= start) {
        channels.push(cursor.value);
      } else {
        skipped++;
      }
      cursor = await cursor.continue();
    }
    
    return channels;
  }

  // =====================
  // MOVIES (VOD)
  // =====================

  async saveMovies(movies: VODInfo[]): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('movies', 'readwrite');
    const store = tx.objectStore('movies');
    await store.clear();

    const batchSize = 1000;
    for (let i = 0; i < movies.length; i += batchSize) {
      const batch = movies.slice(i, i + batchSize);
      await Promise.all(batch.map(movie => store.put(movie)));
    }

    await tx.done;
    console.log(`Saved ${movies.length} movies to IndexedDB`);
  }

  async getAllMovies(): Promise<VODInfo[]> {
    if (!this.db) return [];
    return this.db.getAll('movies');
  }

  async getMoviesByCategory(categoryId: string): Promise<VODInfo[]> {
    if (!this.db) return [];
    return this.db.getAllFromIndex('movies', 'by-category', categoryId);
  }

  async getMovieCount(): Promise<number> {
    if (!this.db) return 0;
    return this.db.count('movies');
  }

  // =====================
  // SERIES
  // =====================

  async saveSeries(series: SeriesInfo[]): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('series', 'readwrite');
    const store = tx.objectStore('series');
    await store.clear();

    const batchSize = 1000;
    for (let i = 0; i < series.length; i += batchSize) {
      const batch = series.slice(i, i + batchSize);
      await Promise.all(batch.map(s => store.put(s)));
    }

    await tx.done;
    console.log(`Saved ${series.length} series to IndexedDB`);
  }

  async getAllSeries(): Promise<SeriesInfo[]> {
    if (!this.db) return [];
    return this.db.getAll('series');
  }

  async getSeriesByCategory(categoryId: string): Promise<SeriesInfo[]> {
    if (!this.db) return [];
    return this.db.getAllFromIndex('series', 'by-category', categoryId);
  }

  async getSeriesCount(): Promise<number> {
    if (!this.db) return 0;
    return this.db.count('series');
  }

  // =====================
  // CATEGORIES
  // =====================

  async saveCategories(categories: Category[], type: 'live' | 'vod' | 'series'): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction('categories', 'readwrite');
    const store = tx.objectStore('categories');

    // Ne pas clear, juste ajouter/mettre à jour
    for (const cat of categories) {
      await store.put({ ...cat, type });
    }

    await tx.done;
  }

  async getCategoriesByType(type: 'live' | 'vod' | 'series'): Promise<Category[]> {
    if (!this.db) return [];
    const categories = await this.db.getAllFromIndex('categories', 'by-type', type);
    return categories.map(({ type: _, ...cat }) => cat as Category);
  }

  // =====================
  // METADATA
  // =====================

  async saveMetadata(metadata: PlaylistDBSchema['metadata']['value']): Promise<void> {
    if (!this.db) return;
    await this.db.put('metadata', metadata, 'playlist');
  }

  async getMetadata(): Promise<PlaylistDBSchema['metadata']['value'] | undefined> {
    if (!this.db) return undefined;
    return this.db.get('metadata', 'playlist');
  }

  // =====================
  // UTILITIES
  // =====================

  /**
   * Efface toutes les données
   */
  async clearAll(): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction(['channels', 'movies', 'series', 'categories', 'metadata'], 'readwrite');
    await Promise.all([
      tx.objectStore('channels').clear(),
      tx.objectStore('movies').clear(),
      tx.objectStore('series').clear(),
      tx.objectStore('categories').clear(),
      tx.objectStore('metadata').clear(),
    ]);
    await tx.done;
    console.log('PlaylistDB cleared');
  }

  /**
   * Recherche dans les chaînes (optimisé)
   */
  async searchChannels(query: string, limit = 100): Promise<LiveChannel[]> {
    if (!this.db || !query) return [];
    
    const lowerQuery = query.toLowerCase();
    const results: LiveChannel[] = [];
    
    const tx = this.db.transaction('channels', 'readonly');
    let cursor = await tx.store.openCursor();
    
    while (cursor && results.length < limit) {
      if (cursor.value.name.toLowerCase().includes(lowerQuery)) {
        results.push(cursor.value);
      }
      cursor = await cursor.continue();
    }
    
    return results;
  }

  /**
   * Recherche dans les films
   */
  async searchMovies(query: string, limit = 100): Promise<VODInfo[]> {
    if (!this.db || !query) return [];
    
    const lowerQuery = query.toLowerCase();
    const results: VODInfo[] = [];
    
    const tx = this.db.transaction('movies', 'readonly');
    let cursor = await tx.store.openCursor();
    
    while (cursor && results.length < limit) {
      if (cursor.value.name.toLowerCase().includes(lowerQuery)) {
        results.push(cursor.value);
      }
      cursor = await cursor.continue();
    }
    
    return results;
  }

  /**
   * Recherche dans les séries
   */
  async searchSeries(query: string, limit = 100): Promise<SeriesInfo[]> {
    if (!this.db || !query) return [];
    
    const lowerQuery = query.toLowerCase();
    const results: SeriesInfo[] = [];
    
    const tx = this.db.transaction('series', 'readonly');
    let cursor = await tx.store.openCursor();
    
    while (cursor && results.length < limit) {
      if (cursor.value.name.toLowerCase().includes(lowerQuery)) {
        results.push(cursor.value);
      }
      cursor = await cursor.continue();
    }
    
    return results;
  }
}

// Export singleton instance
export const playlistDB = new PlaylistDB();
export default playlistDB;

