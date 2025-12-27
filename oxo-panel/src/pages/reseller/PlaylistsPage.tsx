import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckCircle, Loader2, Upload, Link as LinkIcon } from 'lucide-react';
import { resellerApi } from '../../services/api';

interface Playlist {
  id: number;
  name: string;
  playlist_type: 'm3u' | 'xtream';
  playlist_url?: string;
  xtream_host?: string;
  xtream_username?: string;
  epg_url?: string;
  is_active: boolean;
  created_at: string;
}

export function PlaylistsPage() {
  const { mac } = useParams<{ mac: string }>();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [playlistType, setPlaylistType] = useState<'m3u' | 'xtream' | 'upload'>('m3u');
  
  // Form fields
  const [name, setName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [xtreamHost, setXtreamHost] = useState('');
  const [xtreamUsername, setXtreamUsername] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    if (!mac) return;
    
    try {
      const response = await resellerApi.getDevicePlaylists(mac);
      setPlaylists(response.data.playlists);
    } catch (error) {
      console.error('Error loading playlists:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mac) return;

    setIsSubmitting(true);
    try {
      if (playlistType === 'upload') {
        if (!file) {
          alert('Veuillez sélectionner un fichier');
          setIsSubmitting(false);
          return;
        }
        await resellerApi.uploadDevicePlaylist(mac, name, file, epgUrl);
      } else if (playlistType === 'xtream') {
        if (!name || !xtreamHost || !xtreamUsername || !xtreamPassword) {
          alert('Veuillez remplir tous les champs Xtream Code');
          setIsSubmitting(false);
          return;
        }
        await resellerApi.addDeviceXtreamPlaylist(mac, name, xtreamHost, xtreamUsername, xtreamPassword, epgUrl);
      } else {
        if (!name || !playlistUrl) {
          alert('Veuillez remplir tous les champs');
          setIsSubmitting(false);
          return;
        }
        await resellerApi.addDeviceM3UPlaylist(mac, name, playlistUrl, epgUrl);
      }

      // Reset form
      setName('');
      setPlaylistUrl('');
      setFile(null);
      setXtreamHost('');
      setXtreamUsername('');
      setXtreamPassword('');
      setEpgUrl('');
      setShowAddModal(false);
      loadPlaylists();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de l\'ajout');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivatePlaylist = async (playlistId: number) => {
    if (!mac) return;
    
    try {
      await resellerApi.activateDevicePlaylist(mac, playlistId);
      loadPlaylists();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de l\'activation');
    }
  };

  const handleDeletePlaylist = async (playlistId: number) => {
    if (!mac) return;
    
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette playlist ?')) {
      return;
    }

    try {
      await resellerApi.deleteDevicePlaylist(mac, playlistId);
      loadPlaylists();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reseller/devices')}
            className="btn btn-ghost btn-sm gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <h1 className="text-2xl font-bold">Playlists - {mac}</h1>
        </div>
        {playlists.length < 5 && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary gap-2"
          >
            <Plus className="w-5 h-5" />
            Ajouter une playlist
          </button>
        )}
      </div>

      {playlists.length === 0 ? (
        <div className="card bg-base-200">
          <div className="card-body text-center py-12">
            <p className="text-gray-400">Aucune playlist ajoutée</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary mx-auto mt-4 gap-2"
            >
              <Plus className="w-5 h-5" />
              Ajouter la première playlist
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className={`card bg-base-200 ${
                playlist.is_active ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {playlist.is_active && (
                      <CheckCircle className="w-6 h-6 text-success" />
                    )}
                    <div>
                      <h3 className="font-semibold text-lg">{playlist.name}</h3>
                      <div className="flex gap-4 mt-1 text-sm text-gray-400">
                        <span className="badge badge-sm">
                          {playlist.playlist_type === 'xtream' ? 'Xtream Code' : 'M3U'}
                        </span>
                        {playlist.playlist_type === 'xtream' ? (
                          <>
                            <span>Host: {playlist.xtream_host}</span>
                            <span>User: {playlist.xtream_username}</span>
                          </>
                        ) : (
                          <span>URL: {playlist.playlist_url}</span>
                        )}
                      </div>
                      {playlist.epg_url && (
                        <div className="text-sm text-gray-400 mt-1">
                          EPG: {playlist.epg_url}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Ajoutée le {new Date(playlist.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!playlist.is_active && (
                      <button
                        onClick={() => handleActivatePlaylist(playlist.id)}
                        className="btn btn-sm btn-success"
                      >
                        Activer
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePlaylist(playlist.id)}
                      className="btn btn-sm btn-error gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {playlists.length >= 5 && (
        <div className="alert alert-warning mt-4">
          <span>Limite de 5 playlists par appareil atteinte</span>
        </div>
      )}

      {/* Add Playlist Modal */}
      {showAddModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Ajouter une playlist</h3>

            {/* Type Selection */}
            <div className="tabs tabs-boxed mb-4">
              <button
                className={`tab ${playlistType === 'm3u' ? 'tab-active' : ''}`}
                onClick={() => setPlaylistType('m3u')}
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                URL M3U
              </button>
              <button
                className={`tab ${playlistType === 'upload' ? 'tab-active' : ''}`}
                onClick={() => setPlaylistType('upload')}
              >
                <Upload className="w-4 h-4 mr-2" />
                Fichier M3U
              </button>
              <button
                className={`tab ${playlistType === 'xtream' ? 'tab-active' : ''}`}
                onClick={() => setPlaylistType('xtream')}
              >
                Xtream Code
              </button>
            </div>

            <form onSubmit={handleAddPlaylist} className="space-y-4">
              {/* Name Field (for all types) */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Nom de la playlist *</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ma Playlist"
                  className="input input-bordered"
                  required
                />
              </div>

              {/* M3U URL Fields */}
              {playlistType === 'm3u' && (
                <>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">URL de la playlist M3U *</span>
                    </label>
                    <input
                      type="url"
                      value={playlistUrl}
                      onChange={(e) => setPlaylistUrl(e.target.value)}
                      placeholder="http://example.com/playlist.m3u"
                      className="input input-bordered"
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">URL EPG (optionnel)</span>
                    </label>
                    <input
                      type="url"
                      value={epgUrl}
                      onChange={(e) => setEpgUrl(e.target.value)}
                      placeholder="http://example.com/epg.xml"
                      className="input input-bordered"
                    />
                  </div>
                </>
              )}

              {/* File Upload */}
              {playlistType === 'upload' && (
                <>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Fichier M3U *</span>
                    </label>
                    <input
                      type="file"
                      accept=".m3u,.m3u8,.txt"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="file-input file-input-bordered"
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">URL EPG (optionnel)</span>
                    </label>
                    <input
                      type="url"
                      value={epgUrl}
                      onChange={(e) => setEpgUrl(e.target.value)}
                      placeholder="http://example.com/epg.xml"
                      className="input input-bordered"
                    />
                  </div>
                </>
              )}

              {/* Xtream Code Fields */}
              {playlistType === 'xtream' && (
                <>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Serveur *</span>
                    </label>
                    <input
                      type="text"
                      value={xtreamHost}
                      onChange={(e) => setXtreamHost(e.target.value)}
                      placeholder="example.com:8080"
                      className="input input-bordered"
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Nom d'utilisateur *</span>
                    </label>
                    <input
                      type="text"
                      value={xtreamUsername}
                      onChange={(e) => setXtreamUsername(e.target.value)}
                      placeholder="username"
                      className="input input-bordered"
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Mot de passe *</span>
                    </label>
                    <input
                      type="password"
                      value={xtreamPassword}
                      onChange={(e) => setXtreamPassword(e.target.value)}
                      placeholder="password"
                      className="input input-bordered"
                      required
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">URL EPG (optionnel)</span>
                    </label>
                    <input
                      type="url"
                      value={epgUrl}
                      onChange={(e) => setEpgUrl(e.target.value)}
                      placeholder="http://example.com/epg.xml"
                      className="input input-bordered"
                    />
                  </div>
                </>
              )}

              <div className="modal-action">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Ajout...
                    </>
                  ) : (
                    'Ajouter'
                  )}
                </button>
              </div>
            </form>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => !isSubmitting && setShowAddModal(false)}
          />
        </div>
      )}
    </div>
  );
}

