/**
 * M3U Parser Web Worker
 * Parse les grosses playlists M3U (50+ Mo) sans bloquer l'UI
 * Compatible avec les Smart TV (fallback si Web Workers non supportés)
 */

// Types pour la communication avec le worker
export interface M3UChannel {
  name: string;
  logo: string;
  group: string;
  url: string;
  tvgId?: string;
  tvgName?: string;
  type: 'live' | 'movie' | 'series';
}

export interface ParseProgress {
  type: 'progress';
  parsed: number;
  total: number;
  percent: number;
}

export interface ParseResult {
  type: 'result';
  channels: M3UChannel[];
  movies: M3UChannel[];
  series: M3UChannel[];
  categories: {
    live: string[];
    vod: string[];
    series: string[];
  };
  stats: {
    totalLines: number;
    totalChannels: number;
    totalMovies: number;
    totalSeries: number;
    parseTime: number;
  };
}

export interface ParseError {
  type: 'error';
  message: string;
}

export type WorkerMessage = ParseProgress | ParseResult | ParseError;

// Keywords pour détecter le type de contenu
const VOD_KEYWORDS = ['/movie/', 'VOD', 'FILM', 'MOVIE'];
const SERIES_KEYWORDS = ['/series/', 'SERIES', 'SÉRIE', 'EPISODE', 'S0', 'S1', 'S2', 'E0', 'E1'];

/**
 * Détecte le type de contenu basé sur l'URL et le groupe
 */
function detectContentType(url: string, group: string): 'live' | 'movie' | 'series' {
  const upperUrl = url.toUpperCase();
  const upperGroup = group.toUpperCase();

  // Vérifier si c'est une série
  if (SERIES_KEYWORDS.some(kw => upperUrl.includes(kw) || upperGroup.includes(kw))) {
    return 'series';
  }

  // Vérifier si c'est un film/VOD
  if (VOD_KEYWORDS.some(kw => upperUrl.includes(kw) || upperGroup.includes(kw))) {
    return 'movie';
  }

  // Par défaut, c'est du live
  return 'live';
}

/**
 * Parse le contenu M3U de manière optimisée
 */
function parseM3UContent(content: string): ParseResult {
  const startTime = performance.now();
  
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

    // Envoyer la progression toutes les 5000 lignes
    if (i - lastProgressUpdate >= 5000) {
      lastProgressUpdate = i;
      const progress: ParseProgress = {
        type: 'progress',
        parsed: i,
        total: totalLines,
        percent: Math.round((i / totalLines) * 100),
      };
      self.postMessage(progress);
    }

    if (line.startsWith('#EXTINF:')) {
      // Parse channel info
      const info = line.substring(8);
      
      // Extract attributes using regex
      const tvgIdMatch = info.match(/tvg-id="([^"]*)"/i);
      const tvgNameMatch = info.match(/tvg-name="([^"]*)"/i);
      const tvgLogoMatch = info.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = info.match(/group-title="([^"]*)"/i) || info.match(/group-title=([^,\s]+)/i);
      
      // Extract name (after the last comma)
      const nameMatch = info.match(/,\s*(.+)$/);

      currentChannel = {
        tvgId: tvgIdMatch?.[1] || '',
        tvgName: tvgNameMatch?.[1] || '',
        logo: tvgLogoMatch?.[1] || '',
        group: groupMatch?.[1]?.trim() || 'Autres',
        name: nameMatch?.[1]?.trim() || 'Unknown',
      };
    } else if (line && !line.startsWith('#') && currentChannel.name) {
      // This is the URL line
      currentChannel.url = line;
      
      // Detect content type
      const contentType = detectContentType(line, currentChannel.group || '');
      currentChannel.type = contentType;

      const channel = currentChannel as M3UChannel;

      // Add to appropriate array and category set
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

  const parseTime = performance.now() - startTime;

  const result: ParseResult = {
    type: 'result',
    channels,
    movies,
    series,
    categories: {
      live: Array.from(liveCategoriesSet).sort(),
      vod: Array.from(vodCategoriesSet).sort(),
      series: Array.from(seriesCategoriesSet).sort(),
    },
    stats: {
      totalLines,
      totalChannels: channels.length,
      totalMovies: movies.length,
      totalSeries: series.length,
      parseTime,
    },
  };

  return result;
}

// Event listener pour les messages du thread principal
self.onmessage = (event: MessageEvent) => {
  const { action, content } = event.data;

  if (action === 'parse') {
    try {
      const result = parseM3UContent(content);
      self.postMessage(result);
    } catch (error) {
      const errorMessage: ParseError = {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown parsing error',
      };
      self.postMessage(errorMessage);
    }
  }
};

// Export pour TypeScript (sera ignoré dans le worker)
export {};

