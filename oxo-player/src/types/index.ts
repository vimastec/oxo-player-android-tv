// Types pour l'application OXO Player

export interface XtreamCredentials {
  server: string;
  username: string;
  password: string;
}

export interface M3UPlaylist {
  url: string;
  name?: string;
}

export interface UserInfo {
  username: string;
  password: string;
  status: string;
  exp_date: string;
  is_trial: string;
  active_cons: string;
  created_at: string;
  max_connections: string;
  allowed_output_formats: string[];
}

export interface ServerInfo {
  url: string;
  port: string;
  https_port: string;
  server_protocol: string;
  rtmp_port: string;
  timezone: string;
  timestamp_now: number;
  time_now: string;
}

export interface Category {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface LiveChannel {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string | null;
  added: string;
  category_id: string;
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

export interface VODInfo {
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

export interface SeriesInfo {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  last_modified: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
}

export interface Episode {
  id: string;
  episode_num: number;
  title: string;
  container_extension: string;
  info: {
    duration_secs: number;
    duration: string;
    video: object;
    audio: object;
    bitrate: number;
  };
  custom_sid: string;
  added: string;
  season: number;
  direct_source: string;
}

export interface Season {
  season_number: number;
  name: string;
  episodes: Episode[];
}

export interface SeriesDetails {
  seasons: Season[];
  info: SeriesInfo;
  episodes: { [key: string]: Episode[] };
}

export interface EPGEntry {
  id: string;
  epg_id: string;
  title: string;
  lang: string;
  start: string;
  end: string;
  description: string;
  channel_id: string;
  start_timestamp: number;
  stop_timestamp: number;
}

export interface PlaybackProgress {
  streamId: number;
  streamType: 'live' | 'movie' | 'series';
  position: number; // en secondes
  duration: number; // en secondes
  lastWatched: number; // timestamp
  episodeInfo?: {
    seriesId: number;
    seasonNum: number;
    episodeNum: number;
  };
}

export interface Favorite {
  id: number;
  type: 'live' | 'movie' | 'series';
  name: string;
  icon: string;
  addedAt: number;
}

export interface SubtitleTrack {
  id: number;
  label: string;
  language: string;
  src?: string;
}

export interface AudioTrack {
  id: number;
  label: string;
  language: string;
}

export interface PlayerState {
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  playbackRate: number;
  selectedSubtitle: number | null;
  selectedAudio: number | null;
  quality: string;
  availableQualities: string[];
  subtitles: SubtitleTrack[];
  audioTracks: AudioTrack[];
}

export type AppSection = 'live' | 'movies' | 'series' | 'epg' | 'favorites' | 'settings';

export interface AppState {
  isConnected: boolean;
  isLoading: boolean;
  currentSection: AppSection;
  credentials: XtreamCredentials | null;
  userInfo: UserInfo | null;
  serverInfo: ServerInfo | null;
}




