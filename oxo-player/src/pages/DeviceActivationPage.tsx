import { useEffect, useState } from 'react';
import {
  generateDeviceMac,
  registerDevice,
  getPlaylistContent,
  getPlaylist,
  type DeviceRegistration,
} from '../services/deviceApi';
import { useAppStore } from '../stores/appStore';
import { parseM3U } from '../services/m3uParser';
import type { XtreamCredentials } from '../types';

/**
 * Extrait les credentials Xtream d'une URL de playlist
 * URLs supportées:
 * - http://server/get.php?username=xxx&password=yyy&type=m3u_plus
 * - http://server:port/get.php?username=xxx&password=yyy
 */
function extractXtreamCredentials(playlistUrl: string): XtreamCredentials | null {
  try {
    const url = new URL(playlistUrl);
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');
    
    if (username && password) {
      // Construire l'URL du serveur (sans le path)
      const server = `${url.protocol}//${url.host}`;
      console.log('✅ Xtream credentials extracted:', { server, username });
      return { server, username, password };
    }
  } catch (error) {
    console.warn('Could not extract Xtream credentials:', error);
  }
  return null;
}

interface DeviceActivationPageProps {
  onActivated: (expirationDate?: string) => void;
}

// Icônes SVG simples
const LoaderIcon = ({ spinning = false }: { spinning?: boolean }) => (
  <svg 
    width="64" 
    height="64" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    style={spinning ? { animation: 'spin 1s linear infinite' } : {}}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);

const TvIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
    <polyline points="17 2 12 7 7 2"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

export function DeviceActivationPage({ onActivated }: DeviceActivationPageProps) {
  const [macAddress, setMacAddress] = useState<string>('');
  const [deviceInfo, setDeviceInfo] = useState<DeviceRegistration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [buttonFocused, setButtonFocused] = useState(false);

  const {
    setLiveChannels,
    setLiveCategories,
    setMovies,
    setVodCategories,
    setSeries,
    setSeriesCategories,
    setSeriesEpisodes,
    setConnected,
    setCredentials,
  } = useAppStore();

  // Laisser Samsung gérer la navigation automatiquement via tabindex

  useEffect(() => {
    initDevice();
  }, []);

  const initDevice = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const mac = generateDeviceMac();
      setMacAddress(mac);

      const registration = await registerDevice(mac);
      setDeviceInfo(registration);

      if (registration.has_playlist && (registration.status === 'active' || registration.status === 'trial')) {
        await loadPlaylist(mac, registration.expiration_date);
      }
    } catch (err) {
      console.error('Device init error:', err);
      setError('Impossible de se connecter au serveur. Vérifiez votre connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlaylist = async (mac: string, expDate?: string) => {
    setLoadingPlaylist(true);
    setLoadingProgress(0);
    setError(null);
    
    try {
      setLoadingProgress(5);
      
      // 1. Récupérer les infos de la playlist (incluant l'URL)
      const playlistInfo = await getPlaylist(mac);
      console.log('📋 Playlist info:', playlistInfo);
      
      // 2. Extraire les credentials Xtream si c'est une URL Xtream
      if (playlistInfo.playlist_url) {
        const xtreamCreds = extractXtreamCredentials(playlistInfo.playlist_url);
        if (xtreamCreds) {
          setCredentials(xtreamCreds);
          console.log('🔑 Xtream credentials stored for API calls');
        }
      }
      
      setLoadingProgress(10);
      
      // 3. Charger le contenu de la playlist
      const playlistContent = await getPlaylistContent(mac);
      setLoadingProgress(30);
      
      if (!playlistContent || playlistContent.length < 100) {
        setError('La playlist est vide ou invalide');
        return;
      }

      // 4. Parser la playlist
      const result = await parseM3U(playlistContent, (progress) => {
        setLoadingProgress(30 + Math.round(progress.percent * 0.6));
      });
      
      setLoadingProgress(95);
      
      // Vérifier qu'on a du contenu (channels OU movies OU series)
      const totalContent = result.channels.length + result.movies.length + result.series.length;
      if (totalContent === 0) {
        setError('Aucun contenu trouvé dans la playlist');
        return;
      }

      // 5. Enregistrer toutes les données de la playlist (live + VOD + séries)
      setLiveChannels(result.channels);
      setLiveCategories(result.categories.live);
      setMovies(result.movies);
      setVodCategories(result.categories.vod);
      setSeries(result.series);
      setSeriesCategories(result.categories.series);
      setSeriesEpisodes(result.seriesEpisodes);
      setConnected(true);
      setLoadingProgress(100);
      
      console.log('✅ Playlist loaded successfully:', {
        channels: result.channels.length,
        movies: result.movies.length,
        series: result.series.length,
        seriesWithEpisodes: Object.keys(result.seriesEpisodes).length,
      });
      
      onActivated(expDate);
    } catch (err: unknown) {
      console.error('Playlist load error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Erreur lors du chargement: ${errorMessage}`);
    } finally {
      setLoadingPlaylist(false);
    }
  };

  const handleCopyMac = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(macAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Styles
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#0a0a0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: 'Arial, sans-serif',
    color: '#e2e8f0',
  };

  const contentStyle: React.CSSProperties = {
    maxWidth: '500px',
    width: '100%',
  };

  const logoStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    marginBottom: '32px',
  };

  const logoBoxStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '96px',
    height: '96px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    marginBottom: '16px',
  };

  const logoTextStyle: React.CSSProperties = {
    fontSize: '36px',
    fontWeight: 'bold',
    color: 'white',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '30px',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: 'white',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#12121a',
    border: '1px solid #1e1e2e',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '24px',
  };

  const macDisplayStyle: React.CSSProperties = {
    backgroundColor: '#050508',
    border: '2px dashed #1e1e2e',
    borderRadius: '12px',
    padding: '24px',
    textAlign: 'center' as const,
    cursor: 'pointer',
  };

  const macTextStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: '8px',
    letterSpacing: '2px',
  };

  const statusRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '8px',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '16px',
    backgroundColor: buttonFocused ? '#b91c1c' : '#dc2626',
    color: 'white',
    fontSize: '18px',
    fontWeight: 600,
    borderRadius: '12px',
    border: buttonFocused ? '3px solid white' : 'none',
    cursor: loadingPlaylist ? 'not-allowed' : 'pointer',
    opacity: loadingPlaylist ? 0.7 : 1,
    marginTop: '24px',
    outline: 'none',
    transform: buttonFocused ? 'scale(1.02)' : 'scale(1)',
    transition: 'all 0.2s',
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#dc2626', marginBottom: '16px' }}>
            <LoaderIcon spinning />
          </div>
          <p style={{ fontSize: '20px' }}>Connexion au serveur...</p>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error && !deviceInfo) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <AlertIcon />
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '24px 0 16px', color: 'white' }}>
            Erreur de connexion
          </h1>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>{error}</p>
          <button 
            style={buttonStyle}
            onClick={initDevice}
            onFocus={() => setButtonFocused(true)}
            onBlur={() => setButtonFocused(false)}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        {/* Logo */}
        <div style={logoStyle}>
          <img
            src="/oxo-logo.png"
            alt="OXO Player"
            style={{
              width: '120px',
              height: '120px',
              marginBottom: '16px',
              borderRadius: '16px',
              objectFit: 'contain'
            }}
          />
          <h1 style={{ ...titleStyle, color: '#dc2626' }}>OXO PLAYER</h1>
        </div>

        {/* MAC Card */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
            <span style={{ color: '#dc2626' }}><TvIcon /></span>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'white' }}>Votre code d'activation</h2>
          </div>

          <div style={macDisplayStyle} onClick={handleCopyMac}>
            <p style={macTextStyle}>{macAddress}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#64748b', fontSize: '14px' }}>
              {copied ? (
                <>
                  <span style={{ color: '#10b981' }}><CheckIcon /></span>
                  <span style={{ color: '#10b981' }}>Copié !</span>
                </>
              ) : (
                <>
                  <CopyIcon />
                  <span>Cliquez pour copier</span>
                </>
              )}
            </div>
          </div>

          {/* Status */}
          {deviceInfo && (
            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#050508', borderRadius: '12px' }}>
              <div style={statusRowStyle}>
                <span style={{ color: '#64748b' }}>Statut</span>
                {deviceInfo.status === 'active' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
                    <CheckIcon /> Actif
                  </span>
                ) : deviceInfo.status === 'trial' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
                    <ClockIcon /> Essai ({deviceInfo.days_remaining} jours)
                  </span>
                ) : (
                  <span style={{ color: '#ef4444' }}>
                    {deviceInfo.status === 'expired' ? 'Expiré' : 'Non activé'}
                  </span>
                )}
              </div>

              {deviceInfo.expiration_date && (
                <div style={statusRowStyle}>
                  <span style={{ color: '#64748b' }}>Expiration</span>
                  <span style={{ color: 'white' }}>{new Date(deviceInfo.expiration_date).toLocaleDateString('fr-FR')}</span>
                </div>
              )}

              <div style={statusRowStyle}>
                <span style={{ color: '#64748b' }}>Playlist</span>
                <span style={{ color: deviceInfo.has_playlist ? '#10b981' : '#f59e0b' }}>
                  {deviceInfo.has_playlist ? '✓ Configurée' : '✗ Non configurée'}
                </span>
              </div>

              {!deviceInfo.has_playlist && (deviceInfo.status === 'active' || deviceInfo.status === 'trial') && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px' }}>
                  <p style={{ fontSize: '14px', color: '#f59e0b' }}>
                    ⚠️ Aucune playlist configurée. Contactez votre revendeur.
                  </p>
                </div>
              )}

              {error && (
                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <p style={{ fontSize: '14px', color: '#ef4444' }}>{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 600, marginBottom: '16px', color: 'white' }}>Pour activer votre appareil :</h3>
          <ol style={{ listStyle: 'none', padding: 0 }}>
            {[
              'Notez le code MAC ci-dessus',
              'Contactez votre revendeur avec ce code',
              'Le revendeur activera votre appareil',
              'Cliquez sur "Actualiser" pour charger vos chaînes',
            ].map((text, i) => (
              <li key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px', fontSize: '14px', color: '#64748b' }}>
                <span style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(220, 38, 38, 0.2)',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}>{i + 1}</span>
                <span>{text}</span>
              </li>
            ))}
          </ol>

          {/* Progress bar */}
          {loadingPlaylist && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ height: '8px', backgroundColor: '#1e1e2e', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${loadingProgress}%`,
                  backgroundColor: '#dc2626',
                  transition: 'width 0.3s',
                }} />
              </div>
              <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '14px', color: '#64748b' }}>
                Chargement... {loadingProgress}%
              </p>
            </div>
          )}

          <button
            tabIndex={1}
            autoFocus
            style={buttonStyle}
            onClick={initDevice}
            disabled={loadingPlaylist}
            onFocus={() => setButtonFocused(true)}
            onBlur={() => setButtonFocused(false)}
          >
            {loadingPlaylist ? 'Chargement...' : 'Actualiser'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '14px', color: '#64748b', marginTop: '24px' }}>
          OXO Player v1.0
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
