import { useEffect, useState } from 'react';
import { Loader2, Tv, AlertCircle, CheckCircle, Clock, Copy, Check } from 'lucide-react';
import {
  generateDeviceMac,
  registerDevice,
  getPlaylist,
  getPlaylistContent,
  type DeviceRegistration,
  type PlaylistData,
} from '../services/deviceApi';
import { useAppStore } from '../stores/appStore';
import { parseM3U, m3uToLiveChannels, m3uToCategories } from '../services/m3uParser';

interface DeviceActivationPageProps {
  onActivated: (expirationDate?: string) => void;
}

export function DeviceActivationPage({ onActivated }: DeviceActivationPageProps) {
  const [macAddress, setMacAddress] = useState<string>('');
  const [deviceInfo, setDeviceInfo] = useState<DeviceRegistration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  const { setLiveChannels, setLiveCategories, setConnected } = useAppStore();

  useEffect(() => {
    initDevice();
  }, []);

  const initDevice = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get or generate MAC address
      const mac = generateDeviceMac();
      setMacAddress(mac);

      // Register device
      const registration = await registerDevice(mac);
      setDeviceInfo(registration);

      // If device has playlist, try to load it
      if (registration.has_playlist && (registration.status === 'active' || registration.status === 'trial')) {
        await loadPlaylist(mac);
      }
    } catch (err) {
      console.error('Device init error:', err);
      setError('Impossible de se connecter au serveur. Vérifiez votre connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlaylist = async (mac: string) => {
    setLoadingPlaylist(true);
    setError(null);
    
    try {
      // Use the proxy endpoint to fetch playlist content
      console.log('Fetching playlist for MAC:', mac);
      const playlistContent = await getPlaylistContent(mac);
      console.log('Playlist content received, length:', playlistContent?.length);
      
      if (!playlistContent || playlistContent.length < 100) {
        console.log('Playlist content is empty or too short');
        setError('La playlist est vide ou invalide');
        return;
      }

      // Parse the M3U content (filtering live channels only for large playlists)
      console.log('Parsing playlist...');
      const { channels, categories } = parseM3U(playlistContent, true);
      console.log('Parsed:', channels.length, 'channels,', categories.length, 'categories');
      console.log('Sample categories:', categories.slice(0, 5));
      
      if (channels.length === 0) {
        console.log('No channels found in playlist');
        setError('Aucune chaîne trouvée dans la playlist');
        return;
      }

      const liveChannels = m3uToLiveChannels(channels);
      const liveCategories = m3uToCategories(categories);
      console.log('Setting', liveChannels.length, 'channels and', liveCategories.length, 'categories');
      
      // Try to save to store (may fail if too large for localStorage)
      try {
        setLiveChannels(liveChannels);
        setLiveCategories(liveCategories);
        setConnected(true);
        onActivated(deviceInfo?.expiration_date);
      } catch (storageErr) {
        console.error('Storage error:', storageErr);
        setError('Playlist trop volumineuse pour être stockée. Veuillez utiliser une playlist plus petite.');
      }
    } catch (err: unknown) {
      console.error('Playlist load error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Erreur lors du chargement: ${errorMessage}`);
    } finally {
      setLoadingPlaylist(false);
    }
  };

  const handleCopyMac = () => {
    navigator.clipboard.writeText(macAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    initDevice();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-oxo-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-oxo-primary animate-spin mx-auto mb-4" />
          <p className="text-xl">Connexion au serveur...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-oxo-dark flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-4">Erreur de connexion</h1>
          <p className="text-oxo-muted mb-6">{error}</p>
          <button onClick={handleRetry} className="px-8 py-3 bg-oxo-primary rounded-xl font-semibold hover:bg-oxo-primary/80 transition-colors">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Device not activated or no playlist
  return (
    <div className="min-h-screen bg-oxo-dark flex items-center justify-center p-6">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-oxo-primary/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-oxo-secondary/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-lg w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-oxo-primary to-oxo-secondary mb-4 animate-pulse-glow">
            <span className="text-4xl font-bold">OXO</span>
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">OXO Player</h1>
        </div>

        {/* MAC Address Card */}
        <div className="bg-oxo-card border border-oxo-border rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Tv className="w-8 h-8 text-oxo-primary" />
            <h2 className="text-xl font-semibold">Votre code d'activation</h2>
          </div>

          {/* MAC Display */}
          <div
            onClick={handleCopyMac}
            className="bg-oxo-darker border-2 border-dashed border-oxo-border rounded-xl p-6 text-center cursor-pointer hover:border-oxo-primary transition-colors group"
          >
            <p className="font-mono text-3xl font-bold tracking-wider text-oxo-primary mb-2">
              {macAddress}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-oxo-muted">
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-green-500">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Cliquez pour copier</span>
                </>
              )}
            </div>
          </div>

          {/* Status */}
          {deviceInfo && (
            <div className="mt-6 p-4 bg-oxo-darker rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-oxo-muted">Statut</span>
                {deviceInfo.status === 'active' ? (
                  <span className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="w-5 h-5" />
                    Actif
                  </span>
                ) : deviceInfo.status === 'trial' ? (
                  <span className="flex items-center gap-2 text-yellow-500">
                    <Clock className="w-5 h-5" />
                    Essai ({deviceInfo.days_remaining} jours)
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="w-5 h-5" />
                    {deviceInfo.status === 'expired' ? 'Expiré' : 'Non activé'}
                  </span>
                )}
              </div>

              {deviceInfo.expiration_date && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-oxo-muted">Expiration</span>
                  <span>{new Date(deviceInfo.expiration_date).toLocaleDateString('fr-FR')}</span>
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <span className="text-oxo-muted">Playlist</span>
                <span className={deviceInfo.has_playlist ? 'text-green-500' : 'text-yellow-500'}>
                  {deviceInfo.has_playlist ? '✓ Configurée' : '✗ Non configurée'}
                </span>
              </div>

              {!deviceInfo.has_playlist && (deviceInfo.status === 'active' || deviceInfo.status === 'trial') && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-500">
                    ⚠️ Aucune playlist configurée. Contactez votre revendeur.
                  </p>
                </div>
              )}

              {deviceInfo.has_playlist && (deviceInfo.status === 'active' || deviceInfo.status === 'trial') && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-sm text-green-500">
                    ✓ Playlist configurée ! Cliquez sur Actualiser pour charger les chaînes.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-oxo-card border border-oxo-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Pour activer votre appareil :</h3>
          <ol className="space-y-3 text-sm text-oxo-muted">
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-oxo-primary/20 text-oxo-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
              <span>Notez le code MAC ci-dessus</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-oxo-primary/20 text-oxo-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
              <span>Contactez votre revendeur avec ce code</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-oxo-primary/20 text-oxo-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
              <span>Le revendeur activera votre appareil</span>
            </li>
            <li className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-oxo-primary/20 text-oxo-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
              <span>Cliquez sur "Actualiser" pour charger vos chaînes</span>
            </li>
          </ol>

          <button 
            onClick={handleRetry} 
            disabled={loadingPlaylist}
            className="w-full mt-6 py-3 bg-oxo-primary rounded-xl font-semibold hover:bg-oxo-primary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingPlaylist ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Chargement...
              </>
            ) : (
              'Actualiser'
            )}
          </button>
        </div>

        <p className="text-center text-sm text-oxo-muted mt-6">
          OXO Player v1.0
        </p>
      </div>
    </div>
  );
}
