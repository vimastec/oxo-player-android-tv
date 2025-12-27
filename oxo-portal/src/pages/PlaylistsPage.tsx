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
  MessageSquare,
  ShoppingCart,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { portalApi, Playlist, DeviceInfo } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export default function PlaylistsPage() {
  const navigate = useNavigate();
  const { macAddress, deviceKey, status, expirationDate, logout } = useAuthStore();
  
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

  // Edit modal state
  const [editModal, setEditModal] = useState<{
    show: boolean;
    playlist: Playlist | null;
    pinVerified: boolean; // For protected playlists - must verify PIN first
    name: string;
    url: string;
    host: string;
    username: string;
    password: string;
    epgUrl: string;
    unlockPin: string;
    // For adding protection to unprotected playlist
    enableProtection: boolean;
    newPin: string;
    confirmNewPin: string;
  }>({ 
    show: false, 
    playlist: null, 
    pinVerified: false,
    name: '', 
    url: '', 
    host: '', 
    username: '', 
    password: '', 
    epgUrl: '', 
    unlockPin: '',
    enableProtection: false,
    newPin: '',
    confirmNewPin: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

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

  const openEditModal = (playlist: Playlist) => {
    setEditModal({
      show: true,
      playlist,
      pinVerified: !playlist.is_protected, // If not protected, already "verified"
      name: playlist.name,
      url: playlist.url || '',
      host: '',
      username: playlist.username || '',
      password: playlist.password || '',
      epgUrl: playlist.epg_url || '',
      unlockPin: '',
      enableProtection: false,
      newPin: '',
      confirmNewPin: ''
    });
    setError('');
  };

  const verifyEditPin = async () => {
    if (!editModal.playlist || !macAddress || !deviceKey) return;
    
    setIsVerifyingPin(true);
    setError('');
    
    try {
      // Try to unlock the playlist with the PIN - this returns full playlist data
      const unlockedData = await portalApi.unlockPlaylist(
        editModal.playlist.id,
        macAddress,
        deviceKey,
        editModal.unlockPin
      );
      
      // PIN verified - populate form with the unlocked data
      setEditModal({ 
        ...editModal, 
        pinVerified: true,
        name: unlockedData.name || editModal.name,
        url: unlockedData.playlist_url || '',
        host: unlockedData.xtream_host || '',
        username: unlockedData.xtream_username || '',
        password: unlockedData.xtream_password || '',
        epgUrl: unlockedData.epg_url || ''
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'PIN incorrect');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleEdit = async () => {
    if (!editModal.playlist || !macAddress || !deviceKey) return;
    
    // Validate new PIN if enabling protection
    if (editModal.enableProtection) {
      if (!editModal.newPin || editModal.newPin.length < 4) {
        setError('Le PIN doit contenir au moins 4 caractères');
        return;
      }
      if (editModal.newPin !== editModal.confirmNewPin) {
        setError('Les PINs ne correspondent pas');
        return;
      }
    }
    
    setIsEditing(true);
    setError('');
    
    try {
      const updateData: any = {
        name: editModal.name,
      };

      if (editModal.playlist.playlist_type === 'xtream') {
        if (editModal.host) updateData.host = editModal.host;
        if (editModal.username) updateData.username = editModal.username;
        if (editModal.password) updateData.password = editModal.password;
      } else {
        if (editModal.url) updateData.playlist_url = editModal.url;
      }

      if (editModal.epgUrl) updateData.epg_url = editModal.epgUrl;
      
      // If playlist is protected, include unlock PIN
      if (editModal.playlist.is_protected && editModal.unlockPin) {
        updateData.unlock_pin = editModal.unlockPin;
      }
      
      // If enabling protection on unprotected playlist
      if (editModal.enableProtection && editModal.newPin) {
        updateData.is_protected = true;
        updateData.pin = editModal.newPin;
      }

      await portalApi.updatePlaylist(
        editModal.playlist.id,
        macAddress,
        deviceKey,
        updateData
      );
      
      // Refresh playlists
      await loadDevice();
      closeEditModal();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de modification');
    } finally {
      setIsEditing(false);
    }
  };
  
  const closeEditModal = () => {
    setEditModal({ 
      show: false, 
      playlist: null, 
      pinVerified: false,
      name: '', 
      url: '', 
      host: '', 
      username: '', 
      password: '', 
      epgUrl: '', 
      unlockPin: '',
      enableProtection: false,
      newPin: '',
      confirmNewPin: ''
    });
    setError('');
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

        {/* Activation Banner - Show for trial or expired status */}
        {(status === 'trial' || status === 'expired') && (
          <div className={`mx-0 my-4 p-5 rounded-xl border-2 ${
            status === 'expired' 
              ? 'bg-red-500/10 border-red-500/50' 
              : 'bg-yellow-500/10 border-yellow-500/50'
          }`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  status === 'expired' ? 'bg-red-500/20' : 'bg-yellow-500/20'
                }`}>
                  {status === 'expired' ? (
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  ) : (
                    <Clock className="w-6 h-6 text-yellow-500" />
                  )}
                </div>
                <div>
                  <h3 className={`font-bold text-lg ${
                    status === 'expired' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {status === 'expired' ? '⚠️ Abonnement expiré' : '⏳ Période d\'essai'}
                  </h3>
                  <p className="text-gray-300 text-sm mt-1">
                    {status === 'expired' 
                      ? 'Votre abonnement a expiré. Activez votre MAC pour continuer à utiliser OXO Player.'
                      : `Vous êtes en période d'essai${expirationDate ? ` jusqu'au ${new Date(expirationDate).toLocaleDateString('fr-FR')}` : ''}. Activez votre MAC pour un accès complet.`
                    }
                  </p>
                  <p className="text-gray-400 text-xs mt-2 font-mono">
                    MAC: {macAddress}
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => navigate('/sellers')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  status === 'expired'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-yellow-500 hover:bg-yellow-600 text-black'
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                Acheter une activation
              </button>
            </div>
          </div>
        )}

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
                            onClick={() => openEditModal(playlist)}
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

      {/* Edit modal */}
      {editModal.show && editModal.playlist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full animate-fadeIn max-h-[90vh] overflow-y-auto">
            
            {/* Step 1: PIN verification for protected playlists */}
            {editModal.playlist.is_protected && !editModal.pinVerified ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Lock className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Playlist protégée
                    </h3>
                    <p className="text-sm text-gray-500">
                      Entrez le PIN pour modifier "{editModal.playlist.name}"
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PIN de protection
                  </label>
                  <input
                    type="password"
                    placeholder="Entrez le PIN"
                    value={editModal.unlockPin}
                    onChange={(e) => setEditModal({ ...editModal, unlockPin: e.target.value })}
                    className="!bg-gray-50 !text-gray-900 text-center text-xl tracking-widest"
                    maxLength={10}
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={closeEditModal}
                    className="btn btn-secondary flex-1 !text-gray-700"
                    disabled={isVerifyingPin}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={verifyEditPin}
                    className="btn btn-primary flex-1"
                    disabled={isVerifyingPin || !editModal.unlockPin}
                  >
                    {isVerifyingPin ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Vérifier'
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: Edit form (after PIN verification or for unprotected playlists) */
              <>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Modifier la playlist
                </h3>

                <div className="space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom de la playlist
                    </label>
                    <input
                      type="text"
                      placeholder="Ma playlist"
                      value={editModal.name}
                      onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                      className="!bg-gray-50 !text-gray-900"
                    />
                  </div>

                  {editModal.playlist.playlist_type === 'xtream' ? (
                    <>
                      {/* Host */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Serveur (Host)
                        </label>
                        <input
                          type="text"
                          placeholder="http://example.com:8080"
                          value={editModal.host}
                          onChange={(e) => setEditModal({ ...editModal, host: e.target.value })}
                          className="!bg-gray-50 !text-gray-900 font-mono text-sm"
                        />
                      </div>

                      {/* Username */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nom d'utilisateur
                        </label>
                        <input
                          type="text"
                          placeholder="username"
                          value={editModal.username}
                          onChange={(e) => setEditModal({ ...editModal, username: e.target.value })}
                          className="!bg-gray-50 !text-gray-900"
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Mot de passe
                        </label>
                        <input
                          type="text"
                          placeholder="password"
                          value={editModal.password}
                          onChange={(e) => setEditModal({ ...editModal, password: e.target.value })}
                          className="!bg-gray-50 !text-gray-900"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* M3U URL */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          URL de la playlist
                        </label>
                        <input
                          type="text"
                          placeholder="http://example.com/playlist.m3u"
                          value={editModal.url}
                          onChange={(e) => setEditModal({ ...editModal, url: e.target.value })}
                          className="!bg-gray-50 !text-gray-900 font-mono text-sm"
                        />
                      </div>
                    </>
                  )}

                  {/* EPG URL */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL EPG (optionnel)
                    </label>
                    <input
                      type="text"
                      placeholder="http://example.com/epg.xml"
                      value={editModal.epgUrl}
                      onChange={(e) => setEditModal({ ...editModal, epgUrl: e.target.value })}
                      className="!bg-gray-50 !text-gray-900 font-mono text-sm"
                    />
                  </div>

                  {/* Add protection option (only for unprotected playlists) */}
                  {!editModal.playlist.is_protected && (
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editModal.enableProtection}
                          onChange={(e) => setEditModal({ 
                            ...editModal, 
                            enableProtection: e.target.checked,
                            newPin: '',
                            confirmNewPin: ''
                          })}
                          className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">
                            Protéger cette playlist avec un PIN
                          </span>
                        </div>
                      </label>

                      {editModal.enableProtection && (
                        <div className="mt-4 space-y-3 pl-8">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Nouveau PIN
                            </label>
                            <input
                              type="password"
                              placeholder="Minimum 4 caractères"
                              value={editModal.newPin}
                              onChange={(e) => setEditModal({ ...editModal, newPin: e.target.value })}
                              className="!bg-gray-50 !text-gray-900"
                              maxLength={10}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Confirmer le PIN
                            </label>
                            <input
                              type="password"
                              placeholder="Répétez le PIN"
                              value={editModal.confirmNewPin}
                              onChange={(e) => setEditModal({ ...editModal, confirmNewPin: e.target.value })}
                              className="!bg-gray-50 !text-gray-900"
                              maxLength={10}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={closeEditModal}
                    className="btn btn-secondary flex-1 !text-gray-700"
                    disabled={isEditing}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleEdit}
                    className="btn btn-primary flex-1"
                    disabled={isEditing || !editModal.name || (editModal.enableProtection && (!editModal.newPin || editModal.newPin !== editModal.confirmNewPin))}
                  >
                    {isEditing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Enregistrer'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

