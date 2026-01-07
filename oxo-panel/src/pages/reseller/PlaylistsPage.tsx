import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckCircle, Loader2, Upload, Link as LinkIcon, Tv, X, Pencil } from 'lucide-react';
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
  is_active: boolean;
  created_at: string;
}

export function PlaylistsPage() {
  const { mac } = useParams<{ mac: string }>();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
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

  const openEditModal = (playlist: Playlist) => {
    setEditingPlaylist(playlist);
    setName(playlist.name);
    setEpgUrl(playlist.epg_url || '');
    
    if (playlist.playlist_type === 'xtream') {
      setPlaylistType('xtream');
      setXtreamHost(playlist.xtream_host || '');
      setXtreamUsername(playlist.xtream_username || '');
      setXtreamPassword(playlist.xtream_password || '');
      setPlaylistUrl('');
    } else {
      setPlaylistType('m3u');
      setPlaylistUrl(playlist.playlist_url || '');
      setXtreamHost('');
      setXtreamUsername('');
      setXtreamPassword('');
    }
    
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingPlaylist(null);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setPlaylistUrl('');
    setFile(null);
    setXtreamHost('');
    setXtreamUsername('');
    setXtreamPassword('');
    setEpgUrl('');
  };

  const handleEditPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mac || !editingPlaylist) return;

    setIsSubmitting(true);
    try {
      const updateData: any = { name };
      
      if (editingPlaylist.playlist_type === 'xtream') {
        if (xtreamHost) updateData.host = xtreamHost;
        if (xtreamUsername) updateData.username = xtreamUsername;
        if (xtreamPassword) updateData.password = xtreamPassword;
      } else {
        if (playlistUrl) updateData.playlist_url = playlistUrl;
      }
      
      if (epgUrl) updateData.epg_url = epgUrl;

      await resellerApi.updateDevicePlaylist(mac, editingPlaylist.id, updateData);
      closeEditModal();
      loadPlaylists();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la modification');
    } finally {
      setIsSubmitting(false);
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <button
            onClick={() => navigate('/reseller/devices')}
            className="btn btn-ghost btn-sm gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold">Playlists</h1>
            <p className="text-xs sm:text-sm text-muted font-mono">{mac}</p>
          </div>
        </div>
        {playlists.length < 5 && (
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="btn btn-primary gap-2 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Ajouter
          </button>
        )}
      </div>

      {playlists.length === 0 ? (
        <div className="card text-center py-12">
          <Tv className="w-16 h-16 text-muted mx-auto mb-4" />
          <p className="text-muted mb-4">Aucune playlist ajoutée</p>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="btn btn-primary mx-auto gap-2"
          >
            <Plus className="w-5 h-5" />
            Ajouter la première playlist
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className={`card !p-4 ${
                playlist.is_active ? 'ring-2 ring-primary' : ''
              }`}
            >
              {/* Mobile View */}
              <div className="block sm:hidden">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {playlist.is_active && (
                      <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                    )}
                    <div>
                      <h3 className="font-semibold">{playlist.name}</h3>
                      <span className="badge badge-sm mt-1">
                        {playlist.playlist_type === 'xtream' ? 'Xtream' : 'M3U'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-muted space-y-1 mb-3">
                  {playlist.playlist_type === 'xtream' ? (
                    <>
                      <p className="truncate">Host: {playlist.xtream_host}</p>
                      <p>User: {playlist.xtream_username}</p>
                    </>
                  ) : (
                    <p className="truncate">URL: {playlist.playlist_url}</p>
                  )}
                  {playlist.epg_url && <p className="truncate">EPG: {playlist.epg_url}</p>}
                </div>

                <div className="flex gap-2">
                  {!playlist.is_active && (
                    <button
                      onClick={() => handleActivatePlaylist(playlist.id)}
                      className="btn btn-sm btn-success flex-1"
                    >
                      Activer
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(playlist)}
                    className="btn btn-sm btn-secondary flex-1 gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDeletePlaylist(playlist.id)}
                    className="btn btn-sm btn-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Desktop View */}
              <div className="hidden sm:flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {playlist.is_active && (
                    <CheckCircle className="w-6 h-6 text-success flex-shrink-0" />
                  )}
                  <div>
                    <h3 className="font-semibold text-lg">{playlist.name}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted">
                      <span className="badge badge-sm">
                        {playlist.playlist_type === 'xtream' ? 'Xtream Code' : 'M3U'}
                      </span>
                      {playlist.playlist_type === 'xtream' ? (
                        <>
                          <span>Host: {playlist.xtream_host}</span>
                          <span>User: {playlist.xtream_username}</span>
                        </>
                      ) : (
                        <span className="truncate max-w-md">URL: {playlist.playlist_url}</span>
                      )}
                    </div>
                    {playlist.epg_url && (
                      <p className="text-sm text-muted mt-1 truncate max-w-md">
                        EPG: {playlist.epg_url}
                      </p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      Ajoutée le {new Date(playlist.created_at).toLocaleDateString('fr-FR')}
                    </p>
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
                    onClick={() => openEditModal(playlist)}
                    className="btn btn-sm btn-secondary gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDeletePlaylist(playlist.id)}
                    className="btn btn-sm btn-danger gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {playlists.length >= 5 && (
        <div className="card !bg-warning/10 !border-warning/30 mt-4 !p-3 text-center text-sm text-warning">
          Limite de 5 playlists par appareil atteinte
        </div>
      )}

      {/* Edit Playlist Modal */}
      {showEditModal && editingPlaylist && (
        <div className="modal-overlay" onClick={() => !isSubmitting && closeEditModal()}>
          <div className="modal-content p-4 sm:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold">Modifier la playlist</h2>
              <button
                onClick={closeEditModal}
                className="p-2 hover:bg-card rounded-lg"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditPlaylist} className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Nom *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom de la playlist"
                  required
                />
              </div>

              {editingPlaylist.playlist_type === 'xtream' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">Host</label>
                    <input
                      type="text"
                      value={xtreamHost}
                      onChange={(e) => setXtreamHost(e.target.value)}
                      placeholder="exemple.com:8080"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">Username</label>
                    <input
                      type="text"
                      value={xtreamUsername}
                      onChange={(e) => setXtreamUsername(e.target.value)}
                      placeholder="username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">Password</label>
                    <input
                      type="text"
                      value={xtreamPassword}
                      onChange={(e) => setXtreamPassword(e.target.value)}
                      placeholder="Laisser vide pour conserver l'actuel"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">URL M3U</label>
                  <input
                    type="url"
                    value={playlistUrl}
                    onChange={(e) => setPlaylistUrl(e.target.value)}
                    placeholder="http://exemple.com/playlist.m3u"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-muted mb-2">URL EPG (optionnel)</label>
                <input
                  type="url"
                  value={epgUrl}
                  onChange={(e) => setEpgUrl(e.target.value)}
                  placeholder="http://exemple.com/epg.xml"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="btn btn-secondary flex-1"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name}
                  className="btn btn-primary flex-1"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Playlist Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setShowAddModal(false)}>
          <div className="modal-content p-4 sm:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold">Ajouter une playlist</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-card rounded-lg"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPlaylist} className="space-y-6">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Nom de la playlist *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ma Playlist"
                  required
                />
              </div>

              {/* Type Selection - Same style as DevicesPage */}
              <div>
                <label className="block text-sm font-medium mb-3">Type de configuration</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPlaylistType('m3u')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      playlistType === 'm3u'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <LinkIcon className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-semibold">M3U URL</p>
                    <p className="text-xs text-muted mt-1">Lien playlist</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlaylistType('upload')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      playlistType === 'upload'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Upload className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-semibold">Fichier M3U</p>
                    <p className="text-xs text-muted mt-1">Upload local</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlaylistType('xtream')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      playlistType === 'xtream'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Tv className="w-6 h-6 mx-auto mb-2" />
                    <p className="font-semibold">Xtream Code</p>
                    <p className="text-xs text-muted mt-1">Identifiants API</p>
                  </button>
                </div>
              </div>

              {/* M3U URL Fields */}
              {playlistType === 'm3u' && (
                <>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-muted mb-2">
                      <LinkIcon className="w-4 h-4" />
                      URL de la playlist M3U *
                    </label>
                    <input
                      type="url"
                      value={playlistUrl}
                      onChange={(e) => setPlaylistUrl(e.target.value)}
                      placeholder="http://exemple.com/playlist.m3u"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      URL EPG (optionnel)
                    </label>
                    <input
                      type="url"
                      value={epgUrl}
                      onChange={(e) => setEpgUrl(e.target.value)}
                      placeholder="http://exemple.com/epg.xml"
                    />
                  </div>
                </>
              )}

              {/* File Upload */}
              {playlistType === 'upload' && (
                <>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-muted mb-2">
                      <Upload className="w-4 h-4" />
                      Fichier M3U *
                    </label>
                    <label className="block w-full p-8 border-2 border-dashed border-border rounded-xl text-center cursor-pointer hover:border-primary transition-colors">
                      {file ? (
                        <span className="text-primary">{file.name}</span>
                      ) : (
                        <span className="text-muted">Cliquez pour sélectionner un fichier</span>
                      )}
                      <input
                        type="file"
                        accept=".m3u,.m3u8,.txt"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      URL EPG (optionnel)
                    </label>
                    <input
                      type="url"
                      value={epgUrl}
                      onChange={(e) => setEpgUrl(e.target.value)}
                      placeholder="http://exemple.com/epg.xml"
                    />
                  </div>
                </>
              )}

              {/* Xtream Code Fields */}
              {playlistType === 'xtream' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      Host / Serveur *
                    </label>
                    <input
                      type="text"
                      value={xtreamHost}
                      onChange={(e) => setXtreamHost(e.target.value)}
                      placeholder="exemple.com ou 123.45.67.89:8080"
                    />
                    <p className="text-xs text-muted mt-1">
                      Sans http:// - Exemple: server.com ou 12.34.56.78:25461
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={xtreamUsername}
                      onChange={(e) => setXtreamUsername(e.target.value)}
                      placeholder="username123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      Password *
                    </label>
                    <input
                      type="text"
                      value={xtreamPassword}
                      onChange={(e) => setXtreamPassword(e.target.value)}
                      placeholder="password123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">
                      URL EPG (optionnel)
                    </label>
                    <input
                      type="url"
                      value={epgUrl}
                      onChange={(e) => setEpgUrl(e.target.value)}
                      placeholder="http://exemple.com/epg.xml"
                    />
                  </div>
                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                    <p className="text-sm text-muted">
                      ℹ️ Les identifiants Xtream Code sont fournis par votre fournisseur IPTV
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary flex-1"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !name ||
                    (playlistType === 'm3u' && !playlistUrl) ||
                    (playlistType === 'upload' && !file) ||
                    (playlistType === 'xtream' && (!xtreamHost || !xtreamUsername || !xtreamPassword))
                  }
                  className="btn btn-primary flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Ajouter'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

