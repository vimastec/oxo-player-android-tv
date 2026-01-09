import { useEffect, useState } from 'react';
import { Users, Tv, CreditCard, TrendingUp, Loader2 } from 'lucide-react';
import { adminApi } from '../../services/api';

interface DashboardData {
  stats: {
    totalResellers: number;
    activeResellers: number;
    totalDevices: number;
    activeDevices: number;
    trialDevices: number;
    totalCreditsGiven: number;
    totalCreditsUsed: number;
  };
  recentActivations: Array<{
    mac_address: string;
    activation_date: string;
    reseller_name: string;
  }>;
}

export function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await adminApi.dashboard();
      setData(response.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
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
      <h1 className="text-2xl font-bold mb-6">Dashboard Admin</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.stats.totalResellers || 0}</p>
              <p className="text-sm text-muted">Revendeurs</p>
            </div>
          </div>
        </div>

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
            <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.stats.totalCreditsGiven || 0}</p>
              <p className="text-sm text-muted">Crédits distribués</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data?.stats.trialDevices || 0}</p>
              <p className="text-sm text-muted">En période d'essai</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activations */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Activations récentes</h2>
        {data?.recentActivations && data.recentActivations.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Adresse MAC</th>
                  <th>Revendeur</th>
                  <th>Date d'activation</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivations.map((activation, index) => (
                  <tr key={index}>
                    <td className="font-mono">{activation.mac_address}</td>
                    <td>{activation.reseller_name || 'N/A'}</td>
                    <td>{new Date(activation.activation_date).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-center py-8">Aucune activation récente</p>
        )}
      </div>
    </div>
  );
}




























