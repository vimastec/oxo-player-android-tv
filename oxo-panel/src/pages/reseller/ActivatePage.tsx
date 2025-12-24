import { useState } from 'react';
import { Tv, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { resellerApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export function ActivatePage() {
  const [macAddress, setMacAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);

  const { user, updateUser } = useAuthStore();

  const formatMacAddress = (value: string) => {
    // Remove all non-hex characters
    const hex = value.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    // Add colons every 2 characters
    const formatted = hex.match(/.{1,2}/g)?.join(':') || hex;
    return formatted.slice(0, 17); // Max length XX:XX:XX:XX:XX:XX
  };

  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMacAddress(formatMacAddress(e.target.value));
    setResult(null);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (macAddress.replace(/:/g, '').length !== 12) {
      setResult({
        success: false,
        message: 'Adresse MAC invalide. Format attendu: XX:XX:XX:XX:XX:XX',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await resellerApi.activateDevice(macAddress);
      setResult({
        success: true,
        message: `Activation réussie ! Expire le ${new Date(response.data.expiration_date).toLocaleDateString('fr-FR')}`,
        data: response.data,
      });
      updateUser({ credits: response.data.credits_remaining });
      setMacAddress('');
    } catch (error: any) {
      setResult({
        success: false,
        message: error.response?.data?.error || 'Erreur lors de l\'activation',
      });
    } finally {
      setIsLoading(false);
    }
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
            <p className="text-sm text-muted">Coût par activation</p>
            <p className="font-bold">10 crédits = 12 mois</p>
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
            <h2 className="font-semibold">Nouvelle activation</h2>
            <p className="text-sm text-muted">Entrez l'adresse MAC de l'appareil</p>
          </div>
        </div>

        <form onSubmit={handleActivate} className="space-y-4">
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
                Activer (-10 crédits)
              </>
            )}
          </button>
        </form>
      </div>

      {/* Instructions */}
      <div className="card mt-6">
        <h3 className="font-semibold mb-4">Comment obtenir l'adresse MAC ?</h3>
        <ol className="space-y-3 text-sm text-muted">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
            <span>Le client ouvre l'application OXO Player sur sa TV</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
            <span>L'adresse MAC s'affiche sur l'écran d'accueil</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
            <span>Le client vous communique cette adresse</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
            <span>Vous l'activez ici et configurez la playlist</span>
          </li>
        </ol>
      </div>
    </div>
  );
}


















