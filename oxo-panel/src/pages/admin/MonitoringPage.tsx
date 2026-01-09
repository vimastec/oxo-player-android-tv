import { useEffect, useState } from 'react';
import { 
  Loader2, 
  Activity, 
  Database, 
  Users, 
  Tv, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info,
  Server,
  HardDrive,
  Zap
} from 'lucide-react';
import { adminApi } from '../../services/api';

interface MonitoringData {
  overview: {
    totalDevices: number;
    totalResellers: number;
    totalTransactions: number;
    totalPlaylists: number;
  };
  deviceStatus: {
    active: number;
    trial: number;
    expired: number;
    cancelled: number;
    disabled: number;
  };
  activations: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    cancellationsThisMonth: number;
  };
  credits: {
    totalGiven: number;
    totalUsed: number;
    totalRefunded: number;
    balance: number;
  };
  storage: {
    estimatedDbSizeMB: number;
    maxDbSizeMB: number;
    usagePercent: number;
  };
  charts: {
    dailyActivations: { date: string; day: string; count: number }[];
    monthlyActivations: { month: string; count: number }[];
  };
  limits: {
    maxDevices: number;
    maxDbSizeMB: number;
    recommendedMonthlyActivations: number;
  };
  alerts: { type: string; message: string }[];
}

export function AdminMonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMonitoring();
  }, []);

  const loadMonitoring = async () => {
    try {
      const response = await adminApi.getMonitoring();
      setData(response.data);
    } catch (error) {
      console.error('Error loading monitoring:', error);
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

  if (!data) {
    return (
      <div className="text-center py-12 text-muted">
        Erreur lors du chargement des données
      </div>
    );
  }

  const maxDailyCount = Math.max(...data.charts.dailyActivations.map(d => d.count), 1);
  const maxMonthlyCount = Math.max(...data.charts.monthlyActivations.map(d => d.count), 1);

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Monitoring
          </h1>
          <p className="text-muted text-sm mt-1">Surveillance des performances et ressources</p>
        </div>
        <button 
          onClick={loadMonitoring}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Alerts */}
      <div className="space-y-2">
        {data.alerts.map((alert, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 p-4 rounded-xl ${
              alert.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' :
              alert.type === 'warning' ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400' :
              'bg-blue-500/10 border border-blue-500/30 text-blue-400'
            }`}
          >
            {alert.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
             alert.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
             <Info className="w-5 h-5" />}
            <span>{alert.message}</span>
          </div>
        ))}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card !p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/20">
              <Tv className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.overview.totalDevices.toLocaleString()}</p>
              <p className="text-sm text-muted">Appareils</p>
            </div>
          </div>
        </div>

        <div className="card !p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-500/20">
              <Users className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.overview.totalResellers}</p>
              <p className="text-sm text-muted">Revendeurs</p>
            </div>
          </div>
        </div>

        <div className="card !p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.activations.thisMonth}</p>
              <p className="text-sm text-muted">Activations/mois</p>
            </div>
          </div>
        </div>

        <div className="card !p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <Database className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{data.storage.estimatedDbSizeMB} MB</p>
              <p className="text-sm text-muted">Taille DB</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activations & Storage */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Activations Today/Week/Month */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Activations
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-card rounded-xl">
              <p className="text-3xl font-bold text-green-500">{data.activations.today}</p>
              <p className="text-sm text-muted">Aujourd'hui</p>
            </div>
            <div className="text-center p-4 bg-card rounded-xl">
              <p className="text-3xl font-bold text-blue-500">{data.activations.thisWeek}</p>
              <p className="text-sm text-muted">Cette semaine</p>
            </div>
            <div className="text-center p-4 bg-card rounded-xl">
              <p className="text-3xl font-bold text-purple-500">{data.activations.thisMonth}</p>
              <p className="text-sm text-muted">Ce mois</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-orange-500/10 rounded-xl flex items-center justify-between">
            <span className="text-sm text-orange-400">Annulations ce mois</span>
            <span className="font-bold text-orange-500">{data.activations.cancellationsThisMonth}</span>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-purple-500" />
            Stockage Base de Données
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted">Utilisation</span>
                <span className="text-sm font-medium">{data.storage.estimatedDbSizeMB} MB / {data.storage.maxDbSizeMB} MB</span>
              </div>
              <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${
                    data.storage.usagePercent > 80 ? 'bg-red-500' :
                    data.storage.usagePercent > 50 ? 'bg-orange-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(data.storage.usagePercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted mt-1">{data.storage.usagePercent}% utilisé</p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
              <div>
                <p className="text-sm text-muted">Max Appareils</p>
                <p className="text-lg font-bold">{data.limits.maxDevices.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Activations/mois recommandé</p>
                <p className="text-lg font-bold">{data.limits.recommendedMonthlyActivations.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Activations - 7 derniers jours</h3>
          <div className="flex items-end justify-between h-40 gap-2">
            {data.charts.dailyActivations.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium">{day.count}</span>
                <div 
                  className="w-full bg-primary rounded-t transition-all hover:bg-primary/80"
                  style={{ height: `${(day.count / maxDailyCount) * 100}%`, minHeight: day.count > 0 ? '8px' : '2px' }}
                />
                <span className="text-xs text-muted">{day.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Activations - 6 derniers mois</h3>
          <div className="flex items-end justify-between h-40 gap-2">
            {data.charts.monthlyActivations.map((month, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-medium">{month.count}</span>
                <div 
                  className="w-full bg-green-500 rounded-t transition-all hover:bg-green-400"
                  style={{ height: `${(month.count / maxMonthlyCount) * 100}%`, minHeight: month.count > 0 ? '8px' : '2px' }}
                />
                <span className="text-xs text-muted">{month.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Device Status & Credits */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Device Status */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-500" />
            Statut des Appareils
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Actifs', value: data.deviceStatus.active, color: 'bg-green-500' },
              { label: 'Essai', value: data.deviceStatus.trial, color: 'bg-blue-500' },
              { label: 'Expirés', value: data.deviceStatus.expired, color: 'bg-red-500' },
              { label: 'Annulés', value: data.deviceStatus.cancelled, color: 'bg-orange-500' },
              { label: 'Désactivés', value: data.deviceStatus.disabled, color: 'bg-gray-500' },
            ].map((status, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${status.color}`} />
                  <span>{status.label}</span>
                </div>
                <span className="font-bold">{status.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Credits */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Crédits Globaux</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-xl">
              <span className="text-green-400">Total distribués</span>
              <span className="font-bold text-green-500">+{data.credits.totalGiven.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl">
              <span className="text-red-400">Total utilisés</span>
              <span className="font-bold text-red-500">-{data.credits.totalUsed.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-xl">
              <span className="text-orange-400">Total remboursés</span>
              <span className="font-bold text-orange-500">+{data.credits.totalRefunded.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-primary/20 rounded-xl border border-primary/30">
              <span className="text-primary">Solde en circulation</span>
              <span className="font-bold text-primary text-lg">{data.credits.balance.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Infrastructure Info */}
      <div className="card bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/30">
        <h3 className="text-lg font-semibold mb-2">📊 Infrastructure Railway (Hobby $5/mois)</h3>
        <p className="text-sm text-muted mb-4">
          Votre plan actuel supporte environ <strong>1000-2000 activations/mois</strong> confortablement.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted">RAM</p>
            <p className="font-medium">512 MB</p>
          </div>
          <div>
            <p className="text-muted">Stockage DB</p>
            <p className="font-medium">1 GB</p>
          </div>
          <div>
            <p className="text-muted">Bande passante</p>
            <p className="font-medium">100 GB/mois</p>
          </div>
          <div>
            <p className="text-muted">Connexions DB</p>
            <p className="font-medium">~20 max</p>
          </div>
        </div>
      </div>
    </div>
  );
}

