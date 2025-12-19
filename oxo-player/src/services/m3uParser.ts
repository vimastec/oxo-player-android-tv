/**
 * M3U Parser Service
 * Optimisé pour les grosses playlists (50+ Mo) et compatible Smart TV
 * - Utilise Web Worker si disponible (ne bloque pas l'UI)
 * - Fallback synchrone pour les TV sans support Worker
 * - Stockage IndexedDB pour cache persistant
 */

import type { LiveChannel, VODInfo, SeriesInfo, Category } from '../types';
import { playlistDB } from './playlistDB';

// Types
interface M3UChannel {
  name: string;
  logo: string;
  group: string;
  url: string;
  tvgId?: string;
  tvgName?: string;
  type: 'live' | 'movie' | 'series';
}

interface ParseResult {
  channels: LiveChannel[];
  movies: VODInfo[];
  series: SeriesInfo[];
  categories: {
    live: Category[];
    vod: Category[];
    series: Category[];
  };
}

interface ParseProgress {
  percent: number;
  parsed: number;
  total: number;
}

type ProgressCallback = (progress: ParseProgress) => void;

// Keywords pour détecter le type de contenu
const VOD_KEYWORDS = ['/movie/', 'VOD', 'FILM', 'MOVIE'];
const SERIES_KEYWORDS = ['/series/', 'SERIES', 'SÉRIE', 'EPISODE', 'S0', 'S1', 'S2', 'E0', 'E1'];

/**
 * Vérifie si les Web Workers sont supportés
 */
function isWorkerSupported(): boolean {
  try {
    return typeof Worker !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Détecte le type de contenu
 */
function detectContentType(url: string, group: string): 'live' | 'movie' | 'series' {
  const upperUrl = url.toUpperCase();
  const upperGroup = group.toUpperCase();

  if (SERIES_KEYWORDS.some(kw => upperUrl.includes(kw) || upperGroup.includes(kw))) {
    return 'series';
  }
  if (VOD_KEYWORDS.some(kw => upperUrl.includes(kw) || upperGroup.includes(kw))) {
    return 'movie';
  }
  return 'live';
}

/**
 * Convertit les canaux M3U en format LiveChannel
 */
function m3uToLiveChannels(channels: M3UChannel[]): LiveChannel[] {
  return channels.map((channel, index) => ({
    num: index + 1,
    name: channel.name,
    stream_type: 'live',
    stream_id: index + 1,
    stream_icon: channel.logo,
    epg_channel_id: channel.tvgId || null,
    added: new Date().toISOString(),
    category_id: channel.group,
    custom_sid: '',
    tv_archive: 0,
    direct_source: channel.url,
    tv_archive_duration: 0,
  }));
}

/**
 * Convertit les canaux M3U en format VODInfo
 */
function m3uToMovies(channels: M3UChannel[]): VODInfo[] {
  return channels.map((channel, index) => ({
    num: index + 1,
    name: channel.name,
    stream_type: 'movie',
    stream_id: index + 10000, // Offset pour éviter les conflits d'ID
    stream_icon: channel.logo,
    rating: '',
    rating_5based: 0,
    added: new Date().toISOString(),
    category_id: channel.group,
    container_extension: channel.url.split('.').pop() || 'mp4',
    custom_sid: '',
    direct_source: channel.url,
  }));
}

/**
 * Convertit les canaux M3U en format SeriesInfo
 */
function m3uToSeries(channels: M3UChannel[]): SeriesInfo[] {
  // Grouper les épisodes par série (basé sur le nom avant les patterns S01E01, etc.)
  const seriesMap = new Map<string, M3UChannel[]>();
  
  channels.forEach((channel) => {
    // Extraire le nom de la série (sans numéro d'épisode)
    const seriesName = channel.name
      .replace(/\s*[Ss]\d+[Ee]\d+.*$/, '')
      .replace(/\s*-?\s*[Ee]pisode\s*\d+.*$/i, '')
      .replace(/\s*\(\d+\).*$/, '')
      .trim();
    
    if (!seriesMap.has(seriesName)) {
      seriesMap.set(seriesName, []);
    }
    seriesMap.get(seriesName)!.push(channel);
  });

  return Array.from(seriesMap.entries()).map(([name, episodes], idx) => ({
    num: idx + 1,
    name,
    series_id: idx + 20000, // Offset pour éviter les conflits
    cover: episodes[0]?.logo || '',
    plot: '',
    cast: '',
    director: '',
    genre: episodes[0]?.group || '',
    releaseDate: '',
    last_modified: new Date().toISOString(),
    rating: '',
    rating_5based: 0,
    backdrop_path: [],
    youtube_trailer: '',
    episode_run_time: '',
    category_id: episodes[0]?.group || '',
  }));
}

/**
 * Convertit les noms de catégories en objets Category
 */
function toCategories(names: string[]): Category[] {
  return names.map((name) => ({
    category_id: name,
    category_name: name,
    parent_id: 0,
  }));
}

/**
 * Parse M3U de manière synchrone (fallback pour TV sans Worker)
 */
function parseM3USynchronous(content: string, onProgress?: ProgressCallback): {
  channels: M3UChannel[];
  movies: M3UChannel[];
  series: M3UChannel[];
  categories: { live: string[]; vod: string[]; series: string[] };
} {
  const lines = content.split('\n');
  const totalLines = lines.length;
  
  const channels: M3UChannel[] = [];
  const movies: M3UChannel[] = [];
  const series: M3UChannel[] = [];
  
  const liveCategoriesSet = new Set<string>();
  const vodCategoriesSet = new Set<string>();
  const seriesCategoriesSet = new Set<string>();

  let currentChannel: Partial<M3UChannel> = {};
  let lastProgressUpdate = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Progress callback
    if (onProgress && i - lastProgressUpdate >= 5000) {
      lastProgressUpdate = i;
      onProgress({
        percent: Math.round((i / totalLines) * 100),
        parsed: i,
        total: totalLines,
      });
    }

    if (line.startsWith('#EXTINF:')) {
      const info = line.substring(8);
      
      const tvgIdMatch = info.match(/tvg-id="([^"]*)"/i);
      const tvgNameMatch = info.match(/tvg-name="([^"]*)"/i);
      const tvgLogoMatch = info.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = info.match(/group-title="([^"]*)"/i) || info.match(/group-title=([^,\s]+)/i);
      const nameMatch = info.match(/,\s*(.+)$/);

      currentChannel = {
        tvgId: tvgIdMatch?.[1] || '',
        tvgName: tvgNameMatch?.[1] || '',
        logo: tvgLogoMatch?.[1] || '',
        group: groupMatch?.[1]?.trim() || 'Autres',
        name: nameMatch?.[1]?.trim() || 'Unknown',
      };
    } else if (line && !line.startsWith('#') && currentChannel.name) {
      currentChannel.url = line;
      
      const contentType = detectContentType(line, currentChannel.group || '');
      currentChannel.type = contentType;

      const channel = currentChannel as M3UChannel;

      switch (contentType) {
        case 'live':
          channels.push(channel);
          if (channel.group) liveCategoriesSet.add(channel.group);
          break;
        case 'movie':
          movies.push(channel);
          if (channel.group) vodCategoriesSet.add(channel.group);
          break;
        case 'series':
          series.push(channel);
          if (channel.group) seriesCategoriesSet.add(channel.group);
          break;
      }

      currentChannel = {};
    }
  }

  return {
    channels,
    movies,
    series,
    categories: {
      live: Array.from(liveCategoriesSet).sort(),
      vod: Array.from(vodCategoriesSet).sort(),
      series: Array.from(seriesCategoriesSet).sort(),
    },
  };
}

/**
 * Parse M3U avec Web Worker (non-bloquant)
 */
async function parseM3UWithWorker(content: string, onProgress?: ProgressCallback): Promise<{
  channels: M3UChannel[];
  movies: M3UChannel[];
  series: M3UChannel[];
  categories: { live: string[]; vod: string[]; series: string[] };
}> {
  return new Promise((resolve, reject) => {
    try {
      // Créer le worker inline pour éviter les problèmes de chemin
      const workerCode = `
        const VOD_KEYWORDS = ['/movie/', 'VOD', 'FILM', 'MOVIE'];
        const SERIES_KEYWORDS = ['/series/', 'SERIES', 'SÉRIE', 'EPISODE', 'S0', 'S1', 'S2', 'E0', 'E1'];

        function detectContentType(url, group) {
          const upperUrl = url.toUpperCase();
          const upperGroup = group.toUpperCase();
          if (SERIES_KEYWORDS.some(kw => upperUrl.includes(kw) || upperGroup.includes(kw))) return 'series';
          if (VOD_KEYWORDS.some(kw => upperUrl.includes(kw) || upperGroup.includes(kw))) return 'movie';
          return 'live';
        }

        self.onmessage = function(e) {
          const content = e.data.content;
          const lines = content.split('\\n');
          const totalLines = lines.length;
          
          const channels = [];
          const movies = [];
          const series = [];
          const liveCategoriesSet = new Set();
          const vodCategoriesSet = new Set();
          const seriesCategoriesSet = new Set();

          let currentChannel = {};
          let lastProgressUpdate = 0;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (i - lastProgressUpdate >= 5000) {
              lastProgressUpdate = i;
              self.postMessage({
                type: 'progress',
                percent: Math.round((i / totalLines) * 100),
                parsed: i,
                total: totalLines,
              });
            }

            if (line.startsWith('#EXTINF:')) {
              const info = line.substring(8);
              const tvgIdMatch = info.match(/tvg-id="([^"]*)"/i);
              const tvgNameMatch = info.match(/tvg-name="([^"]*)"/i);
              const tvgLogoMatch = info.match(/tvg-logo="([^"]*)"/i);
              const groupMatch = info.match(/group-title="([^"]*)"/i) || info.match(/group-title=([^,\\s]+)/i);
              const nameMatch = info.match(/,\\s*(.+)$/);

              currentChannel = {
                tvgId: tvgIdMatch?.[1] || '',
                tvgName: tvgNameMatch?.[1] || '',
                logo: tvgLogoMatch?.[1] || '',
                group: groupMatch?.[1]?.trim() || 'Autres',
                name: nameMatch?.[1]?.trim() || 'Unknown',
              };
            } else if (line && !line.startsWith('#') && currentChannel.name) {
              currentChannel.url = line;
              const contentType = detectContentType(line, currentChannel.group || '');
              currentChannel.type = contentType;

              switch (contentType) {
                case 'live':
                  channels.push(currentChannel);
                  if (currentChannel.group) liveCategoriesSet.add(currentChannel.group);
                  break;
                case 'movie':
                  movies.push(currentChannel);
                  if (currentChannel.group) vodCategoriesSet.add(currentChannel.group);
                  break;
                case 'series':
                  series.push(currentChannel);
                  if (currentChannel.group) seriesCategoriesSet.add(currentChannel.group);
                  break;
              }
              currentChannel = {};
            }
          }

          self.postMessage({
            type: 'result',
            channels,
            movies,
            series,
            categories: {
              live: Array.from(liveCategoriesSet).sort(),
              vod: Array.from(vodCategoriesSet).sort(),
              series: Array.from(seriesCategoriesSet).sort(),
            },
          });
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        const data = e.data;
        
        if (data.type === 'progress' && onProgress) {
          onProgress(data);
        } else if (data.type === 'result') {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          resolve(data);
        } else if (data.type === 'error') {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          reject(new Error(data.message));
        }
      };

      worker.onerror = (error) => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(error);
      };

      worker.postMessage({ action: 'parse', content });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Parse une playlist M3U (détecte automatiquement le meilleur mode)
 */
export async function parseM3U(
  content: string,
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  console.log('Starting M3U parse, content size:', (content.length / 1024 / 1024).toFixed(2), 'MB');
  const startTime = performance.now();

  let parsed: {
    channels: M3UChannel[];
    movies: M3UChannel[];
    series: M3UChannel[];
    categories: { live: string[]; vod: string[]; series: string[] };
  };

  // Utiliser Web Worker si disponible et fichier > 1 Mo
  const useWorker = isWorkerSupported() && content.length > 1024 * 1024;

  if (useWorker) {
    console.log('Using Web Worker for parsing');
    try {
      parsed = await parseM3UWithWorker(content, onProgress);
    } catch (error) {
      console.warn('Worker failed, falling back to synchronous parsing:', error);
      parsed = parseM3USynchronous(content, onProgress);
    }
  } else {
    console.log('Using synchronous parsing');
    parsed = parseM3USynchronous(content, onProgress);
  }

  const parseTime = performance.now() - startTime;
  console.log(`Parsed in ${parseTime.toFixed(0)}ms:`, {
    channels: parsed.channels.length,
    movies: parsed.movies.length,
    series: parsed.series.length,
  });

  // Convertir au format de l'app
  const result: ParseResult = {
    channels: m3uToLiveChannels(parsed.channels),
    movies: m3uToMovies(parsed.movies),
    series: m3uToSeries(parsed.series),
    categories: {
      live: toCategories(parsed.categories.live),
      vod: toCategories(parsed.categories.vod),
      series: toCategories(parsed.categories.series),
    },
  };

  // Sauvegarder dans IndexedDB pour cache
  try {
    await playlistDB.init();
    if (playlistDB.isAvailable()) {
      await Promise.all([
        playlistDB.saveChannels(result.channels),
        playlistDB.saveMovies(result.movies),
        playlistDB.saveSeries(result.series),
        playlistDB.saveCategories(result.categories.live, 'live'),
        playlistDB.saveCategories(result.categories.vod, 'vod'),
        playlistDB.saveCategories(result.categories.series, 'series'),
        playlistDB.saveMetadata({
          lastUpdated: Date.now(),
          totalChannels: result.channels.length,
          totalMovies: result.movies.length,
          totalSeries: result.series.length,
        }),
      ]);
      console.log('Saved to IndexedDB');
    }
  } catch (error) {
    console.warn('Failed to save to IndexedDB:', error);
  }

  return result;
}

/**
 * Charge une playlist depuis une URL
 */
export async function loadM3UFromUrl(
  url: string,
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch M3U: ${response.status}`);
  }
  const content = await response.text();
  return parseM3U(content, onProgress);
}

/**
 * Charge une playlist depuis un fichier
 */
export async function loadM3UFromFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const result = await parseM3U(content, onProgress);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Charge depuis le cache IndexedDB si disponible
 */
export async function loadFromCache(): Promise<ParseResult | null> {
  try {
    await playlistDB.init();
    if (!playlistDB.isAvailable()) return null;

    const metadata = await playlistDB.getMetadata();
    if (!metadata) return null;

    const [channels, movies, series, liveCategories, vodCategories, seriesCategories] = await Promise.all([
      playlistDB.getAllChannels(),
      playlistDB.getAllMovies(),
      playlistDB.getAllSeries(),
      playlistDB.getCategoriesByType('live'),
      playlistDB.getCategoriesByType('vod'),
      playlistDB.getCategoriesByType('series'),
    ]);

    if (channels.length === 0 && movies.length === 0 && series.length === 0) {
      return null;
    }

    console.log('Loaded from IndexedDB cache:', {
      channels: channels.length,
      movies: movies.length,
      series: series.length,
    });

    return {
      channels,
      movies,
      series,
      categories: {
        live: liveCategories,
        vod: vodCategories,
        series: seriesCategories,
      },
    };
  } catch (error) {
    console.warn('Failed to load from cache:', error);
    return null;
  }
}

// Export pour compatibilité avec l'ancien code
export { m3uToLiveChannels, toCategories as m3uToCategories };
