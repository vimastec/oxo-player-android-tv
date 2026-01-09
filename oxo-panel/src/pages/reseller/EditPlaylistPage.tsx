import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { resellerApi } from '../../services/api';

interface Playlist {
  id: number;
  name: string;
  playlist_type: 'm3u' | 'xtream';
  playlist_url?: string;
  xtream_host?: string;
  xtream_username?: string;
  xtream_password?: string;
  epg_url?: string;
}

export function EditPlaylistPage() {
  const { mac, playlistId } = useParams<{ mac: string; playlistId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [playlist, setPlaylist] = useState<Playlist | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [epgUrl, setEpgUrl] = useState('');

  useEffect(() => {
    loadPlaylist();
  }, []);

  const loadPlaylist = async () => {
    if (!mac) return;
    try {
      const response = await resellerApi.getDevicePlaylists(mac);
      const found = response.data.playlists.find((p: Playlist) => p.id === Number(playlistId));
      if (found) {
        setPlaylist(found);
        setName(found.name || '');
        setPlaylistUrl(found.playlist_url || '');
        setHost(found.xtream_host || '');
        setUsername(found.xtream_username || '');
        setPassword(found.xtream_password || '');
        setEpgUrl(found.epg_url || '');
      } else {
        setError('Playlist non trouvée');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!mac || !playlistId || !playlist) return;
    setError('');
    setIsSaving(true);

    try {
      const data: any = { name };
      if (playlist.playlist_type === 'm3u') {
        data.playlist_url = playlistUrl;
      } else {
        data.host = host;
        data.username = username;
        data.password = password;
      }
      data.epg_url = epgUrl;

      await resellerApi.updateDevicePlaylist(mac, Number(playlistId), data);
      navigate(`/reseller/devices/${mac}/playlists`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header - Mobile optimized */}
      <div className="card !rounded-t-2xl !rounded-b-none border-b-0">
        <div className="flex items-center gap-4 -m-6 p-4">
            <button
              onClick={() => navigate(`/reseller/devices/${mac}/playlists`)}
              className="p-3 hover:bg-dark rounded-xl transition-colors flex-shrink-0"
              aria-label="Retour"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold">Edit Playlist</h1>
          </div>
        </div>

        {/* Content */}
        <div className="card !rounded-t-none !rounded-b-2xl !border-t-0">
          {error && (
            <div className="flex items-center gap-2 p-4 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-600">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {playlist && (
            <div className="space-y-6">
              {/* Type badge */}
              <div className="flex items-center gap-2">
                <span className={`badge ${
                  playlist.playlist_type === 'xtream' 
                    ? 'badge-info' 
                    : 'badge-success'
                }`}>
                  {playlist.playlist_type === 'xtream' ? 'Xtream Codes' : 'M3U Playlist'}
                </span>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Playlist Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-base"
                  placeholder="Enter playlist name"
                />
              </div>

              {/* M3U specific fields */}
              {playlist.playlist_type === 'm3u' && (
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    Playlist URL
                  </label>
                  <input
                    type="url"
                    value={playlistUrl}
                    onChange={(e) => setPlaylistUrl(e.target.value)}
                    className="font-mono text-base"
                    placeholder="http://example.com/playlist.m3u"
                  />
                </div>
              )}

              {/* Xtream specific fields */}
              {playlist.playlist_type === 'xtream' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      Server Host
                    </label>
                    <input
                      type="url"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      className="font-mono text-base"
                      placeholder="http://server.example.com:8080"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-muted mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="text-base"
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-muted mb-2">
                        Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="text-base"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* EPG URL */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  EPG URL (Optional)
                </label>
                <input
                  type="url"
                  value={epgUrl}
                  onChange={(e) => setEpgUrl(e.target.value)}
                  className="font-mono text-base"
                  placeholder="http://example.com/epg.xml"
                />
              </div>

              {/* Save button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !name}
                  className="btn btn-primary min-w-[140px] px-8 py-3 text-base"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'SAVE'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
  );
}

