import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, CreditCard, Loader2, X } from 'lucide-react';
import { adminApi } from '../../services/api';

interface Reseller {
  id: number;
  email: string;
  name: string;
  credits: number;
  status: string;
  device_count: number;
  active_devices: number;
  created_at: string;
}

export function ResellersPage() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    credits: 0,
  });
  const [creditsAmount, setCreditsAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadResellers();
  }, []);

  const loadResellers = async () => {
    try {
      const response = await adminApi.getResellers();
      setResellers(response.data);
    } catch (error) {
      console.error('Error loading resellers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await adminApi.createReseller(formData);
      setShowModal(false);
      setFormData({ email: '', password: '', name: '', credits: 0 });
      loadResellers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReseller) return;
    setIsSubmitting(true);
    try {
      await adminApi.addCredits(selectedReseller.id, creditsAmount, 'Ajout manuel');
      setShowCreditsModal(false);
      setCreditsAmount(0);
      setSelectedReseller(null);
      loadResellers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de l\'ajout');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce revendeur ?')) return;
    try {
      await adminApi.deleteReseller(id);
      loadResellers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const handleToggleStatus = async (reseller: Reseller) => {
    const newStatus = reseller.status === 'active' ? 'suspended' : 'active';
    try {
      await adminApi.updateReseller(reseller.id, { status: newStatus });
      loadResellers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour');
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
        <h1 className="text-2xl font-bold">Revendeurs</h1>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus className="w-5 h-5" />
          Nouveau revendeur
        </button>
      </div>

      <div className="card overflow-hidden">
        {resellers.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Crédits</th>
                  <th>Appareils</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map((reseller) => (
                  <tr key={reseller.id}>
                    <td className="font-medium">{reseller.name}</td>
                    <td>{reseller.email}</td>
                    <td>
                      <span className="font-bold text-primary">{reseller.credits}</span>
                    </td>
                    <td>
                      {reseller.active_devices} / {reseller.device_count}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          reseller.status === 'active' ? 'badge-success' : 'badge-error'
                        }`}
                      >
                        {reseller.status === 'active' ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedReseller(reseller);
                            setShowCreditsModal(true);
                          }}
                          className="p-2 rounded-lg hover:bg-card text-success"
                          title="Ajouter crédits"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(reseller)}
                          className="p-2 rounded-lg hover:bg-card text-warning"
                          title={reseller.status === 'active' ? 'Suspendre' : 'Activer'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(reseller.id)}
                          className="p-2 rounded-lg hover:bg-card text-error"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted text-center py-12">Aucun revendeur</p>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Nouveau revendeur</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Nom</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Mot de passe</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Crédits initiaux</label>
                <input
                  type="number"
                  min="0"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credits Modal */}
      {showCreditsModal && selectedReseller && (
        <div className="modal-overlay" onClick={() => setShowCreditsModal(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Ajouter des crédits</h2>
              <button onClick={() => setShowCreditsModal(false)} className="p-2 hover:bg-card rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-muted mb-4">
              Revendeur: <strong>{selectedReseller.name}</strong>
              <br />
              Crédits actuels: <strong className="text-primary">{selectedReseller.credits}</strong>
            </p>
            <form onSubmit={handleAddCredits} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Montant à ajouter</label>
                <input
                  type="number"
                  min="1"
                  value={creditsAmount}
                  onChange={(e) => setCreditsAmount(parseInt(e.target.value) || 0)}
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreditsModal(false)} className="btn btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-success flex-1">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}




