import { useEffect, useState } from 'react';
import { Tv, CreditCard, Clock, Loader2 } from 'lucide-react';
import { resellerApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

interface DashboardData {
  credits: number;
  stats: {
    totalDevices: number;
    activeDevices: number;
    expiredDevices: number;
  };
  recentDevices: Array<{
    mac_address: string;
    status: string;
    activation_date: string;
    expiration_date: string;
  }>;
}

export function ResellerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { updateUser } = useAuthStore();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await resellerApi.dashboard();
      setData(response.data);
      updateUser({ credits: response.data.credits });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Actif</span>;
      case 'trial':
        return <span className="badge badge-info">Essai</span>;
      case 'expired':
        return <span className="badge badge-error">Expiré</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Credits card */}
      <div className="card mb-6 bg-gradient-to-r from-primary to-secondary">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <p className="text-4xl font-bold">{data?.credits || 0}</p>
            <p className="opacity-80">Crédits disponibles</p>
          </div>
        </div>
        <p className="mt-4 text-sm opacity-70">
          10 crédits = 1 activation (12 mois)
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
              <Tv className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.stats.activeDevices || 0}</p>
              <p className="text-sm text-muted">Appareils actifs</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Tv className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.stats.totalDevices || 0}</p>
              <p className="text-sm text-muted">Total appareils</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-error/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-error" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.stats.expiredDevices || 0}</p>
              <p className="text-sm text-muted">Expirés</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent devices */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Appareils récents</h2>
        {data?.recentDevices && data.recentDevices.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Adresse MAC</th>
                  <th>Statut</th>
                  <th>Expiration</th>
                </tr>
              </thead>
              <tbody>
                {data.recentDevices.map((device, index) => (
                  <tr key={index}>
                    <td className="font-mono">{device.mac_address}</td>
                    <td>{getStatusBadge(device.status)}</td>
                    <td>
                      {device.expiration_date
                        ? new Date(device.expiration_date).toLocaleDateString('fr-FR')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-center py-8">Aucun appareil</p>
        )}
      </div>
    </div>
  );
}






















