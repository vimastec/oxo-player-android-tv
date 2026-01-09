/**
 * Xtream Codes API
 * Pour les playlists de type Xtream
 */

export interface XtreamCredentials {
  host: string;
  username: string;
  password: string;
}

export interface XtreamUserInfo {
  username: string;
  password: string;
  status: string;
  exp_date: string;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface XtreamLiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface XtreamMovie {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  category_id: string;
  container_extension: string;
  custom_sid: string;
  direct_source: string;
}

export interface XtreamSeries {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  release_date: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
}

export interface XtreamSeriesInfo {
  seasons: Array<{
    air_date: string;
    episode_count: number;
    id: number;
    name: string;
    overview: string;
    season_number: number;
    cover: string;
  }>;
  info: {
    name: string;
    cover: string;
    plot: string;
    cast: string;
    director: string;
    genre: string;
    release_date: string;
    rating: string;
    backdrop_path: string[];
    youtube_trailer: string;
  };
  episodes: {
    [season: string]: Array<{
      id: string;
      episode_num: number;
      title: string;
      container_extension: string;
      info: {
        duration_secs: number;
        duration: string;
        plot: string;
        releasedate: string;
      };
      custom_sid: string;
      added: string;
      season: number;
      direct_source: string;
    }>;
  };
}

/**
 * Client Xtream API
 */
export class XtreamClient {
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor(credentials: XtreamCredentials) {
    // Nettoyer le host
    let host = credentials.host.trim();
    if (!host.startsWith('http')) {
      host = `http://${host}`;
    }
    if (host.endsWith('/')) {
      host = host.slice(0, -1);
    }
    
    this.baseUrl = host;
    this.username = credentials.username;
    this.password = credentials.password;
  }

  private async fetchApi<T>(action: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/player_api.php`);
    url.searchParams.set('username', this.username);
    url.searchParams.set('password', this.password);
    url.searchParams.set('action', action);
    
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Xtream API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Authentification et infos utilisateur
   */
  async authenticate(): Promise<{ user_info: XtreamUserInfo }> {
    const url = `${this.baseUrl}/player_api.php?username=${this.username}&password=${this.password}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Échec de l\'authentification Xtream');
    }
    
    return response.json();
  }

  /**
   * Catégories Live TV
   */
  async getLiveCategories(): Promise<XtreamCategory[]> {
    return this.fetchApi('get_live_categories');
  }

  /**
   * Chaînes Live TV
   */
  async getLiveStreams(categoryId?: string): Promise<XtreamLiveStream[]> {
    const params: Record<string, string> = {};
    if (categoryId) {
      params.category_id = categoryId;
    }
    return this.fetchApi('get_live_streams', params);
  }

  /**
   * Catégories VOD (Films)
   */
  async getVodCategories(): Promise<XtreamCategory[]> {
    return this.fetchApi('get_vod_categories');
  }

  /**
   * Films VOD
   */
  async getVodStreams(categoryId?: string): Promise<XtreamMovie[]> {
    const params: Record<string, string> = {};
    if (categoryId) {
      params.category_id = categoryId;
    }
    return this.fetchApi('get_vod_streams', params);
  }

  /**
   * Catégories Séries
   */
  async getSeriesCategories(): Promise<XtreamCategory[]> {
    return this.fetchApi('get_series_categories');
  }

  /**
   * Liste des séries
   */
  async getSeries(categoryId?: string): Promise<XtreamSeries[]> {
    const params: Record<string, string> = {};
    if (categoryId) {
      params.category_id = categoryId;
    }
    return this.fetchApi('get_series', params);
  }

  /**
   * Infos d'une série (saisons + épisodes)
   */
  async getSeriesInfo(seriesId: number): Promise<XtreamSeriesInfo> {
    return this.fetchApi('get_series_info', { series_id: seriesId.toString() });
  }

  /**
   * URL de stream Live TV
   */
  getLiveStreamUrl(streamId: number): string {
    return `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.ts`;
  }

  /**
   * URL de stream VOD (Film)
   */
  getVodStreamUrl(streamId: number, extension: string = 'mp4'): string {
    return `${this.baseUrl}/movie/${this.username}/${this.password}/${streamId}.${extension}`;
  }

  /**
   * URL de stream Série (épisode)
   */
  getSeriesStreamUrl(streamId: string, extension: string = 'mp4'): string {
    return `${this.baseUrl}/series/${this.username}/${this.password}/${streamId}.${extension}`;
  }
}

// Instance globale (sera initialisée après connexion)
let xtreamClient: XtreamClient | null = null;

export function initXtreamClient(credentials: XtreamCredentials): XtreamClient {
  xtreamClient = new XtreamClient(credentials);
  return xtreamClient;
}

export function getXtreamClient(): XtreamClient | null {
  return xtreamClient;
}

