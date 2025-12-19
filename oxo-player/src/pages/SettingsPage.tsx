import { useState } from 'react';
import { 
  Settings, 
  User, 
  Server, 
  Trash2, 
  Download,
  Info,
  ArrowLeft
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';

interface SettingsPageProps {
  onBack?: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { 
    userInfo, 
    serverInfo, 
    credentials,
    playbackProgress,
    favorites,
    disconnect 
  } = useAppStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const clearAllData = () => {
    localStorage.clear();
    window.location.reload();
  };

  const formatDate = (timestamp: string | number) => {
    const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp) * 1000 : timestamp * 1000);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStorageSize = () => {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
      }
    }
    return formatBytes(total);
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-oxo-muted hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>
        )}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-oxo-primary/20 flex items-center justify-center">
            <Settings className="w-6 h-6 text-oxo-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Paramètres</h1>
            <p className="text-oxo-muted">Configuration de l'application</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Account info */}
          {userInfo && (
            <section className="bg-oxo-card border border-oxo-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-5 h-5 text-oxo-primary" />
                <h2 className="font-semibold text-lg">Compte</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-oxo-darker rounded-xl">
                  <p className="text-sm text-oxo-muted mb-1">Nom d'utilisateur</p>
                  <p className="font-medium">{userInfo.username}</p>
                </div>
                <div className="p-4 bg-oxo-darker rounded-xl">
                  <p className="text-sm text-oxo-muted mb-1">Statut</p>
                  <p className={`font-medium ${
                    userInfo.status === 'Active' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {userInfo.status === 'Active' ? '✓ Actif' : '✗ Inactif'}
                  </p>
                </div>
                <div className="p-4 bg-oxo-darker rounded-xl">
                  <p className="text-sm text-oxo-muted mb-1">Expiration</p>
                  <p className="font-medium">{formatDate(userInfo.exp_date)}</p>
                </div>
                <div className="p-4 bg-oxo-darker rounded-xl">
                  <p className="text-sm text-oxo-muted mb-1">Connexions max</p>
                  <p className="font-medium">{userInfo.max_connections}</p>
                </div>
              </div>
            </section>
          )}

          {/* Server info */}
          {serverInfo && credentials && (
            <section className="bg-oxo-card border border-oxo-border rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Server className="w-5 h-5 text-oxo-primary" />
                <h2 className="font-semibold text-lg">Serveur</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-oxo-darker rounded-xl">
                  <p className="text-sm text-oxo-muted mb-1">URL</p>
                  <p className="font-medium truncate">{credentials.server}</p>
                </div>
                <div className="p-4 bg-oxo-darker rounded-xl">
                  <p className="text-sm text-oxo-muted mb-1">Port</p>
                  <p className="font-medium">{serverInfo.port}</p>
                </div>
                <div className="p-4 bg-oxo-darker rounded-xl">
                  <p className="text-sm text-oxo-muted mb-1">Fuseau horaire</p>
                  <p className="font-medium">{serverInfo.timezone}</p>
                </div>
                <div className="p-4 bg-oxo-darker rounded-xl">
                  <p className="text-sm text-oxo-muted mb-1">Heure serveur</p>
                  <p className="font-medium">{serverInfo.time_now}</p>
                </div>
              </div>
            </section>
          )}

          {/* Storage info */}
          <section className="bg-oxo-card border border-oxo-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Download className="w-5 h-5 text-oxo-primary" />
              <h2 className="font-semibold text-lg">Stockage local</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-oxo-darker rounded-xl">
                <p className="text-sm text-oxo-muted mb-1">Favoris</p>
                <p className="font-medium text-xl">{favorites.length}</p>
              </div>
              <div className="p-4 bg-oxo-darker rounded-xl">
                <p className="text-sm text-oxo-muted mb-1">Progression sauvegardée</p>
                <p className="font-medium text-xl">{Object.keys(playbackProgress).length}</p>
              </div>
              <div className="p-4 bg-oxo-darker rounded-xl">
                <p className="text-sm text-oxo-muted mb-1">Espace utilisé</p>
                <p className="font-medium text-xl">{getStorageSize()}</p>
              </div>
            </div>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 
                rounded-xl hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              Effacer toutes les données
            </button>
          </section>

          {/* About */}
          <section className="bg-oxo-card border border-oxo-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Info className="w-5 h-5 text-oxo-primary" />
              <h2 className="font-semibold text-lg">À propos</h2>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-oxo-primary to-oxo-secondary
                flex items-center justify-center">
                <span className="text-2xl font-bold">OXO</span>
              </div>
              <div>
                <h3 className="font-bold text-xl">OXO Player</h3>
                <p className="text-oxo-muted">Version 1.0.0</p>
              </div>
            </div>
            <p className="text-oxo-muted text-sm">
              Application IPTV moderne avec support Xtream Codes et M3U.
              Profitez de vos chaînes TV, films et séries en streaming.
            </p>
          </section>

          {/* Disconnect button */}
          <button
            onClick={disconnect}
            className="w-full py-4 bg-red-500/10 text-red-400 rounded-xl 
              font-semibold hover:bg-red-500/20 transition-colors"
          >
            Se déconnecter
          </button>
        </div>
      </div>

      {/* Clear data confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-oxo-card border border-oxo-border rounded-2xl p-6 max-w-md mx-4 animate-scale-in">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-xl font-bold text-center mb-2">Effacer toutes les données ?</h3>
            <p className="text-oxo-muted text-center mb-6">
              Cette action supprimera tous vos favoris, la progression de lecture et les identifiants sauvegardés.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 bg-oxo-border rounded-xl font-medium hover:bg-oxo-muted/20 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={clearAllData}
                className="flex-1 py-3 bg-red-500 rounded-xl font-medium hover:bg-red-600 transition-colors"
              >
                Effacer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

