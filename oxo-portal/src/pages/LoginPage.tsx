import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { portalApi, Captcha } from '../services/api';
import { useAuthStore } from '../stores/authStore';

// Helper function to get URL params (outside component to avoid re-creation)
function getInitialUrlParams() {
  if (typeof window === 'undefined') return { mac: '', key: '', hasParams: false };
  
  const urlParams = new URLSearchParams(window.location.search);
  const macFromUrl = urlParams.get('mac');
  const keyFromUrl = urlParams.get('key');
  
  let mac = '';
  let key = '';
  
  if (macFromUrl) {
    const decodedMac = decodeURIComponent(macFromUrl);
    const hex = decodedMac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    const formatted = hex.match(/.{1,2}/g)?.join(':') || hex;
    mac = formatted.slice(0, 17);
  }
  
  if (keyFromUrl) {
    key = keyFromUrl.replace(/\D/g, '').slice(0, 6);
  }
  
  return { mac, key, hasParams: !!(macFromUrl || keyFromUrl) };
}

// Get initial values from URL
const initialParams = getInitialUrlParams();

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  
  // Initialize state directly from URL parameters
  const [macAddress, setMacAddress] = useState(initialParams.mac);
  const [deviceKey, setDeviceKey] = useState(initialParams.key);
  const [captchaCode, setCaptchaCode] = useState('');
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false);
  const [error, setError] = useState('');
  const [prefilledFromQR] = useState(initialParams.hasParams);

  // Format MAC address helper function
  const formatMacAddress = (value: string) => {
    // Remove all non-hex characters
    const hex = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    // Add colons every 2 characters
    const formatted = hex.match(/.{1,2}/g)?.join(':') || hex;
    return formatted.slice(0, 17); // Max length XX:XX:XX:XX:XX:XX
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/playlists');
    }
  }, [isAuthenticated, navigate]);

  // Load captcha on mount
  useEffect(() => {
    loadCaptcha();
  }, []);

  const loadCaptcha = async () => {
    setIsLoadingCaptcha(true);
    try {
      const newCaptcha = await portalApi.getCaptcha();
      setCaptcha(newCaptcha);
      setCaptchaCode('');
    } catch (err) {
      console.error('Failed to load captcha:', err);
    } finally {
      setIsLoadingCaptcha(false);
    }
  };

  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMacAddress(formatMacAddress(e.target.value));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!macAddress || macAddress.replace(/:/g, '').length !== 12) {
      setError('Adresse MAC invalide');
      return;
    }
    
    if (!deviceKey) {
      setError('Device Key requis');
      return;
    }
    
    if (!captchaCode || !captcha) {
      setError('Captcha requis');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await portalApi.login(
        macAddress,
        deviceKey,
        captcha.captcha_id,
        captchaCode
      );

      login(
        response.device.mac_address,
        response.device.device_key,
        response.device.status,
        response.device.expiration_date
      );

      navigate('/playlists');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de connexion');
      loadCaptcha(); // Refresh captcha on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-radial from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-radial from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo section */}
        <div className="text-center mb-8">
          <img 
            src="/oxo-logo.png" 
            alt="OXO Player" 
            className="h-24 mx-auto mb-6"
          />
          
          <h1 className="text-2xl font-semibold text-white mb-2">
            Login to add your playlist
          </h1>
        </div>

        {/* Login card */}
        <div className="card animate-fadeIn">
          {/* QR Code prefill notification */}
          {prefilledFromQR && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Informations pré-remplies depuis le QR code. Entrez le captcha pour continuer.
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* MAC Address */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mac Address <span className="text-primary">*</span>
                {prefilledFromQR && macAddress && (
                  <span className="ml-2 text-xs text-green-400">✓ Auto-rempli</span>
                )}
              </label>
              <input
                type="text"
                placeholder="XX:XX:XX:XX:XX:XX"
                value={macAddress}
                onChange={handleMacChange}
                className={`font-mono tracking-wider ${prefilledFromQR && macAddress ? 'border-green-500/50' : ''}`}
                maxLength={17}
                autoComplete="off"
              />
            </div>

            {/* Device Key */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Device Key <span className="text-primary">*</span>
                {prefilledFromQR && deviceKey && (
                  <span className="ml-2 text-xs text-green-400">✓ Auto-rempli</span>
                )}
              </label>
              <input
                type="text"
                placeholder="123456"
                value={deviceKey}
                onChange={(e) => {
                  // Only allow digits, max 6
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setDeviceKey(digits);
                  setError('');
                }}
                className={`font-mono tracking-widest text-center text-2xl ${prefilledFromQR && deviceKey ? 'border-green-500/50' : ''}`}
                maxLength={6}
                autoComplete="off"
              />
              <p className="text-xs text-gray-500 mt-1">
                Code à 6 chiffres affiché sur l'application OXO Player
              </p>
            </div>

            {/* Captcha */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Captcha
              </label>
              
              {/* Captcha image */}
              <div className="mb-3 bg-dark-300 rounded-lg p-4 flex items-center justify-center min-h-[80px]">
                {isLoadingCaptcha ? (
                  <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                ) : captcha ? (
                  <img
                    src={captcha.captcha_image}
                    alt="Captcha"
                    className="h-12"
                  />
                ) : (
                  <span className="text-gray-500">Chargement...</span>
                )}
              </div>

              {/* Captcha input */}
              <input
                type="text"
                placeholder="Entrez le code"
                value={captchaCode}
                onChange={(e) => {
                  setCaptchaCode(e.target.value);
                  setError('');
                }}
                className="font-mono text-center text-lg tracking-widest"
                maxLength={6}
                autoComplete="off"
              />

              {/* Refresh captcha */}
              <button
                type="button"
                onClick={loadCaptcha}
                disabled={isLoadingCaptcha}
                className="mt-3 flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingCaptcha ? 'animate-spin' : ''}`} />
                Refresh Captcha
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-4 text-lg"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'Login'
              )}
            </button>
          </form>
        </div>

        {/* Buy activation link */}
        <div className="text-center mt-6">
          <p className="text-gray-500 text-sm mb-2">
            Vous n'avez pas encore OXO Player ?
          </p>
          <button
            onClick={() => navigate('/sellers')}
            className="text-primary hover:text-primary-hover transition-colors font-medium"
          >
            🛒 Voir les points de vente
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          OXO Player © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

