import { useState } from 'react';
import { Tv, Loader2, CheckCircle, AlertCircle, Clock, RefreshCw, Link, Search } from 'lucide-react';
import { resellerApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface ConfirmationData {
  mac_address: string;
  expiration_date: string;
  message: string;
}

export function ActivatePage() {
  const [macAddress, setMacAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);
  
  // Link Code state
  const [linkCode, setLinkCode] = useState('');
  const [isCheckingLinkCode, setIsCheckingLinkCode] = useState(false);
  const [linkCodeResult, setLinkCodeResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  
  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const { user, updateUser } = useAuthStore();

  const formatMacAddress = (value: string) => {
    // Remove all non-hex characters
    const hex = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    // Add colons every 2 characters
    const formatted = hex.match(/.{1,2}/g)?.join(':') || hex;
    return formatted.slice(0, 17); // Max length XX:XX:XX:XX:XX:XX
  };

  const formatLinkCode = (value: string) => {
    // Only alphanumeric, uppercase, max 4 chars
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4);
  };

  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMacAddress(formatMacAddress(e.target.value));
    setResult(null);
  };

  const handleLinkCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLinkCode(formatLinkCode(e.target.value));
    setLinkCodeResult(null);
  };

  const handleCheckLinkCode = async () => {
    if (linkCode.length !== 4) {
      setLinkCodeResult({
        success: false,
        message: 'Le code doit contenir 4 caractères',
      });
      return;
    }

    setIsCheckingLinkCode(true);
    setLinkCodeResult(null);

    try {
      const response = await resellerApi.checkLinkCode(linkCode);
      const macFromCode = response.data.mac_address;
      
      setMacAddress(macFromCode);
      setLinkCodeResult({
        success: true,
        message: `MAC trouvée: ${macFromCode}`,
      });
      setLinkCode(''); // Clear the code after success
    } catch (error: any) {
      const errorMessage = error.response?.status === 410 
        ? 'Code expiré'
        : error.response?.status === 404
        ? 'Code non trouvé ou déjà utilisé'
        : error.response?.data?.error || 'Erreur lors de la vérification';
      
      setLinkCodeResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setIsCheckingLinkCode(false);
    }
  };

  const handleActivate = async (e: React.FormEvent, forceExtend = false) => {
    e.preventDefault();
    
    const macToActivate = forceExtend && confirmationData ? confirmationData.mac_address : macAddress;
    
    if (macToActivate.replace(/:/g, '').length !== 12) {
      setResult({
        success: false,
        message: 'Adresse MAC invalide. Format attendu: XX:XX:XX:XX:XX:XX',
      });
      return;
    }

    if (forceExtend) {
      setIsConfirming(true);
    } else {
      setIsLoading(true);
    }
    setResult(null);

    try {
      const response = await resellerApi.activateDevice(macToActivate, forceExtend);
      
      const isExtension = response.data.is_extension;
      setResult({
        success: true,
        message: isExtension 
          ? `Prolongation réussie ! Nouvelle expiration: ${new Date(response.data.expiration_date).toLocaleDateString('fr-FR')}`
          : `Activation réussie ! Expire le ${new Date(response.data.expiration_date).toLocaleDateString('fr-FR')}`,
        data: response.data,
      });
      updateUser({ credits: response.data.credits_remaining });
      setMacAddress('');
      setShowConfirmModal(false);
      setConfirmationData(null);
    } catch (error: any) {
      // Check if confirmation is required (MAC is already active)
      if (error.response?.status === 409 && error.response?.data?.error === 'confirmation_required') {
        setConfirmationData({
          mac_address: error.response.data.mac_address,
          expiration_date: error.response.data.expiration_date,
          message: error.response.data.message,
        });
        setShowConfirmModal(true);
      } else {
        setResult({
          success: false,
          message: error.response?.data?.error || 'Erreur lors de l\'activation',
        });
      }
    } finally {
      setIsLoading(false);
      setIsConfirming(false);
    }
  };

  const handleConfirmExtend = async () => {
    if (!confirmationData) return;
    handleActivate({ preventDefault: () => {} } as React.FormEvent, true);
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setConfirmationData(null);
  };

  return (
    <div className="animate-fadeIn max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Activer une adresse MAC</h1>

      {/* Credits info */}
      <div className="card mb-6 bg-gradient-to-r from-primary/20 to-secondary/20 border-primary/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted mb-1">Vos crédits</p>
            <p className="text-3xl font-bold text-primary">{user?.credits || 0}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted">Coût par activation/prolongation</p>
            <p className="font-bold">10 crédits = 365 jours</p>
          </div>
        </div>
      </div>

      {/* Activation form */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Tv className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Nouvelle activation ou prolongation</h2>
            <p className="text-sm text-muted">Entrez l'adresse MAC de l'appareil</p>
          </div>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
          {/* Link Code Section */}
          <div className="bg-base-200 rounded-xl p-4 mb-2">
            <div className="flex items-center gap-2 mb-3">
              <Link className="w-4 h-4 text-primary" />
              <label className="text-sm font-medium">
                Code Link (optionnel)
              </label>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: X4R5"
                value={linkCode}
                onChange={handleLinkCodeChange}
                className="font-mono text-xl tracking-widest text-center flex-1"
                maxLength={4}
                style={{ letterSpacing: '0.5em' }}
              />
              <button
                type="button"
                onClick={handleCheckLinkCode}
                disabled={isCheckingLinkCode || linkCode.length !== 4}
                className="btn btn-secondary px-4"
              >
                {isCheckingLinkCode ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
              </button>
            </div>
            {linkCodeResult && (
              <p className={`text-xs mt-2 ${linkCodeResult.success ? 'text-success' : 'text-error'}`}>
                {linkCodeResult.message}
              </p>
            )}
            <p className="text-xs text-muted mt-2">
              Entrez le code affiché sur l'application du client pour remplir automatiquement la MAC
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-base-300"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-base-100 text-muted">ou entrez la MAC manuellement</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Adresse MAC
            </label>
            <input
              type="text"
              placeholder="XX:XX:XX:XX:XX:XX"
              value={macAddress}
              onChange={handleMacChange}
              className="font-mono text-lg tracking-wider"
              maxLength={17}
            />
            <p className="text-xs text-muted mt-2">
              L'adresse MAC est affichée sur l'application OXO Player
            </p>
          </div>

          {result && (
            <div
              className={`flex items-start gap-3 p-4 rounded-xl ${
                result.success
                  ? 'bg-success/10 border border-success/30 text-success'
                  : 'bg-error/10 border border-error/30 text-error'
              }`}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{result.success ? 'Succès !' : 'Erreur'}</p>
                <p className="text-sm opacity-80">{result.message}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (user?.credits || 0) < 10}
            className="btn btn-primary w-full py-3"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (user?.credits || 0) < 10 ? (
              'Crédits insuffisants'
            ) : (
              <>
                Activer / Prolonger (-10 crédits)
              </>
            )}
          </button>
        </form>
      </div>

      {/* Instructions */}
      <div className="card mt-6">
        <h3 className="font-semibold mb-4">Comment ça fonctionne ?</h3>
        <div className="space-y-4 text-sm text-muted">
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium text-foreground">Nouvelle activation</p>
              <p>Pour une nouvelle adresse MAC, l'abonnement démarre immédiatement pour 365 jours.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium text-foreground">Prolongation</p>
              <p>Pour une MAC déjà active, 365 jours sont ajoutés à la date d'expiration actuelle.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium text-foreground">Réactivation</p>
              <p>Pour une MAC expirée, l'abonnement redémarre à partir d'aujourd'hui.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for extending active subscription */}
      {showConfirmModal && confirmationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-base-100 rounded-2xl p-6 max-w-md w-full shadow-xl animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-warning" />
              </div>
              <h3 className="text-xl font-bold mb-2">Abonnement déjà actif</h3>
              <p className="text-muted">
                {confirmationData.message}
              </p>
            </div>

            <div className="bg-base-200 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted">Adresse MAC</span>
                <span className="font-mono font-medium">{confirmationData.mac_address}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-muted">Expire actuellement le</span>
                <span className="font-medium text-warning">
                  {new Date(confirmationData.expiration_date).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">Nouvelle expiration</span>
                <span className="font-medium text-success">
                  {new Date(new Date(confirmationData.expiration_date).getTime() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelConfirm}
                className="btn btn-ghost flex-1"
                disabled={isConfirming}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmExtend}
                className="btn btn-primary flex-1"
                disabled={isConfirming}
              >
                {isConfirming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Prolonger (-10 crédits)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
