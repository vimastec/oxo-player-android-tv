import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, RefreshCw, Loader2, X, Server, Film, Tv, Eye, EyeOff } from 'lucide-react';
import { adminApi } from '../../services/api';

interface XtreamHost {
  id: number;
  host: string;
  name: string;
  test_username: string | null;
  is_active: boolean;
  last_top10_update: string | null;
  created_at: string;
  movies_count: number;
  series_count: number;
}

export function HostsPage() {
  const [hosts, setHosts] = useState<XtreamHost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedHost, setSelectedHost] = useState<XtreamHost | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    host: '',
    name: '',
    test_username: '',
    test_password: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    test_username: '',
    test_password: '',
    is_active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  useEffect(() => {
    loadHosts();
  }, []);

  const loadHosts = async () => {
    try {
      const response = await adminApi.getXtreamHosts();
      setHosts(response.data);
    } catch (error) {
      console.error('Error loading hosts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await adminApi.createXtreamHost(formData);
      setShowModal(false);
      setFormData({ host: '', name: '', test_username: '', test_password: '' });
      loadHosts();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost) return;
    setIsSubmitting(true);
    try {
      await adminApi.updateXtreamHost(selectedHost.id, {
        name: editFormData.name || undefined,
        test_username: editFormData.test_username || undefined,
        test_password: editFormData.test_password || undefined,
        is_active: editFormData.is_active,
      });
      setShowEditModal(false);
      setSelectedHost(null);
      loadHosts();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce host ?')) return;
    try {
      await adminApi.deleteXtreamHost(id);
      loadHosts();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const handleRefresh = async (id: number) => {
    setRefreshingId(id);
    try {
      const response = await adminApi.refreshXtreamHostTop10(id);
      alert(response.data.message || 'Top 10 généré avec succès !');
      loadHosts();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors du rafraîchissement');
    } finally {
      setRefreshingId(null);
    }
  };

  const handleRefreshAll = async () => {
    if (!confirm('Générer le Top 10 pour tous les hosts ? Cela peut prendre quelques minutes.')) return;
    setRefreshingAll(true);
    try {
      const response = await adminApi.refreshAllXtreamHostsTop10();
      alert(response.data.message || 'Top 10 généré pour tous les hosts !');
      loadHosts();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors du rafraîchissement');
    } finally {
      setRefreshingAll(false);
    }
  };

  const openEditModal = (host: XtreamHost) => {
    setSelectedHost(host);
    setEditFormData({
      name: host.name || '',
      test_username: host.test_username || '',
      test_password: '',
      is_active: host.is_active,
    });
    setShowEditModal(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Hosts Xtream (Top 10)</h1>
          <p className="text-gray-400 text-sm mt-1">
            Gérez les serveurs Xtream pour le service Top 10 automatique
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={refreshingAll}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshingAll ? 'animate-spin' : ''}`} />
            {refreshingAll ? 'Génération...' : 'Générer Top 10'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Ajouter un host
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h3 className="text-blue-400 font-semibold mb-2">ℹ️ Comment ça fonctionne ?</h3>
        <ul className="text-gray-300 text-sm space-y-1">
          <li>• Les hosts sont auto-détectés quand une playlist Xtream est ajoutée</li>
          <li>• Ajoutez des identifiants de test pour activer le Top 10</li>
          <li>• Le Top 10 est mis à jour automatiquement chaque jour à 4h00</li>
          <li>• L'application Android reçoit le Top 10 pré-calculé instantanément</li>
        </ul>
      </div>

      {/* Hosts Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Host</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Nom</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">Top 10</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">Statut</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Dernière MAJ</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {hosts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Aucun host Xtream. Les hosts seront auto-détectés lors de l'ajout de playlists.
                  </td>
                </tr>
              ) : (
                hosts.map((host) => (
                  <tr key={host.id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-gray-500" />
                        <span className="text-white font-mono text-sm">{host.host}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{host.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-1 text-sm">
                          <Film className="w-4 h-4 text-blue-400" />
                          <span className="text-white">{host.movies_count}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Tv className="w-4 h-4 text-purple-400" />
                          <span className="text-white">{host.series_count}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {host.is_active ? (
                        host.test_username ? (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                            Actif
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                            Sans credentials
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {formatDate(host.last_top10_update)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRefresh(host.id)}
                          disabled={refreshingId === host.id || !host.test_username}
                          className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Rafraîchir Top 10"
                        >
                          <RefreshCw className={`w-4 h-4 ${refreshingId === host.id ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => openEditModal(host)}
                          className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(host.id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Ajouter un host Xtream</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Host <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="iptv-server.com:8080"
                  required
                />
                <p className="text-gray-500 text-xs mt-1">Format: domain.com:port (sans http://)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="Mon IPTV"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Username de test</label>
                <input
                  type="text"
                  value={formData.test_username}
                  onChange={(e) => setFormData({ ...formData, test_username: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder="test_user"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Password de test</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.test_password}
                    onChange={(e) => setFormData({ ...formData, test_password: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-yellow-500 text-xs mt-1">
                  ⚠️ Requis pour activer le Top 10 automatique
                </p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedHost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Modifier {selectedHost.host}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nom</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder={selectedHost.name}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Username de test</label>
                <input
                  type="text"
                  value={editFormData.test_username}
                  onChange={(e) => setEditFormData({ ...editFormData, test_username: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  placeholder={selectedHost.test_username || 'Non défini'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nouveau password de test
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editFormData.test_password}
                    onChange={(e) => setEditFormData({ ...editFormData, test_password: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white pr-10"
                    placeholder="Laisser vide pour ne pas changer"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={editFormData.is_active}
                  onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600"
                />
                <label htmlFor="is_active" className="text-gray-300">
                  Host actif
                </label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

