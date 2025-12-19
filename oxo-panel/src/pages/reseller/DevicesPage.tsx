import { useEffect, useState } from 'react';
import { Loader2, Tv, Upload, Link, X, CheckCircle } from 'lucide-react';
import { resellerApi } from '../../services/api';

interface Device {
  id: number;
  mac_address: string;
  status: string;
  playlist_url: string;
  activation_date: string;
  expiration_date: string;
  last_seen: string;
}

export function ResellerDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistFile, setPlaylistFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

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
    setPlaylistUrl(device.playlist_url || '');
    setPlaylistFile(null);
    setUploadSuccess(false);
    setShowPlaylistModal(true);
  };

  const handleSavePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;

    setIsSubmitting(true);
    try {
      if (playlistFile) {
        await resellerApi.uploadPlaylist(selectedDevice.mac_address, playlistFile);
      } else if (playlistUrl) {
        await resellerApi.setPlaylistUrl(selectedDevice.mac_address, playlistUrl);
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
      <h1 className="text-2xl font-bold mb-6">Mes appareils</h1>

      {devices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => {
            const daysRemaining = device.expiration_date
              ? getDaysRemaining(device.expiration_date)
              : 0;

            return (
              <div key={device.id} className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Tv className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-mono font-medium">{device.mac_address}</p>
                      {getStatusBadge(device.status)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Expiration</span>
                    <span>
                      {device.expiration_date
                        ? new Date(device.expiration_date).toLocaleDateString('fr-FR')
                        : '-'}
                    </span>
                  </div>
                  {daysRemaining > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted">Jours restants</span>
                      <span
                        className={
                          daysRemaining < 30 ? 'text-warning' : 'text-success'
                        }
                      >
                        {daysRemaining} jours
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted">Playlist</span>
                    <span>
                      {device.playlist_url ? (
                        <span className="text-success">✓ Configurée</span>
                      ) : (
                        <span className="text-warning">Non configurée</span>
                      )}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenPlaylistModal(device)}
                  className="btn btn-secondary w-full mt-4"
                >
                  <Upload className="w-4 h-4" />
                  {device.playlist_url ? 'Modifier playlist' : 'Ajouter playlist'}
                </button>
              </div>
            );
          })}
        </div>
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
                    disabled={isSubmitting || (!playlistUrl && !playlistFile)}
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




