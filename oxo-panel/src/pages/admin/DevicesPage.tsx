import { useEffect, useState } from 'react';
import { Loader2, Tv, Ban, CheckCircle, Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
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

interface DevicesResponse {
  devices: Device[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function AdminDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'trial' | 'expired' | 'disabled' | 'cancelled'>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  
  // Search, sort and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);

  useEffect(() => {
    loadDevices();
  }, [searchQuery, sortField, sortOrder, currentPage, filter]);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.getDevices({
        search: searchQuery,
        sort: sortField,
        order: sortOrder,
        page: currentPage,
        limit: 50,
        status: filter
      });
      const data = response.data as DevicesResponse;
      setDevices(data.devices);
      setTotalPages(data.totalPages);
      setTotalDevices(data.total);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setCurrentPage(1);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    setCurrentPage(1);
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

  const SortButton = ({ field, label }: { field: string; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 hover:text-primary transition-colors ${
        sortField === field ? 'text-primary' : ''
      }`}
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'opacity-100' : 'opacity-50'}`} />
    </button>
  );

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
      case 'cancelled':
        return <span className="badge bg-orange-500 text-white">Annulé</span>;
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Tous les appareils</h1>
          <p className="text-muted text-sm mt-1">{totalDevices} appareil(s) trouvé(s)</p>
        </div>
        
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            placeholder="XX:XX:XX:XX:XX:XX"
            value={searchInput}
            onChange={(e) => {
              // Format as MAC address
              let value = e.target.value.toUpperCase().replace(/[^A-F0-9]/g, '');
              if (value.length > 12) value = value.slice(0, 12);
              // Add colons
              const parts = value.match(/.{1,2}/g) || [];
              setSearchInput(parts.join(':'));
            }}
            className="font-mono text-center w-48 tracking-wider"
            maxLength={17}
          />
          <button type="submit" className="btn btn-primary flex items-center gap-2">
            <Search className="w-4 h-4" />
            Rechercher
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setSearchQuery(''); }}
              className="btn btn-secondary"
            >
              Effacer
            </button>
          )}
        </form>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['all', 'active', 'trial', 'expired', 'disabled', 'cancelled'].map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary text-white'
                : 'bg-card hover:bg-border'
            }`}
          >
            {f === 'all' ? 'Tout' : f === 'active' ? 'Actifs' : f === 'trial' ? 'Essai' : f === 'expired' ? 'Expirés' : f === 'disabled' ? 'Désactivés' : 'Annulés'}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : devices.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th><SortButton field="mac_address" label="MAC" /></th>
                  <th><SortButton field="reseller_name" label="Revendeur" /></th>
                  <th><SortButton field="status" label="Statut" /></th>
                  <th>Playlist</th>
                  <th><SortButton field="expiration_date" label="Expiration" /></th>
                  <th><SortButton field="last_seen" label="Dernière connexion" /></th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted">
            Page {currentPage} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary flex items-center gap-1 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </button>
            
            {/* Page numbers */}
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary text-white'
                        : 'bg-card hover:bg-border'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-secondary flex items-center gap-1 disabled:opacity-50"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

























