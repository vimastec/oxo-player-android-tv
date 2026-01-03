import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, CreditCard, Loader2, X, Users, History } from 'lucide-react';
import { resellerApi } from '../../services/api';

interface SubReseller {
  id: number;
  email: string;
  name: string;
  credits: number;
  status: string;
  device_count: number;
  active_devices: number;
  created_at: string;
}

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  from_reseller_name?: string;
  created_at: string;
}

export function SubResellersPage() {
  const [subResellers, setSubResellers] = useState<SubReseller[]>([]);
  const [myCredits, setMyCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedSubReseller, setSelectedSubReseller] = useState<SubReseller | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    credits: 0,
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    password: '',
    status: 'active',
  });
  const [creditsAmount, setCreditsAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subResellersRes, meRes] = await Promise.all([
        resellerApi.getSubResellers(),
        resellerApi.getMe()
      ]);
      setSubResellers(subResellersRes.data);
      setMyCredits(meRes.data.credits || 0);
    } catch (error: any) {
      console.error('Error loading data:', error);
      if (error.response?.status === 403) {
        setError('Vous n\'avez pas la permission de gérer des sous-revendeurs');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      await resellerApi.createSubReseller(formData);
      setShowModal(false);
      setFormData({ email: '', password: '', name: '', credits: 0 });
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubReseller) return;
    setError('');
    setIsSubmitting(true);
    
    try {
      const updateData: { name?: string; password?: string; status?: string } = {};
      if (editFormData.name && editFormData.name !== selectedSubReseller.name) {
        updateData.name = editFormData.name;
      }
      if (editFormData.password) {
        updateData.password = editFormData.password;
      }
      if (editFormData.status !== selectedSubReseller.status) {
        updateData.status = editFormData.status;
      }
      
      await resellerApi.updateSubReseller(selectedSubReseller.id, updateData);
      setShowEditModal(false);
      setSelectedSubReseller(null);
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Erreur lors de la modification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubReseller) return;
    setError('');
    setIsSubmitting(true);
    
    try {
      await resellerApi.transferCreditsToSubReseller(selectedSubReseller.id, creditsAmount);
      setShowCreditsModal(false);
      setCreditsAmount(0);
      setSelectedSubReseller(null);
      loadData();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Erreur lors du transfert');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce sous-revendeur ? Ses appareils seront désassociés.')) return;
    try {
      await resellerApi.deleteSubReseller(id);
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const handleShowHistory = async (subReseller: SubReseller) => {
    setSelectedSubReseller(subReseller);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    
    try {
      const response = await resellerApi.getSubResellerTransactions(subReseller.id);
      setTransactions(response.data);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setTransactions([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openEditModal = (subReseller: SubReseller) => {
    setSelectedSubReseller(subReseller);
    setEditFormData({
      name: subReseller.name,
      password: '',
      status: subReseller.status,
    });
    setShowEditModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && subResellers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Users className="w-16 h-16 mx-auto text-muted mb-4" />
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mes Sous-Revendeurs</h1>
          <p className="text-muted mt-1">
            Vos crédits disponibles : <span className="text-primary font-bold">{myCredits}</span>
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus className="w-5 h-5" />
          Nouveau sous-revendeur
        </button>
      </div>

      <div className="card overflow-hidden">
        {subResellers.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Crédits</th>
                  <th>Appareils</th>
                  <th>Statut</th>
                  <th>Créé le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {subResellers.map((sub) => (
                  <tr key={sub.id}>
                    <td className="font-medium">{sub.name}</td>
                    <td>{sub.email}</td>
                    <td>
                      <span className="font-bold text-primary">{sub.credits}</span>
                    </td>
                    <td>
                      {sub.active_devices} / {sub.device_count}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          sub.status === 'active' ? 'badge-success' : 'badge-error'
                        }`}
                      >
                        {sub.status === 'active' ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="text-muted text-sm">{formatDate(sub.created_at)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedSubReseller(sub);
                            setCreditsAmount(0);
                            setShowCreditsModal(true);
                          }}
                          className="p-2 rounded-lg hover:bg-card text-success"
                          title="Transférer crédits"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleShowHistory(sub)}
                          className="p-2 rounded-lg hover:bg-card text-primary"
                          title="Historique"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(sub)}
                          className="p-2 rounded-lg hover:bg-card text-warning"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sub.id)}
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
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto text-muted mb-4" />
            <p className="text-muted">Aucun sous-revendeur</p>
            <p className="text-sm text-muted mt-2">
              Créez des sous-comptes pour vos clients et transférez-leur des crédits
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Nouveau sous-revendeur</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                {error}
              </div>
            )}
            
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
                <label className="block text-sm font-medium text-muted mb-2">
                  Crédits initiaux <span className="text-xs text-muted">(max: {myCredits})</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={myCredits}
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted mt-1">
                  Ces crédits seront déduits de votre solde
                </p>
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

      {/* Edit Modal */}
      {showEditModal && selectedSubReseller && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Modifier {selectedSubReseller.name}</h2>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-card rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                {error}
              </div>
            )}
            
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Nom</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Nouveau mot de passe <span className="text-xs text-muted">(laisser vide pour ne pas changer)</span>
                </label>
                <input
                  type="password"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Statut</label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full px-4 py-2 bg-dark border border-border rounded-xl"
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credits Transfer Modal */}
      {showCreditsModal && selectedSubReseller && (
        <div className="modal-overlay" onClick={() => setShowCreditsModal(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Transférer des crédits</h2>
              <button onClick={() => setShowCreditsModal(false)} className="p-2 hover:bg-card rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4 p-4 bg-dark/50 rounded-xl">
              <p className="text-muted">
                Vers : <strong className="text-white">{selectedSubReseller.name}</strong>
              </p>
              <p className="text-muted">
                Crédits actuels du sous-revendeur : <strong className="text-primary">{selectedSubReseller.credits}</strong>
              </p>
              <p className="text-muted">
                Vos crédits disponibles : <strong className="text-success">{myCredits}</strong>
              </p>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
                {error}
              </div>
            )}
            
            <form onSubmit={handleTransferCredits} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Montant à transférer
                </label>
                <input
                  type="number"
                  min="1"
                  max={myCredits}
                  value={creditsAmount}
                  onChange={(e) => setCreditsAmount(parseInt(e.target.value) || 0)}
                  required
                />
                <p className="text-xs text-muted mt-1">
                  Maximum : {myCredits} crédits
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreditsModal(false)} className="btn btn-secondary flex-1">
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || creditsAmount <= 0 || creditsAmount > myCredits} 
                  className="btn btn-success flex-1"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Transférer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedSubReseller && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal-content p-6 max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Historique - {selectedSubReseller.name}</h2>
              <button onClick={() => setShowHistoryModal(false)} className="p-2 hover:bg-card rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : transactions.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Montant</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="text-sm text-muted">{formatDate(tx.created_at)}</td>
                        <td>
                          <span className={`badge ${
                            tx.type.includes('in') || tx.type === 'credit_add' 
                              ? 'badge-success' 
                              : tx.type.includes('out') || tx.type === 'activation'
                              ? 'badge-error'
                              : 'badge-warning'
                          }`}>
                            {tx.type === 'credit_transfer_in' ? 'Reçu' :
                             tx.type === 'credit_transfer_out' ? 'Envoyé' :
                             tx.type === 'activation' ? 'Activation' :
                             tx.type === 'credit_add' ? 'Ajout' : tx.type}
                          </span>
                        </td>
                        <td className={`font-bold ${
                          tx.type.includes('in') || tx.type === 'credit_add' 
                            ? 'text-success' 
                            : 'text-error'
                        }`}>
                          {tx.type.includes('in') || tx.type === 'credit_add' ? '+' : '-'}{tx.amount}
                        </td>
                        <td className="text-sm text-muted">{tx.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted py-12">Aucune transaction</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


