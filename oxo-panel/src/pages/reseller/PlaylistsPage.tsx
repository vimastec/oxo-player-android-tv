import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, CheckCircle, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { resellerApi } from '../../services/api';

interface Playlist {
  id: number;
  name: string;
  playlist_type: 'm3u' | 'xtream';
  playlist_url?: string;
  xtream_host?: string;
  xtream_username?: string;
  is_active: boolean;
}

export function PlaylistsPage() {
  const { mac } = useParams<{ mac: string }>();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    if (!mac) return;
    setError('');
    try {
      const response = await resellerApi.getDevicePlaylists(mac);
      setPlaylists(response.data.playlists);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async (id: number) => {
    if (!mac) return;
    try {
      await resellerApi.activateDevicePlaylist(mac, id);
      loadPlaylists();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
    }
  };

  const handleDelete = async (id: number) => {
    if (!mac || !confirm('Supprimer cette playlist ?')) return;
    try {
      await resellerApi.deleteDevicePlaylist(mac, id);
      loadPlaylists();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur');
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
    <div className="max-w-6xl mx-auto">
      {/* Header - Mobile optimized */}
      <div className="card !rounded-t-2xl !rounded-b-none border-b-0">
        <div className="-m-6 p-4">
            <h1 className="text-lg sm:text-xl font-bold">Manage Playlists</h1>
          </div>
        </div>

        {/* Main content */}
        <div className="card !rounded-t-none !rounded-b-2xl !border-t-0 animate-fadeIn">
          {/* Search and actions bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            {/* Back button + MAC */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => navigate('/reseller/devices')}
                className="p-3 hover:bg-dark rounded-xl transition-colors flex-shrink-0"
                aria-label="Retour"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="hidden md:flex items-center px-4 py-3 bg-dark rounded-xl text-white font-mono text-sm">
                {mac}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              {playlists.length < 5 && (
                <>
                  <button
                    onClick={() => navigate(`/reseller/devices/${mac}/playlists/add`)}
                    className="btn btn-primary flex-1 md:flex-none py-3 text-base"
                  >
                    Add Playlist
                  </button>
                  <button
                    onClick={() => navigate(`/reseller/devices/${mac}/playlists/add-xtream`)}
                    className="btn btn-primary flex-1 md:flex-none py-3 text-base"
                  >
                    Add XC
                  </button>
                </>
              )}
            </div>
          </div>

          {/* MAC on mobile */}
          <div className="md:hidden mb-4 px-4 py-3 bg-dark rounded-xl text-white font-mono text-sm text-center">
            {mac}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-error/10 border border-error/30 text-error">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Playlists table */}
          <div className="bg-dark rounded-xl overflow-hidden border border-border">
            <table className="w-full">
              <thead>
                <tr className="bg-darker">
                  <th className="text-left py-4 px-4 text-muted font-medium text-sm">Playlist</th>
                  <th className="text-left py-4 px-4 text-muted font-medium text-sm hidden md:table-cell">URL</th>
                  <th className="text-left py-4 px-4 text-muted font-medium text-sm hidden md:table-cell">Username</th>
                  <th className="text-left py-4 px-4 text-muted font-medium text-sm hidden md:table-cell">Password</th>
                  <th className="text-right py-4 px-4 text-muted font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {playlists.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted">
                      Aucune playlist. Cliquez sur "Add Playlist" pour commencer.
                    </td>
                  </tr>
                ) : (
                  playlists.map((p) => (
                    <tr key={p.id} className="border-b border-border hover:bg-card/50">
                      <td className="py-4 px-4 font-medium">
                        <div className="flex items-center gap-2">
                          {p.is_active && <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />}
                          <span className="text-base">{p.name}</span>
                        </div>
                        {/* Mobile: show URL below name */}
                        <div className="md:hidden mt-1 text-xs text-muted truncate max-w-[200px]">
                          {p.playlist_type === 'xtream' ? p.xtream_host : p.playlist_url}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-muted hidden md:table-cell">
                        <span className="font-mono text-sm block truncate max-w-[200px]">
                          {p.playlist_type === 'xtream' ? p.xtream_host : (p.playlist_url || '-')}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-muted hidden md:table-cell">
                        {p.playlist_type === 'xtream' ? p.xtream_username : '-'}
                      </td>
                      <td className="py-4 px-4 text-muted hidden md:table-cell">
                        {p.playlist_type === 'xtream' ? '••••••' : '-'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-4">
                          {!p.is_active && (
                            <button
                              onClick={() => handleActivate(p.id)}
                              className="p-3 text-success hover:bg-success/10 rounded-xl transition-colors"
                              title="Activer"
                            >
                              <CheckCircle className="w-6 h-6" />
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/reseller/devices/${mac}/playlists/${p.id}/edit`)}
                            className="p-3 text-primary hover:bg-primary/10 rounded-xl transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-6 h-6" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="p-3 text-error hover:bg-error/10 rounded-xl transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-6 h-6" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Limit warning */}
          {playlists.length >= 5 && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-xl text-warning text-sm text-center">
              Limite de 5 playlists par appareil atteinte
            </div>
          )}
        </div>
      </div>
  );
}
