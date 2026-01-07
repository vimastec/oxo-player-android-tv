import { useEffect, useState } from 'react';
import { Loader2, Tv, Ban, CheckCircle } from 'lucide-react';
import { adminApi } from '../../services/api';

interface Device {
  id: number;
  mac_address: string;
  reseller_name: string;
  reseller_email: string;
  status: string;
  playlist_url: string;
  activation_date: string;
  expiration_date: string;
  last_seen: string;
  created_at: string;
}

export function AdminDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'trial' | 'expired' | 'disabled'>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const response = await adminApi.getDevices();
      setDevices(response.data);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (device: Device) => {
    const newStatus = device.status === 'disabled' ? 'active' : 'disabled';
    setUpdatingId(device.id);
    try {
      await adminApi.updateDeviceStatus(device.id, newStatus);
      // Mettre à jour localement
      setDevices(devices.map(d => 
        d.id === device.id ? { ...d, status: newStatus } : d
      ));
    } catch (error) {
      console.error('Error updating device status:', error);
      alert('Erreur lors de la mise à jour du statut');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredDevices = devices.filter((d) => {
    if (filter === 'all') return true;
    return d.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Actif</span>;
      case 'trial':
        return <span className="badge badge-info">Essai</span>;
      case 'expired':
        return <span className="badge badge-error">Expiré</span>;
      case 'disabled':
        return <span className="badge bg-gray-600 text-white">Désactivé</span>;
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tous les appareils</h1>
        <div className="flex gap-2">
          {['all', 'active', 'trial', 'expired', 'disabled'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-card hover:bg-border'
              }`}
            >
              {f === 'all' ? 'Tout' : f === 'active' ? 'Actifs' : f === 'trial' ? 'Essai' : f === 'expired' ? 'Expirés' : 'Désactivés'}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {filteredDevices.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>MAC</th>
                  <th>Revendeur</th>
                  <th>Statut</th>
                  <th>Playlist</th>
                  <th>Expiration</th>
                  <th>Dernière connexion</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((device) => (
                  <tr key={device.id}>
                    <td className="font-mono font-medium">{device.mac_address}</td>
                    <td>
                      {device.reseller_name ? (
                        <div>
                          <p className="font-medium">{device.reseller_name}</p>
                          <p className="text-xs text-muted">{device.reseller_email}</p>
                        </div>
                      ) : (
                        <span className="text-muted">Non assigné</span>
                      )}
                    </td>
                    <td>{getStatusBadge(device.status)}</td>
                    <td>
                      {device.playlist_url ? (
                        <span className="badge badge-success">Configuré</span>
                      ) : (
                        <span className="badge badge-warning">Non configuré</span>
                      )}
                    </td>
                    <td>
                      {device.expiration_date
                        ? new Date(device.expiration_date).toLocaleDateString('fr-FR')
                        : '-'}
                    </td>
                    <td>
                      {device.last_seen
                        ? new Date(device.last_seen).toLocaleString('fr-FR')
                        : 'Jamais'}
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleStatus(device)}
                        disabled={updatingId === device.id}
                        className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                          device.status === 'disabled'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                        title={device.status === 'disabled' ? 'Réactiver' : 'Désactiver'}
                      >
                        {updatingId === device.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : device.status === 'disabled' ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Activer
                          </>
                        ) : (
                          <>
                            <Ban className="w-4 h-4" />
                            Désactiver
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Tv className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted">Aucun appareil trouvé</p>
          </div>
        )}
      </div>
    </div>
  );
}

























