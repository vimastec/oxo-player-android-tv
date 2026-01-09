/**
 * Page d'activation de l'appareil
 * Affiche le QR Code et le code de liaison
 */

import { useEffect, useState, useCallback } from 'react';
import { Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { getDeviceMac, getDeviceModel, isNetworkConnected } from '../services/tizenApi';
import { registerDevice, generateLinkCode, getDeviceStatus } from '../services/deviceApi';
import { TV_KEYS, isKey } from '../utils/tvNavigation';

interface ActivationPageProps {
  onActivated: (expirationDate?: string) => void;
}

export function ActivationPage({ onActivated }: ActivationPageProps) {
  const [macAddress, setMacAddress] = useState<string>('');
  const [linkCode, setLinkCode] = useState<string>('');
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [status, setStatus] = useState<'loading' | 'trial' | 'waiting' | 'error'>('loading');
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Vérifier le réseau
  useEffect(() => {
    setIsOnline(isNetworkConnected());
  }, []);

  // Initialiser l'appareil
  const initDevice = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const mac = getDeviceMac();
      setMacAddress(mac);

      // Enregistrer l'appareil
      const registration = await registerDevice();
      setDaysRemaining(registration.days_remaining);

      // Si déjà actif avec playlist, on passe directement
      if ((registration.status === 'active' || registration.status === 'trial') && registration.has_playlist) {
        onActivated(registration.expiration_date);
        return;
      }

      // Sinon, générer un code de liaison
      const codeResponse = await generateLinkCode();
      setLinkCode(codeResponse.code);
      setCodeExpiresAt(new Date(codeResponse.expires_at));
      
      setStatus(registration.status === 'trial' ? 'trial' : 'waiting');
    } catch (err) {
      console.error('Activation error:', err);
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
      setStatus('error');
    }
  }, [onActivated]);

  // Initialiser au montage
  useEffect(() => {
    initDevice();
  }, [initDevice]);

  // Polling pour vérifier si activé
  useEffect(() => {
    if (status !== 'trial' && status !== 'waiting') return;

    const checkStatus = async () => {
      try {
        const deviceStatus = await getDeviceStatus();
        
        if (deviceStatus.status === 'active' || 
            (deviceStatus.status === 'trial' && deviceStatus.has_playlist)) {
          onActivated(deviceStatus.expiration_date);
        }
      } catch {
        // Ignore les erreurs de polling
      }
    };

    const interval = setInterval(checkStatus, 5000); // Check toutes les 5 secondes
    return () => clearInterval(interval);
  }, [status, onActivated]);

  // Renouveler le code avant expiration
  useEffect(() => {
    if (!codeExpiresAt) return;

    const timeUntilExpiry = codeExpiresAt.getTime() - Date.now();
    if (timeUntilExpiry <= 0) {
      // Code expiré, en générer un nouveau
      generateLinkCode().then(response => {
        setLinkCode(response.code);
        setCodeExpiresAt(new Date(response.expires_at));
      }).catch(console.error);
      return;
    }

    // Renouveler 30 secondes avant expiration
    const timeout = setTimeout(() => {
      generateLinkCode().then(response => {
        setLinkCode(response.code);
        setCodeExpiresAt(new Date(response.expires_at));
      }).catch(console.error);
    }, timeUntilExpiry - 30000);

    return () => clearTimeout(timeout);
  }, [codeExpiresAt]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKey(event, TV_KEYS.ENTER) || isKey(event, TV_KEYS.RED)) {
        // Refresh
        initDevice();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [initDevice]);

  // Timer affichage
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  
  useEffect(() => {
    if (!codeExpiresAt) return;

    const updateTimer = () => {
      const remaining = Math.max(0, codeExpiresAt.getTime() - Date.now());
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [codeExpiresAt]);

  return (
    <div className="min-h-screen bg-oxo-dark flex">
      {/* Left side - Logo & Info */}
      <div className="w-1/2 flex flex-col items-center justify-center p-12 bg-gradient-to-br from-oxo-gray to-oxo-dark">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-32 h-32 bg-gradient-to-br from-oxo-red to-red-700 rounded-3xl flex items-center justify-center shadow-2xl">
            <div className="w-16 h-16 border-4 border-white rounded-full flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-white rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>
        
        <h1 className="text-5xl font-bold text-white mb-4">OXO Player</h1>
        <p className="text-xl text-gray-400 mb-8">Lecteur IPTV pour Samsung TV</p>

        {/* Network status */}
        <div className={`flex items-center gap-3 px-6 py-3 rounded-full ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          <span>{isOnline ? 'Connecté' : 'Hors ligne'}</span>
        </div>

        {/* Device info */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">Modèle</p>
          <p className="text-white text-lg">{getDeviceModel()}</p>
        </div>
      </div>

      {/* Right side - Activation */}
      <div className="w-1/2 flex flex-col items-center justify-center p-12">
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-oxo-red animate-spin mx-auto mb-4" />
            <p className="text-xl text-gray-400">Connexion au serveur...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Erreur de connexion</h2>
            <p className="text-gray-400 mb-8">{error}</p>
            <button
              onClick={initDevice}
              className="px-8 py-4 bg-oxo-red rounded-xl text-white text-xl font-semibold focusable flex items-center gap-3 mx-auto"
              tabIndex={0}
            >
              <RefreshCw className="w-6 h-6" />
              Réessayer
            </button>
          </div>
        )}

        {(status === 'trial' || status === 'waiting') && (
          <div className="text-center max-w-md">
            {/* Trial badge */}
            {status === 'trial' && (
              <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-full">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                Période d'essai : {daysRemaining} jours restants
              </div>
            )}

            <h2 className="text-3xl font-bold text-white mb-4">Activez votre appareil</h2>
            <p className="text-gray-400 mb-8">
              Communiquez ce code à votre revendeur pour activer votre abonnement
            </p>

            {/* Link Code */}
            <div className="bg-oxo-gray rounded-2xl p-8 mb-6">
              <p className="text-gray-500 text-sm mb-2">Code d'activation</p>
              <div className="text-6xl font-mono font-bold text-oxo-red tracking-wider">
                {linkCode || '----'}
              </div>
              {codeExpiresAt && (
                <p className="text-gray-500 text-sm mt-4">
                  Expire dans <span className="text-white font-mono">{timeRemaining}</span>
                </p>
              )}
            </div>

            {/* MAC Address */}
            <div className="bg-oxo-gray/50 rounded-xl p-4 mb-8">
              <p className="text-gray-500 text-sm mb-1">Adresse MAC</p>
              <p className="text-white font-mono text-lg">{macAddress}</p>
            </div>

            {/* Instructions */}
            <div className="text-left text-gray-400 text-sm space-y-2">
              <p>1. Notez le code d'activation ci-dessus</p>
              <p>2. Contactez votre revendeur OXO Player</p>
              <p>3. Communiquez-lui le code</p>
              <p>4. L'activation sera automatique</p>
            </div>

            {/* Refresh button */}
            <button
              onClick={initDevice}
              className="mt-8 px-6 py-3 bg-white/10 rounded-xl text-white font-medium focusable flex items-center gap-2 mx-auto hover:bg-white/20"
              tabIndex={0}
            >
              <RefreshCw className="w-5 h-5" />
              Actualiser
            </button>
          </div>
        )}

        {/* Key hints */}
        <div className="absolute bottom-8 right-8 flex items-center gap-6 text-gray-600 text-sm">
          <span className="flex items-center gap-2">
            <span className="px-2 py-1 bg-oxo-red/30 text-oxo-red rounded text-xs">ROUGE</span>
            Actualiser
          </span>
        </div>
      </div>
    </div>
  );
}



