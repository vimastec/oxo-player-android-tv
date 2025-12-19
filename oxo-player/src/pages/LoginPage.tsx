import { useState } from 'react';
import { Tv, Link, Upload, Loader2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import xtreamApi from '../services/xtreamApi';
import { loadM3UFromUrl, loadM3UFromFile } from '../services/m3uParser';

type ConnectionType = 'xtream' | 'm3u-url' | 'm3u-file';

export function LoginPage() {
  const [connectionType, setConnectionType] = useState<ConnectionType>('xtream');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Xtream fields
  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // M3U fields
  const [m3uUrl, setM3uUrl] = useState('');

  const {
    setCredentials,
    setUserInfo,
    setServerInfo,
    setConnected,
    setLiveChannels,
    setLiveCategories,
    setVodCategories,
    setSeriesCategories,
    setMovies,
    setSeries,
  } = useAppStore();

  const handleXtreamConnect = async () => {
    if (!server || !username || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const credentials = { server, username, password };
      xtreamApi.setCredentials(credentials);

      const authData = await xtreamApi.authenticate();
      
      setCredentials(credentials);
      setUserInfo(authData.user_info);
      setServerInfo(authData.server_info);

      // Load categories
      const [liveCategories, vodCategories, seriesCategories] = await Promise.all([
        xtreamApi.getLiveCategories(),
        xtreamApi.getVodCategories(),
        xtreamApi.getSeriesCategories(),
      ]);

      setLiveCategories(liveCategories || []);
      setVodCategories(vodCategories || []);
      setSeriesCategories(seriesCategories || []);

      // Load initial content
      const [liveStreams, movies, series] = await Promise.all([
        xtreamApi.getLiveStreams(),
        xtreamApi.getVodStreams(),
        xtreamApi.getSeries(),
      ]);

      setLiveChannels(liveStreams || []);
      setMovies(movies || []);
      setSeries(series || []);

      setConnected(true);
    } catch (err) {
      console.error('Connection error:', err);
      setError('Échec de la connexion. Vérifiez vos identifiants.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleM3UUrlConnect = async () => {
    if (!m3uUrl) {
      setError('Veuillez entrer une URL M3U');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { channels, categories } = await loadM3UFromUrl(m3uUrl);
      
      setLiveChannels(channels);
      setLiveCategories(categories);
      setConnected(true);
    } catch (err) {
      console.error('M3U error:', err);
      setError('Échec du chargement de la playlist M3U');
    } finally {
      setIsLoading(false);
    }
  };

  const handleM3UFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const { channels, categories } = await loadM3UFromFile(file);
      
      setLiveChannels(channels);
      setLiveCategories(categories);
      setConnected(true);
    } catch (err) {
      console.error('M3U file error:', err);
      setError('Échec du chargement du fichier M3U');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-oxo-dark flex items-center justify-center p-6">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-oxo-primary/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-oxo-secondary/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl 
            bg-gradient-to-br from-oxo-primary to-oxo-secondary mb-4 animate-pulse-glow">
            <span className="text-3xl font-bold">OXO</span>
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">OXO Player</h1>
          <p className="text-oxo-muted">Connectez-vous pour accéder à vos contenus</p>
        </div>

        {/* Connection type tabs */}
        <div className="flex gap-2 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <button
            onClick={() => setConnectionType('xtream')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl 
              font-medium transition-all ${
              connectionType === 'xtream'
                ? 'bg-oxo-primary text-white'
                : 'bg-oxo-card border border-oxo-border hover:border-oxo-primary'
            }`}
          >
            <Tv className="w-5 h-5" />
            <span>Xtream</span>
          </button>
          <button
            onClick={() => setConnectionType('m3u-url')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl 
              font-medium transition-all ${
              connectionType === 'm3u-url'
                ? 'bg-oxo-primary text-white'
                : 'bg-oxo-card border border-oxo-border hover:border-oxo-primary'
            }`}
          >
            <Link className="w-5 h-5" />
            <span>M3U URL</span>
          </button>
          <button
            onClick={() => setConnectionType('m3u-file')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl 
              font-medium transition-all ${
              connectionType === 'm3u-file'
                ? 'bg-oxo-primary text-white'
                : 'bg-oxo-card border border-oxo-border hover:border-oxo-primary'
            }`}
          >
            <Upload className="w-5 h-5" />
            <span>Fichier</span>
          </button>
        </div>

        {/* Form */}
        <div className="bg-oxo-card border border-oxo-border rounded-2xl p-6 animate-slide-up"
          style={{ animationDelay: '0.2s' }}>
          
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/30 
              rounded-xl text-red-400 animate-scale-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {connectionType === 'xtream' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-oxo-muted mb-2">
                  URL du serveur
                </label>
                <input
                  type="url"
                  placeholder="http://example.com:8080"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="w-full px-4 py-3 bg-oxo-darker border border-oxo-border rounded-xl
                    text-white placeholder-oxo-muted focus:outline-none focus:border-oxo-primary
                    transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-oxo-muted mb-2">
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  placeholder="Votre nom d'utilisateur"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-oxo-darker border border-oxo-border rounded-xl
                    text-white placeholder-oxo-muted focus:outline-none focus:border-oxo-primary
                    transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-oxo-muted mb-2">
                  Mot de passe
                </label>
                <input
                  type="password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-oxo-darker border border-oxo-border rounded-xl
                    text-white placeholder-oxo-muted focus:outline-none focus:border-oxo-primary
                    transition-colors"
                />
              </div>
              <button
                onClick={handleXtreamConnect}
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-oxo-primary to-oxo-secondary
                  rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity
                  disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </div>
          )}

          {connectionType === 'm3u-url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-oxo-muted mb-2">
                  URL de la playlist M3U
                </label>
                <input
                  type="url"
                  placeholder="http://example.com/playlist.m3u"
                  value={m3uUrl}
                  onChange={(e) => setM3uUrl(e.target.value)}
                  className="w-full px-4 py-3 bg-oxo-darker border border-oxo-border rounded-xl
                    text-white placeholder-oxo-muted focus:outline-none focus:border-oxo-primary
                    transition-colors"
                />
              </div>
              <button
                onClick={handleM3UUrlConnect}
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-oxo-primary to-oxo-secondary
                  rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity
                  disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Chargement...
                  </>
                ) : (
                  'Charger la playlist'
                )}
              </button>
            </div>
          )}

          {connectionType === 'm3u-file' && (
            <div className="space-y-4">
              <label className="block">
                <div className="border-2 border-dashed border-oxo-border rounded-xl p-8
                  hover:border-oxo-primary transition-colors cursor-pointer text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-oxo-muted" />
                  <p className="font-medium mb-1">Glissez votre fichier M3U ici</p>
                  <p className="text-sm text-oxo-muted">ou cliquez pour sélectionner</p>
                </div>
                <input
                  type="file"
                  accept=".m3u,.m3u8"
                  onChange={handleM3UFileUpload}
                  className="hidden"
                />
              </label>
              {isLoading && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-oxo-primary" />
                  <span>Chargement du fichier...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-oxo-muted mt-6 animate-fade-in"
          style={{ animationDelay: '0.4s' }}>
          OXO Player v1.0 • Application IPTV
        </p>
      </div>
    </div>
  );
}




