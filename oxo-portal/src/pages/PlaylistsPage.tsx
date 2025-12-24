import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Pencil, 
  Trash2, 
  LogOut, 
  Loader2,
  Lock,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { portalApi, Playlist, DeviceInfo } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export default function PlaylistsPage() {
  const navigate = useNavigate();
  const { macAddress, deviceKey, logout } = useAuthStore();
  
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    show: boolean;
    playlist: Playlist | null;
    pin: string;
  }>({ show: false, playlist: null, pin: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadDevice();
  }, []);

  const loadDevice = async () => {
    if (!macAddress || !deviceKey) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const info = await portalApi.getDevice(macAddress, deviceKey);
      setDeviceInfo(info);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de chargement');
      if (err.response?.status === 401) {
        logout();
        navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.playlist || !macAddress || !deviceKey) return;
    
    setIsDeleting(true);
    
    try {
      await portalApi.deletePlaylist(
        deleteModal.playlist.id,
        macAddress,
        deviceKey,
        deleteModal.playlist.is_protected ? deleteModal.pin : undefined
      );
      
      // Refresh playlists
      await loadDevice();
      setDeleteModal({ show: false, playlist: null, pin: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const filteredPlaylists = deviceInfo?.playlists.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        {/* Title card */}
        <div className="bg-white rounded-t-2xl px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">Manage Playlists</h1>
        </div>

        {/* Main content card */}
        <div className="bg-gray-50 rounded-b-2xl p-6 animate-fadeIn">
          {/* Search and actions bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="!bg-white !pl-10 !border-gray-200 !text-gray-900 !placeholder-gray-400"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* MAC Address badge */}
              <div className="hidden md:flex items-center px-4 py-2.5 bg-dark-300 rounded-lg text-white font-mono text-sm">
                {macAddress}
              </div>

              {/* Add Playlist button */}
              <button
                onClick={() => navigate('/add-playlist')}
                className="btn btn-primary flex-1 md:flex-none"
              >
                Add Playlist
              </button>

              {/* Add XC Playlist button */}
              <button
                onClick={() => navigate('/add-xtream')}
                className="btn btn-primary flex-1 md:flex-none"
              >
                Add XC Playlist
              </button>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="btn btn-secondary !px-3"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-4 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-600">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Playlists table */}
          <div className="bg-white rounded-xl overflow-hidden border border-gray-200">
            <table>
              <thead>
                <tr className="bg-gray-50">
                  <th className="!text-gray-600">Playlist</th>
                  <th className="!text-gray-600">URL</th>
                  <th className="!text-gray-600">Username</th>
                  <th className="!text-gray-600">Password</th>
                  <th className="!text-gray-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlaylists.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500">
                      {searchTerm 
                        ? 'Aucune playlist trouvée'
                        : 'Aucune playlist. Cliquez sur "Add Playlist" pour commencer.'
                      }
                    </td>
                  </tr>
                ) : (
                  filteredPlaylists.map((playlist) => (
                    <tr key={playlist.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="text-gray-900 font-medium">
                        <div className="flex items-center gap-2">
                          {playlist.name}
                          {playlist.is_protected && (
                            <Lock className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="text-gray-600">
                        {playlist.is_protected ? (
                          <span className="text-gray-400 italic">Protected</span>
                        ) : (
                          <span className="font-mono text-sm truncate max-w-xs block">
                            {playlist.url || '-'}
                          </span>
                        )}
                      </td>
                      <td className="text-gray-600">
                        {playlist.playlist_type === 'xtream' ? (
                          playlist.is_protected ? (
                            <span className="text-gray-400 italic">Protected</span>
                          ) : (
                            playlist.username || '-'
                          )
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="text-gray-600">
                        {playlist.playlist_type === 'xtream' ? (
                          <span className="text-gray-400 italic">Protected</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          {/* Edit button */}
                          <button
                            onClick={() => {
                              // TODO: Implement edit
                            }}
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          
                          {/* Delete button */}
                          <button
                            onClick={() => setDeleteModal({
                              show: true,
                              playlist,
                              pin: ''
                            })}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Device info */}
          <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
            <span>
              Status: <span className={`font-medium ${
                deviceInfo?.status === 'active' ? 'text-green-600' : 
                deviceInfo?.status === 'trial' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {deviceInfo?.status === 'active' ? 'Actif' :
                 deviceInfo?.status === 'trial' ? 'Période d\'essai' : 'Expiré'}
              </span>
            </span>
            {deviceInfo?.expiration_date && (
              <span>
                Expire le: {new Date(deviceInfo.expiration_date).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
        </div>

        {/* Chat button (like IBO Player) */}
        <button className="fixed bottom-6 right-6 w-14 h-14 bg-primary hover:bg-primary-hover rounded-full flex items-center justify-center shadow-lg transition-colors">
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Delete confirmation modal */}
      {deleteModal.show && deleteModal.playlist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full animate-fadeIn">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Supprimer la playlist
            </h3>
            
            <p className="text-gray-600 mb-4">
              Êtes-vous sûr de vouloir supprimer la playlist "{deleteModal.playlist.name}" ?
            </p>

            {deleteModal.playlist.is_protected && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PIN de protection
                </label>
                <input
                  type="password"
                  placeholder="Entrez le PIN"
                  value={deleteModal.pin}
                  onChange={(e) => setDeleteModal({ ...deleteModal, pin: e.target.value })}
                  className="!bg-gray-50 !text-gray-900"
                />
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteModal({ show: false, playlist: null, pin: '' });
                  setError('');
                }}
                className="btn btn-secondary flex-1 !text-gray-700"
                disabled={isDeleting}
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-danger flex-1"
                disabled={isDeleting || (deleteModal.playlist.is_protected && !deleteModal.pin)}
              >
                {isDeleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Supprimer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

