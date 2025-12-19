import type {
  XtreamCredentials,
  UserInfo,
  ServerInfo,
  Category,
  LiveChannel,
  VODInfo,
  SeriesInfo,
  SeriesDetails,
  EPGEntry,
} from '../types';

class XtreamAPI {
  private credentials: XtreamCredentials | null = null;
  private baseUrl: string = '';

  setCredentials(credentials: XtreamCredentials) {
    this.credentials = credentials;
    // Remove trailing slash if present
    this.baseUrl = credentials.server.replace(/\/$/, '');
  }

  private getApiUrl(action: string, params: Record<string, string> = {}): string {
    if (!this.credentials) throw new Error('Credentials not set');

    const queryParams = new URLSearchParams({
      username: this.credentials.username,
      password: this.credentials.password,
      ...params,
    });

    return `${this.baseUrl}/player_api.php?${queryParams.toString()}&action=${action}`;
  }

  async authenticate(): Promise<{ user_info: UserInfo; server_info: ServerInfo }> {
    if (!this.credentials) throw new Error('Credentials not set');

    const url = `${this.baseUrl}/player_api.php?username=${this.credentials.username}&password=${this.credentials.password}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Authentication failed');
    }

    const data = await response.json();
    
    if (data.user_info?.auth === 0) {
      throw new Error('Invalid credentials');
    }

    return data;
  }

  // Live TV
  async getLiveCategories(): Promise<Category[]> {
    const url = this.getApiUrl('get_live_categories');
    const response = await fetch(url);
    return response.json();
  }

  async getLiveStreams(categoryId?: string): Promise<LiveChannel[]> {
    const params = categoryId ? { category_id: categoryId } : {};
    const url = this.getApiUrl('get_live_streams', params);
    const response = await fetch(url);
    return response.json();
  }

  // VOD (Movies)
  async getVodCategories(): Promise<Category[]> {
    const url = this.getApiUrl('get_vod_categories');
    const response = await fetch(url);
    return response.json();
  }

  async getVodStreams(categoryId?: string): Promise<VODInfo[]> {
    const params = categoryId ? { category_id: categoryId } : {};
    const url = this.getApiUrl('get_vod_streams', params);
    const response = await fetch(url);
    return response.json();
  }

  async getVodInfo(vodId: number): Promise<any> {
    const url = this.getApiUrl('get_vod_info', { vod_id: vodId.toString() });
    const response = await fetch(url);
    return response.json();
  }

  // Series
  async getSeriesCategories(): Promise<Category[]> {
    const url = this.getApiUrl('get_series_categories');
    const response = await fetch(url);
    return response.json();
  }

  async getSeries(categoryId?: string): Promise<SeriesInfo[]> {
    const params = categoryId ? { category_id: categoryId } : {};
    const url = this.getApiUrl('get_series', params);
    const response = await fetch(url);
    return response.json();
  }

  async getSeriesInfo(seriesId: number): Promise<SeriesDetails> {
    const url = this.getApiUrl('get_series_info', { series_id: seriesId.toString() });
    const response = await fetch(url);
    return response.json();
  }

  // EPG
  async getEPG(streamId: number): Promise<{ epg_listings: EPGEntry[] }> {
    const url = this.getApiUrl('get_short_epg', { stream_id: streamId.toString() });
    const response = await fetch(url);
    return response.json();
  }

  async getFullEPG(streamId: number): Promise<{ epg_listings: EPGEntry[] }> {
    const url = this.getApiUrl('get_simple_data_table', { stream_id: streamId.toString() });
    const response = await fetch(url);
    return response.json();
  }

  // Stream URLs
  getLiveStreamUrl(streamId: number, format: string = 'm3u8'): string {
    if (!this.credentials) throw new Error('Credentials not set');
    return `${this.baseUrl}/live/${this.credentials.username}/${this.credentials.password}/${streamId}.${format}`;
  }

  getVodStreamUrl(streamId: number, extension: string = 'mp4'): string {
    if (!this.credentials) throw new Error('Credentials not set');
    return `${this.baseUrl}/movie/${this.credentials.username}/${this.credentials.password}/${streamId}.${extension}`;
  }

  getSeriesStreamUrl(streamId: number, extension: string = 'mp4'): string {
    if (!this.credentials) throw new Error('Credentials not set');
    return `${this.baseUrl}/series/${this.credentials.username}/${this.credentials.password}/${streamId}.${extension}`;
  }

  // Timeshift (for catchup/replay)
  getTimeshiftUrl(streamId: number, start: string, duration: string): string {
    if (!this.credentials) throw new Error('Credentials not set');
    return `${this.baseUrl}/timeshift/${this.credentials.username}/${this.credentials.password}/${duration}/${start}/${streamId}.ts`;
  }
}

export const xtreamApi = new XtreamAPI();
export default xtreamApi;




