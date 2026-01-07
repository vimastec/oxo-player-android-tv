import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Tv, Upload, Link, X, CheckCircle, List, Search } from 'lucide-react';
import { resellerApi } from '../../services/api';

interface Device {
  id: number;
  mac_address: string;
  status: string;
  playlist_url: string;
  playlist_type: string;
  xtream_host: string;
  xtream_username: string;
  activation_date: string;
  expiration_date: string;
  last_seen: string;
}

export function ResellerDevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [playlistType, setPlaylistType] = useState<'m3u' | 'xtream'>('m3u');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistFile, setPlaylistFile] = useState<File | null>(null);
  const [xtreamHost, setXtreamHost] = useState('');
  const [xtreamUsername, setXtreamUsername] = useState('');
  const [xtreamPassword, setXtreamPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Filter devices by search query
  const filteredDevices = devices.filter((device) =>
    device.mac_address.toLowerCase().includes(searchQuery.toLowerCase().replace(/[^a-f0-9:]/gi, ''))
  );

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const response = await resellerApi.getDevices();
      setDevices(response.data);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPlaylistModal = (device: Device) => {
    setSelectedDevice(device);
    // Pre-fill based on existing configuration
    if (device.playlist_type === 'xtream' && device.xtream_host) {
      setPlaylistType('xtream');
      setXtreamHost(device.xtream_host || '');
      setXtreamUsername(device.xtream_username || '');
      setXtreamPassword(''); // Don't show password for security
      setPlaylistUrl('');
    } else {
      setPlaylistType('m3u');
      setPlaylistUrl(device.playlist_url || '');
      setXtreamHost('');
      setXtreamUsername('');
      setXtreamPassword('');
    }
    setPlaylistFile(null);
    setUploadSuccess(false);
    setShowPlaylistModal(true);
  };

  const handleSavePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;

    setIsSubmitting(true);
    try {
      if (playlistType === 'xtream') {
        // Save Xtream credentials
        if (!xtreamHost || !xtreamUsername || !xtreamPassword) {
          alert('Veuillez remplir tous les champs Xtream Code');
          setIsSubmitting(false);
          return;
        }
        await resellerApi.setXtreamCredentials(
          selectedDevice.mac_address,
          xtreamHost,
          xtreamUsername,
          xtreamPassword
        );
      } else {
        // Save M3U playlist
        if (playlistFile) {
          await resellerApi.uploadPlaylist(selectedDevice.mac_address, playlistFile);
        } else if (playlistUrl) {
          await resellerApi.setPlaylistUrl(selectedDevice.mac_address, playlistUrl);
        } else {
          alert('Veuillez fournir une URL ou un fichier M3U');
          setIsSubmitting(false);
          return;
        }
      }
      setUploadSuccess(true);
      setTimeout(() => {
        setShowPlaylistModal(false);
        loadDevices();
      }, 1500);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Actif</span>;
      case 'trial':
        return <span className="badge badge-info">Essai</span>;
      case 'expired':
        return <span className="badge badge-error">Expiré</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const getDaysRemaining = (expirationDate: string) => {
    const exp = new Date(expirationDate);
    const now = new Date();
    const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">Mes appareils</h1>
        <span className="text-muted text-sm">{devices.length} appareil(s)</span>
      </div>

      {/* Search bar */}
      <div className="card mb-4 !p-3 sm:!p-6">
        <div className="relative">
          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-muted" />
          <input
            type="text"
            placeholder="Rechercher une adresse MAC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 sm:pl-12 font-mono text-sm sm:text-base"
          />
        </div>
      </div>

      {devices.length > 0 ? (
        <>
          {filteredDevices.length > 0 ? (
            <>
              {/* Vue Mobile - Cartes */}
              <div className="block md:hidden space-y-3">
                {filteredDevices.map((device) => {
                  const daysRemaining = device.expiration_date
                    ? getDaysRemaining(device.expiration_date)
                    : 0;

                  return (
                    <div key={device.id} className="card !p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-mono font-medium text-sm break-all">{device.mac_address}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {getStatusBadge(device.status)}
                            {device.playlist_type === 'xtream' && device.xtream_host ? (
                              <span className="badge badge-success">Xtream</span>
                            ) : device.playlist_url ? (
                              <span className="badge badge-success">M3U</span>
                            ) : (
                              <span className="badge badge-warning">Non configurée</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {daysRemaining > 0 ? (
                            <span className={`text-lg font-bold ${daysRemaining < 30 ? 'text-warning' : 'text-success'}`}>
                              {daysRemaining}j
                            </span>
                          ) : (
                            <span className="text-lg font-bold text-error">0j</span>
                          )}
                          <p className="text-xs text-muted mt-1">
                            {device.expiration_date
                              ? new Date(device.expiration_date).toLocaleDateString('fr-FR')
                              : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenPlaylistModal(device)}
                          className="btn btn-sm btn-secondary flex-1 gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          Config rapide
                        </button>
                        <button
                          onClick={() => navigate(`/reseller/devices/${device.mac_address}/playlists`)}
                          className="btn btn-sm btn-primary flex-1 gap-2"
                        >
                          <List className="w-4 h-4" />
                          Playlists
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vue Desktop - Tableau */}
              <div className="hidden md:block card overflow-hidden">
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Adresse MAC</th>
                        <th>Statut</th>
                        <th>Expiration</th>
                        <th>Jours</th>
                        <th>Playlist</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDevices.map((device) => {
                        const daysRemaining = device.expiration_date
                          ? getDaysRemaining(device.expiration_date)
                          : 0;

                        return (
                          <tr key={device.id}>
                            <td className="font-mono font-medium">{device.mac_address}</td>
                            <td>{getStatusBadge(device.status)}</td>
                            <td>
                              {device.expiration_date
                                ? new Date(device.expiration_date).toLocaleDateString('fr-FR')
                                : '-'}
                            </td>
                            <td>
                              {daysRemaining > 0 ? (
                                <span className={daysRemaining < 30 ? 'text-warning' : 'text-success'}>
                                  {daysRemaining}j
                                </span>
                              ) : (
                                <span className="text-error">0j</span>
                              )}
                            </td>
                            <td>
                              {device.playlist_type === 'xtream' && device.xtream_host ? (
                                <span className="badge badge-success">Xtream</span>
                              ) : device.playlist_url ? (
                                <span className="badge badge-success">M3U</span>
                              ) : (
                                <span className="badge badge-warning">Non configurée</span>
                              )}
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenPlaylistModal(device)}
                                  className="btn btn-sm btn-secondary"
                                  title="Configurer playlist"
                                >
                                  <Upload className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => navigate(`/reseller/devices/${device.mac_address}/playlists`)}
                                  className="btn btn-sm btn-primary"
                                  title="Gérer playlists"
                                >
                                  <List className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card text-center py-8 text-muted">
              Aucun résultat pour "{searchQuery}"
            </div>
          )}
        </>
      ) : (
        <div className="card text-center py-12">
          <Tv className="w-16 h-16 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucun appareil</h3>
          <p className="text-muted">
            Activez une adresse MAC pour commencer
          </p>
        </div>
      )}

      {/* Playlist Modal */}
      {showPlaylistModal && selectedDevice && (
        <div className="modal-overlay" onClick={() => setShowPlaylistModal(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Configurer la playlist</h2>
              <button
                onClick={() => setShowPlaylistModal(false)}
                className="p-2 hover:bg-card rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadSuccess ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                <p className="text-lg font-semibold">Playlist sauvegardée !</p>
              </div>
            ) : (
              <form onSubmit={handleSavePlaylist} className="space-y-6">
                <div>
                  <p className="text-sm text-muted mb-4">
                    Appareil: <strong className="font-mono">{selectedDevice.mac_address}</strong>
                  </p>
                </div>

                {/* Type Selection */}
                <div>
                  <label className="block text-sm font-medium mb-3">Type de configuration</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPlaylistType('m3u')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        playlistType === 'm3u'
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Link className="w-6 h-6 mx-auto mb-2" />
                      <p className="font-semibold">M3U URL</p>
                      <p className="text-xs text-muted mt-1">Lien playlist</p>
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

                {/* M3U Configuration */}
                {playlistType === 'm3u' && (
                  <>
                    {/* URL Option */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-muted mb-2">
                        <Link className="w-4 h-4" />
                        URL de la playlist M3U
                      </label>
                      <input
                        type="url"
                        placeholder="http://exemple.com/playlist.m3u"
                        value={playlistUrl}
                        onChange={(e) => {
                          setPlaylistUrl(e.target.value);
                          setPlaylistFile(null);
                        }}
                      />
                    </div>

                    <div className="text-center text-muted text-sm">ou</div>

                    {/* File Option */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-muted mb-2">
                        <Upload className="w-4 h-4" />
                        Uploader un fichier M3U
                      </label>
                      <label className="block w-full p-8 border-2 border-dashed border-border rounded-xl text-center cursor-pointer hover:border-primary transition-colors">
                        {playlistFile ? (
                          <span className="text-primary">{playlistFile.name}</span>
                        ) : (
                          <span className="text-muted">Cliquez pour sélectionner un fichier</span>
                        )}
                        <input
                          type="file"
                          accept=".m3u,.m3u8,.txt"
                          className="hidden"
                          onChange={(e) => {
                            setPlaylistFile(e.target.files?.[0] || null);
                            setPlaylistUrl('');
                          }}
                        />
                      </label>
                    </div>
                  </>
                )}

                {/* Xtream Code Configuration */}
                {playlistType === 'xtream' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-muted mb-2">
                        Host / Serveur
                      </label>
                      <input
                        type="text"
                        placeholder="exemple.com ou 123.45.67.89:8080"
                        value={xtreamHost}
                        onChange={(e) => setXtreamHost(e.target.value)}
                      />
                      <p className="text-xs text-muted mt-1">
                        Sans http:// - Exemple: server.com ou 12.34.56.78:25461
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        placeholder="username123"
                        value={xtreamUsername}
                        onChange={(e) => setXtreamUsername(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-muted mb-2">
                        Password
                      </label>
                      <input
                        type="text"
                        placeholder="password123"
                        value={xtreamPassword}
                        onChange={(e) => setXtreamPassword(e.target.value)}
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
                    onClick={() => setShowPlaylistModal(false)}
                    className="btn btn-secondary flex-1"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (playlistType === 'm3u' && !playlistUrl && !playlistFile) ||
                      (playlistType === 'xtream' && (!xtreamHost || !xtreamUsername || !xtreamPassword))
                    }
                    className="btn btn-primary flex-1"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Sauvegarder'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



















