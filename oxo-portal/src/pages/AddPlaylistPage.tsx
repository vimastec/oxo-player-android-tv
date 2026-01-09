import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, Lock } from 'lucide-react';
import { portalApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

export default function AddPlaylistPage() {
  const navigate = useNavigate();
  const { macAddress, deviceKey } = useAuthStore();
  
  const [name, setName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Le nom de la playlist est requis');
      return;
    }
    
    if (!playlistUrl.trim()) {
      setError('L\'URL de la playlist est requise');
      return;
    }
    
    if (!playlistUrl.startsWith('http://') && !playlistUrl.startsWith('https://')) {
      setError('L\'URL doit commencer par http:// ou https://');
      return;
    }
    
    if (isProtected) {
      if (!pin || pin.length < 4) {
        setError('Le PIN doit contenir au moins 4 caractères');
        return;
      }
      if (pin !== confirmPin) {
        setError('Les PINs ne correspondent pas');
        return;
      }
    }

    if (!macAddress || !deviceKey) {
      setError('Session expirée');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await portalApi.addPlaylist(
        macAddress,
        deviceKey,
        name,
        playlistUrl,
        epgUrl || undefined,
        isProtected,
        isProtected ? pin : undefined
      );

      setSuccess(true);
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/playlists');
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
          <h2 className="text-xl font-semibold text-white mb-2">Playlist ajoutée !</h2>
          <p className="text-gray-400">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header card */}
        <div className="bg-white rounded-t-2xl px-6 py-4">
          <button
            onClick={() => navigate('/playlists')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold text-lg">Add Playlist</span>
          </button>
        </div>

        {/* Form card */}
        <div className="bg-gray-50 rounded-b-2xl p-6 animate-fadeIn">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Two column layout for name and URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Playlist name */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Playlist name
                </label>
                <input
                  type="text"
                  placeholder="My Playlist"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError('');
                  }}
                  className="!bg-white !text-gray-900 !placeholder-gray-400 !border-gray-200"
                />
              </div>

              {/* Playlist URL */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Playlist URL (.M3U or .M3u8)
                </label>
                <input
                  type="url"
                  placeholder="http://example.com/playlist.m3u"
                  value={playlistUrl}
                  onChange={(e) => {
                    setPlaylistUrl(e.target.value);
                    setError('');
                  }}
                  className="!bg-white !text-gray-900 !placeholder-gray-400 !border-gray-200"
                />
              </div>
            </div>

            {/* EPG URL */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                XMLTV EPG URL (Optional)
              </label>
              <input
                type="url"
                placeholder="http://example.com/epg.xml"
                value={epgUrl}
                onChange={(e) => setEpgUrl(e.target.value)}
                className="!bg-white !text-gray-900 !placeholder-gray-400 !border-gray-200"
              />
            </div>

            {/* Protection checkbox */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="protect"
                checked={isProtected}
                onChange={(e) => setIsProtected(e.target.checked)}
                className="!w-5 !h-5 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
              <div>
                <label htmlFor="protect" className="text-gray-900 font-medium cursor-pointer flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Protect this playlist
                </label>
                <p className="text-sm text-primary mt-1">
                  <strong>NOTE:</strong> Protected playlists will not be viewed or modified without entering PIN
                </p>
              </div>
            </div>

            {/* PIN fields (shown when protection is enabled) */}
            {isProtected && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-100 rounded-xl border border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    PIN
                  </label>
                  <input
                    type="password"
                    placeholder="Enter PIN (min 4 characters)"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      setError('');
                    }}
                    className="!bg-white !text-gray-900 !placeholder-gray-400 !border-gray-200"
                    maxLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    placeholder="Confirm PIN"
                    value={confirmPin}
                    onChange={(e) => {
                      setConfirmPin(e.target.value);
                      setError('');
                    }}
                    className="!bg-white !text-gray-900 !placeholder-gray-400 !border-gray-200"
                    maxLength={8}
                  />
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary px-8"
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
    </div>
  );
}











