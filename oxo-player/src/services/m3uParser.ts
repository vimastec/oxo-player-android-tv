/**
 * M3U Parser Service
 * Optimisé pour les grosses playlists (50+ Mo) et compatible Smart TV
 * - Utilise Web Worker si disponible (ne bloque pas l'UI)
 * - Fallback synchrone pour les TV sans support Worker
 * - Stockage IndexedDB pour cache persistant
 */

import type { LiveChannel, VODInfo, SeriesInfo, Category, SeriesEpisodesMap, M3UEpisode } from '../types';
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
  seriesEpisodes: SeriesEpisodesMap;
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

// Keywords pour détecter le type de contenu (TOUT EN MAJUSCULES pour la comparaison)
// IMPORTANT: Le pattern d'URL Xtream est le plus fiable pour la détection
const VOD_URL_PATTERNS = [
  '/MOVIE/',    // Xtream Codes standard: /movie/username/password/id.ext
  '/MOVIES/',
];

const SERIES_URL_PATTERNS = [
  '/SERIES/',   // Xtream Codes standard: /series/username/password/id.ext
];

const VOD_KEYWORDS = [
  'VOD', 'FILM', 'FILMS', 'MOVIE', 'MOVIES',
  'CINEMA', 'CINÉMA', 'CINE', 'CINÉ',
  'PELICULAS', 'PELICULA',
  '| FR FILMS', '| FILMS', '|FILMS', '|FR FILMS',
  'FR FILMS', 'AR FILMS', 'EN FILMS', 'US FILMS',
  'ARABIC MOVIES', 'FRENCH MOVIES', 'ENGLISH MOVIES',
  'ACTION FILMS', 'HORROR FILMS', 'COMEDY FILMS',
  'DOCUMENTAIRE', 'DOCUMENTARY',
  'أفلام', 'فيلم',  // Arabic: films
];

const SERIES_KEYWORDS = [
  'SERIES', 'SÉRIE', 'SÉRIES', 'SERIE', 
  'EPISODE', 'ÉPISODE', 'EPISODES',
  'S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9',
  'SAISON', 'SEASON',
  '| FR SERIES', '| SERIES', '|SERIES', '|FR SERIES',
  'FR SERIES', 'AR SERIES', 'EN SERIES', 'US SERIES',
  'ARABIC SERIES', 'FRENCH SERIES', 'ENGLISH SERIES',
  'TV SHOWS', 'TVSHOWS', 'SHOWS',
  'مسلسلات', 'مسلسل',  // Arabic: series
  '电视剧', '剧集',
];

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
 * Détecte le type de contenu basé sur l'URL et le groupe
 * Priorité: 1) Patterns URL Xtream, 2) Keywords dans groupe, 3) Keywords dans URL
 */
function detectContentType(url: string, group: string, name: string = ''): 'live' | 'movie' | 'series' {
  const upperUrl = url.toUpperCase();
  const upperGroup = group.toUpperCase();
  const upperName = name.toUpperCase();

  // 1) PRIORITÉ HAUTE: Patterns d'URL Xtream Codes (le plus fiable)
  // Ces patterns sont standard dans les playlists IPTV Xtream
  if (SERIES_URL_PATTERNS.some(pattern => upperUrl.includes(pattern))) {
    return 'series';
  }
  if (VOD_URL_PATTERNS.some(pattern => upperUrl.includes(pattern))) {
    return 'movie';
  }

  // 2) Vérifier les keywords dans le nom de groupe
  if (SERIES_KEYWORDS.some(kw => upperGroup.includes(kw))) {
    return 'series';
  }
  if (VOD_KEYWORDS.some(kw => upperGroup.includes(kw))) {
    return 'movie';
  }

  // 3) Vérifier les patterns dans le nom du contenu (pour les séries avec S01E01, etc.)
  // Regex pour détecter les patterns de séries comme S01E01, S1E1, etc.
  const seriesPattern = /S\d{1,2}\s*E\d{1,2}|SEASON\s*\d|SAISON\s*\d|EP\s*\d{1,3}/i;
  if (seriesPattern.test(upperName)) {
    return 'series';
  }

  // 4) Vérifier les extensions de fichiers vidéo typiques des VOD
  const vodExtensions = ['.MKV', '.MP4', '.AVI', '.MOV', '.M4V'];
  if (vodExtensions.some(ext => upperUrl.endsWith(ext))) {
    // Si c'est un fichier vidéo avec extension, c'est probablement un VOD ou série
    // On vérifie si ça ressemble à un épisode de série
    if (seriesPattern.test(upperName) || seriesPattern.test(upperGroup)) {
      return 'series';
    }
    return 'movie';
  }

  // Par défaut: live TV
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
 * Extrait le numéro de saison et d'épisode depuis le nom
 */
function extractEpisodeInfo(name: string): { seasonNum: number; episodeNum: number; cleanName: string } {
  // Patterns courants: S01E01, S1E1, S01 E01, Season 1 Episode 1, etc.
  const patterns = [
    /[Ss](\d{1,2})\s*[Ee](\d{1,3})/,           // S01E01, S1E1
    /[Ss]aison\s*(\d{1,2})\s*[Ee]p?\s*(\d{1,3})/i,  // Saison 1 Ep 1
    /[Ss]eason\s*(\d{1,2})\s*[Ee]p?\s*(\d{1,3})/i,  // Season 1 Ep 1
    /(\d{1,2})x(\d{1,3})/,                     // 1x01
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      const cleanName = name
        .replace(pattern, '')
        .replace(/\s*-?\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        seasonNum: parseInt(match[1], 10),
        episodeNum: parseInt(match[2], 10),
        cleanName: cleanName || name.split(/[Ss]\d/)[0].trim(),
      };
    }
  }
  
  // Si pas de pattern trouvé, essayer d'extraire juste un numéro d'épisode
  const epMatch = name.match(/[Ee]p(?:isode)?\s*(\d{1,3})/i);
  if (epMatch) {
    return {
      seasonNum: 1,
      episodeNum: parseInt(epMatch[1], 10),
      cleanName: name.replace(/[Ee]p(?:isode)?\s*\d{1,3}/i, '').trim(),
    };
  }
  
  return { seasonNum: 1, episodeNum: 1, cleanName: name };
}

/**
 * Convertit les canaux M3U en format SeriesInfo + épisodes
 */
function m3uToSeries(channels: M3UChannel[]): { series: SeriesInfo[]; episodes: SeriesEpisodesMap } {
  // Grouper les épisodes par série (basé sur le nom avant les patterns S01E01, etc.)
  const seriesMap = new Map<string, { channels: M3UChannel[]; episodeInfos: { seasonNum: number; episodeNum: number }[] }>();
  
  channels.forEach((channel) => {
    const { seasonNum, episodeNum, cleanName } = extractEpisodeInfo(channel.name);
    
    // Utiliser le nom nettoyé ou le group-title comme nom de série
    let seriesName = cleanName;
    if (!seriesName || seriesName.length < 2) {
      seriesName = channel.group || 'Unknown Series';
    }
    
    if (!seriesMap.has(seriesName)) {
      seriesMap.set(seriesName, { channels: [], episodeInfos: [] });
    }
    seriesMap.get(seriesName)!.channels.push(channel);
    seriesMap.get(seriesName)!.episodeInfos.push({ seasonNum, episodeNum });
  });

  const seriesList: SeriesInfo[] = [];
  const episodesMap: SeriesEpisodesMap = {};

  Array.from(seriesMap.entries()).forEach(([name, data], idx) => {
    const seriesId = idx + 20000; // Offset pour éviter les conflits
    
    // Créer l'objet SeriesInfo
    seriesList.push({
      num: idx + 1,
      name,
      series_id: seriesId,
      cover: data.channels[0]?.logo || '',
      plot: '',
      cast: '',
      director: '',
      genre: data.channels[0]?.group || '',
      releaseDate: '',
      last_modified: new Date().toISOString(),
      rating: '',
      rating_5based: 0,
      backdrop_path: [],
      youtube_trailer: '',
      episode_run_time: '',
      category_id: data.channels[0]?.group || '',
    });

    // Créer les épisodes regroupés par saison
    episodesMap[seriesId] = {};
    
    data.channels.forEach((channel, epIdx) => {
      const { seasonNum, episodeNum } = data.episodeInfos[epIdx];
      const seasonKey = seasonNum.toString();
      
      if (!episodesMap[seriesId][seasonKey]) {
        episodesMap[seriesId][seasonKey] = [];
      }
      
      const episode: M3UEpisode = {
        id: `${seriesId}_${seasonNum}_${episodeNum}_${epIdx}`,
        seriesId,
        seriesName: name,
        episodeNum,
        seasonNum,
        title: channel.name,
        url: channel.url,
        logo: channel.logo,
        container_extension: channel.url.split('.').pop() || 'mp4',
      };
      
      episodesMap[seriesId][seasonKey].push(episode);
    });

    // Trier les épisodes par numéro
    Object.keys(episodesMap[seriesId]).forEach((seasonKey) => {
      episodesMap[seriesId][seasonKey].sort((a, b) => a.episodeNum - b.episodeNum);
    });
  });

  return { series: seriesList, episodes: episodesMap };
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
      
      const contentType = detectContentType(line, currentChannel.group || '', currentChannel.name || '');
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
        // URL patterns Xtream Codes (priorité haute)
        const VOD_URL_PATTERNS = ['/MOVIE/', '/MOVIES/'];
        const SERIES_URL_PATTERNS = ['/SERIES/'];
        
        const VOD_KEYWORDS = [
          'VOD', 'FILM', 'FILMS', 'MOVIE', 'MOVIES',
          'CINEMA', 'CINÉMA', 'CINE', 'CINÉ',
          'PELICULAS', 'PELICULA',
          '| FR FILMS', '| FILMS', '|FILMS', '|FR FILMS',
          'FR FILMS', 'AR FILMS', 'EN FILMS', 'US FILMS',
          'ARABIC MOVIES', 'FRENCH MOVIES', 'ENGLISH MOVIES',
          'ACTION FILMS', 'HORROR FILMS', 'COMEDY FILMS',
          'DOCUMENTAIRE', 'DOCUMENTARY',
          'أفلام', 'فيلم',
        ];
        const SERIES_KEYWORDS = [
          'SERIES', 'SÉRIE', 'SÉRIES', 'SERIE', 
          'EPISODE', 'ÉPISODE', 'EPISODES',
          'S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9',
          'SAISON', 'SEASON',
          '| FR SERIES', '| SERIES', '|SERIES', '|FR SERIES',
          'FR SERIES', 'AR SERIES', 'EN SERIES', 'US SERIES',
          'ARABIC SERIES', 'FRENCH SERIES', 'ENGLISH SERIES',
          'TV SHOWS', 'TVSHOWS', 'SHOWS',
          'مسلسلات', 'مسلسل',
          '电视剧', '剧集',
        ];
        
        const VOD_EXTENSIONS = ['.MKV', '.MP4', '.AVI', '.MOV', '.M4V'];
        const SERIES_PATTERN = /S\\d{1,2}\\s*E\\d{1,2}|SEASON\\s*\\d|SAISON\\s*\\d|EP\\s*\\d{1,3}/i;

        function detectContentType(url, group, name) {
          const upperUrl = url.toUpperCase();
          const upperGroup = group.toUpperCase();
          const upperName = (name || '').toUpperCase();
          
          // 1) Priorité: patterns URL Xtream
          if (SERIES_URL_PATTERNS.some(p => upperUrl.includes(p))) return 'series';
          if (VOD_URL_PATTERNS.some(p => upperUrl.includes(p))) return 'movie';
          
          // 2) Keywords dans groupe
          if (SERIES_KEYWORDS.some(kw => upperGroup.includes(kw))) return 'series';
          if (VOD_KEYWORDS.some(kw => upperGroup.includes(kw))) return 'movie';
          
          // 3) Pattern série dans le nom (S01E01, etc.)
          if (SERIES_PATTERN.test(upperName)) return 'series';
          
          // 4) Extension fichier vidéo
          if (VOD_EXTENSIONS.some(ext => upperUrl.endsWith(ext))) {
            if (SERIES_PATTERN.test(upperName) || SERIES_PATTERN.test(upperGroup)) return 'series';
            return 'movie';
          }
          
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
              const contentType = detectContentType(line, currentChannel.group || '', currentChannel.name || '');
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
  console.log(`✅ M3U Parsed in ${parseTime.toFixed(0)}ms:`);
  console.log(`   📺 Live TV: ${parsed.channels.length} channels`);
  console.log(`   🎬 Movies (VOD): ${parsed.movies.length} films`);
  console.log(`   📺 Series: ${parsed.series.length} series`);
  console.log(`   📂 Categories:`, {
    live: parsed.categories.live.length,
    vod: parsed.categories.vod.length,
    series: parsed.categories.series.length,
  });
  
  // Debug: Montrer quelques exemples de chaque type
  if (parsed.movies.length > 0) {
    console.log('   🎬 Sample movies:', parsed.movies.slice(0, 3).map(m => ({ name: m.name, group: m.group, url: m.url?.substring(0, 80) + '...' })));
  }
  if (parsed.series.length > 0) {
    console.log('   📺 Sample series:', parsed.series.slice(0, 3).map(s => ({ name: s.name, group: s.group, url: s.url?.substring(0, 80) + '...' })));
  }

  // Convertir au format de l'app
  const seriesData = m3uToSeries(parsed.series);
  
  const result: ParseResult = {
    channels: m3uToLiveChannels(parsed.channels),
    movies: m3uToMovies(parsed.movies),
    series: seriesData.series,
    seriesEpisodes: seriesData.episodes,
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
      seriesEpisodes: {}, // TODO: Charger depuis IndexedDB si disponible
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
