import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, Server } from 'lucide-react';
import { resellerApi } from '../../services/api';

export function AddXtreamPage() {
  const navigate = useNavigate();
  const { mac } = useParams<{ mac: string }>();
  
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Le nom de la playlist est requis');
      return;
    }
    
    if (!host.trim()) {
      setError('L\'hôte du serveur est requis');
      return;
    }
    
    if (!username.trim()) {
      setError('Le nom d\'utilisateur est requis');
      return;
    }
    
    if (!password.trim()) {
      setError('Le mot de passe est requis');
      return;
    }

    if (!mac) {
      setError('MAC address manquante');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await resellerApi.addDeviceXtreamPlaylist(mac, name, host, username, password, epgUrl || undefined);
      setSuccess(true);
      setTimeout(() => {
        navigate(`/reseller/devices/${mac}/playlists`);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'ajout');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center animate-fadeIn">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Playlist Xtream ajoutée !</h2>
          <p className="text-gray-400">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header card - Mobile optimized */}
      <div className="card !rounded-t-2xl !rounded-b-none border-b-0">
        <div className="flex items-center gap-4 -m-6 p-4">
            <button
              onClick={() => navigate(`/reseller/devices/${mac}/playlists`)}
              className="p-3 hover:bg-dark rounded-xl transition-colors flex-shrink-0"
              aria-label="Retour"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg sm:text-xl font-bold">Add XC Playlist</h1>
          </div>
        </div>

        {/* Form card */}
        <div className="card !rounded-t-none !rounded-b-2xl !border-t-0 animate-fadeIn">
          {/* Info box */}
          <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/30 rounded-xl mb-6">
            <Server className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Xtream Codes API</p>
              <p className="text-muted text-sm">
                Entrez les identifiants fournis par votre fournisseur IPTV pour accéder au contenu via l'API Xtream Codes.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Playlist name */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Playlist name
              </label>
              <input
                type="text"
                placeholder="My IPTV"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="text-base"
              />
            </div>

            {/* Server Host */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Server URL / Host
              </label>
              <input
                type="text"
                placeholder="http://example.com:8080 or example.com"
                value={host}
                onChange={(e) => {
                  setHost(e.target.value);
                  setError('');
                }}
                className="text-base"
              />
              <p className="text-xs text-muted mt-1">
                Exemples: http://iptv.example.com:8080 ou iptv.example.com
              </p>
            </div>

            {/* Two column layout for username and password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Votre nom d'utilisateur"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  className="text-base"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Password
                </label>
                <input
                  type="text"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="text-base"
                />
              </div>
            </div>

            {/* EPG URL */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                XMLTV EPG URL (Optional)
              </label>
              <input
                type="url"
                placeholder="http://example.com/epg.xml"
                value={epgUrl}
                onChange={(e) => setEpgUrl(e.target.value)}
                className="text-base"
              />
              <p className="text-xs text-muted mt-1">
                Laissez vide pour utiliser l'EPG du serveur Xtream
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-error/10 border border-error/30 text-error">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Submit button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary px-8 py-3 text-base min-w-[140px]"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'SAVE'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}

