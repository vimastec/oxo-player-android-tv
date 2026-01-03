import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, CreditCard, Loader2, X, Users, Power } from 'lucide-react';
import { adminApi } from '../../services/api';

interface Reseller {
  id: number;
  email: string;
  name: string;
  credits: number;
  status: string;
  allow_cross_reseller_activation?: boolean | number;
  can_create_subresellers?: boolean | number;
  subreseller_count?: number;
  device_count: number;
  active_devices: number;
  created_at: string;
}

export function ResellersPage() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    credits: 0,
    allow_cross_reseller_activation: false,
    can_create_subresellers: false,
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    password: '',
    status: 'active',
    creditsChange: 0,
    creditsAction: 'add' as 'add' | 'remove' | 'set',
    allow_cross_reseller_activation: false,
    can_create_subresellers: false,
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
      setFormData({ email: '', password: '', name: '', credits: 0, allow_cross_reseller_activation: false, can_create_subresellers: false });
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

  const handleToggleCrossActivation = async (reseller: Reseller) => {
    const current =
      reseller.allow_cross_reseller_activation === true || reseller.allow_cross_reseller_activation === 1;
    const next = !current;
    try {
      await adminApi.updateReseller(reseller.id, { allow_cross_reseller_activation: next });
      loadResellers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour');
    }
  };

  const handleToggleSubResellers = async (reseller: Reseller) => {
    const current =
      reseller.can_create_subresellers === true || reseller.can_create_subresellers === 1;
    const next = !current;
    try {
      await adminApi.updateReseller(reseller.id, { can_create_subresellers: next });
      loadResellers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour');
    }
  };

  const openEditModal = (reseller: Reseller) => {
    setSelectedReseller(reseller);
    setEditFormData({
      name: reseller.name,
      password: '',
      status: reseller.status,
      creditsChange: 0,
      creditsAction: 'add',
      allow_cross_reseller_activation: reseller.allow_cross_reseller_activation === true || reseller.allow_cross_reseller_activation === 1,
      can_create_subresellers: reseller.can_create_subresellers === true || reseller.can_create_subresellers === 1,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReseller) return;
    setIsSubmitting(true);
    try {
      // Mettre à jour les infos du revendeur
      const updateData: any = {
        name: editFormData.name,
        status: editFormData.status,
        allow_cross_reseller_activation: editFormData.allow_cross_reseller_activation,
        can_create_subresellers: editFormData.can_create_subresellers,
      };
      
      if (editFormData.password) {
        updateData.password = editFormData.password;
      }

      await adminApi.updateReseller(selectedReseller.id, updateData);

      // Gérer les crédits si nécessaire
      if (editFormData.creditsChange > 0) {
        if (editFormData.creditsAction === 'add') {
          await adminApi.addCredits(selectedReseller.id, editFormData.creditsChange, 'Ajout manuel par admin');
        } else if (editFormData.creditsAction === 'remove') {
          await adminApi.addCredits(selectedReseller.id, -editFormData.creditsChange, 'Retrait manuel par admin');
        } else if (editFormData.creditsAction === 'set') {
          const diff = editFormData.creditsChange - selectedReseller.credits;
          if (diff !== 0) {
            await adminApi.addCredits(selectedReseller.id, diff, diff > 0 ? 'Ajustement solde par admin' : 'Ajustement solde par admin');
          }
        }
      }

      setShowEditModal(false);
      setSelectedReseller(null);
      loadResellers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour');
    } finally {
      setIsSubmitting(false);
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
                  <th>Transfert MAC</th>
                  <th>Sous-revendeurs</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resellers.map((reseller) => (
                  (() => {
                    const crossEnabled =
                      reseller.allow_cross_reseller_activation === true ||
                      reseller.allow_cross_reseller_activation === 1;
                    const subResellersEnabled =
                      reseller.can_create_subresellers === true ||
                      reseller.can_create_subresellers === 1;
                    return (
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
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={crossEnabled}
                          onChange={() => handleToggleCrossActivation(reseller)}
                        />
                        <span className="text-sm text-muted">Autoriser</span>
                      </label>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={subResellersEnabled}
                            onChange={() => handleToggleSubResellers(reseller)}
                          />
                          <span className="text-sm text-muted">Activer</span>
                        </label>
                        {subResellersEnabled && reseller.subreseller_count !== undefined && reseller.subreseller_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <Users className="w-3 h-3" />
                            {reseller.subreseller_count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(reseller)}
                          className="p-2 rounded-lg hover:bg-card text-primary"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
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
                          className={`p-2 rounded-lg hover:bg-card ${reseller.status === 'active' ? 'text-warning' : 'text-success'}`}
                          title={reseller.status === 'active' ? 'Suspendre' : 'Activer'}
                        >
                          <Power className="w-4 h-4" />
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
                    );
                  })()
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
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  checked={formData.allow_cross_reseller_activation}
                  onChange={(e) =>
                    setFormData({ ...formData, allow_cross_reseller_activation: e.target.checked })
                  }
                />
                <div>
                  <p className="text-sm font-medium">Autoriser transfert/prolongation d'une MAC d'un autre revendeur</p>
                  <p className="text-xs text-muted">
                    Si activé, ce revendeur pourra prolonger une MAC active appartenant à un autre revendeur (avec confirmation).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  checked={formData.can_create_subresellers}
                  onChange={(e) =>
                    setFormData({ ...formData, can_create_subresellers: e.target.checked })
                  }
                />
                <div>
                  <p className="text-sm font-medium">Peut créer des sous-revendeurs</p>
                  <p className="text-xs text-muted">
                    Si activé, ce revendeur pourra créer des sous-comptes et leur transférer des crédits depuis son propre solde.
                  </p>
                </div>
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

      {/* Edit Modal - Professional & Mobile Responsive */}
      {showEditModal && selectedReseller && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div 
            className="modal-content w-full max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-secondary p-4 sm:p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Edit2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white">Modifier Revendeur</h2>
                    <p className="text-white/80 text-sm">{selectedReseller.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEditModal(false)} 
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Current Stats */}
            <div className="bg-card border-b border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <span className="text-muted">Solde actuel:</span>
              </div>
              <span className="text-2xl font-bold text-primary">{selectedReseller.credits}</span>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdate} className="p-4 sm:p-6 space-y-5">
              
              {/* Section: Informations */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wide flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Informations
                </h3>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Nom du revendeur</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full h-12 px-4 text-base rounded-xl border border-border bg-dark focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Nouveau mot de passe
                    <span className="text-muted font-normal ml-2">(optionnel)</span>
                  </label>
                  <input
                    type="password"
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    placeholder="Laisser vide pour ne pas changer"
                    className="w-full h-12 px-4 text-base rounded-xl border border-border bg-dark focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Statut du compte</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, status: 'active' })}
                      className={`flex-1 h-12 rounded-xl font-medium transition-all ${
                        editFormData.status === 'active'
                          ? 'bg-success text-white'
                          : 'bg-dark border border-border text-muted hover:border-success'
                      }`}
                    >
                      ✓ Actif
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, status: 'suspended' })}
                      className={`flex-1 h-12 rounded-xl font-medium transition-all ${
                        editFormData.status === 'suspended'
                          ? 'bg-error text-white'
                          : 'bg-dark border border-border text-muted hover:border-error'
                      }`}
                    >
                      ✗ Suspendu
                    </button>
                  </div>
                </div>
              </div>

              {/* Section: Crédits */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wide flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Gestion des crédits
                </h3>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, creditsAction: 'add' })}
                    className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all ${
                      editFormData.creditsAction === 'add'
                        ? 'bg-success text-white'
                        : 'bg-dark border border-border text-muted hover:border-success'
                    }`}
                  >
                    + Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, creditsAction: 'remove' })}
                    className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all ${
                      editFormData.creditsAction === 'remove'
                        ? 'bg-error text-white'
                        : 'bg-dark border border-border text-muted hover:border-error'
                    }`}
                  >
                    − Retirer
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, creditsAction: 'set' })}
                    className={`flex-1 h-11 rounded-xl text-sm font-medium transition-all ${
                      editFormData.creditsAction === 'set'
                        ? 'bg-primary text-white'
                        : 'bg-dark border border-border text-muted hover:border-primary'
                    }`}
                  >
                    = Définir
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {editFormData.creditsAction === 'add' && 'Crédits à ajouter'}
                    {editFormData.creditsAction === 'remove' && 'Crédits à retirer'}
                    {editFormData.creditsAction === 'set' && 'Nouveau solde'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editFormData.creditsChange || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, creditsChange: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full h-14 px-4 text-xl font-bold text-center rounded-xl border border-border bg-dark focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {editFormData.creditsChange > 0 && (
                  <div className={`p-3 rounded-xl text-center font-medium ${
                    editFormData.creditsAction === 'add' ? 'bg-success/20 text-success' :
                    editFormData.creditsAction === 'remove' ? 'bg-error/20 text-error' :
                    'bg-primary/20 text-primary'
                  }`}>
                    Nouveau solde: {' '}
                    <span className="text-lg">
                      {editFormData.creditsAction === 'add' && (selectedReseller.credits + editFormData.creditsChange)}
                      {editFormData.creditsAction === 'remove' && Math.max(0, selectedReseller.credits - editFormData.creditsChange)}
                      {editFormData.creditsAction === 'set' && editFormData.creditsChange}
                    </span>
                    {' '} crédits
                  </div>
                )}
              </div>

              {/* Section: Permissions */}
              <div className="space-y-3 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
                  Permissions
                </h3>

                <label className="flex items-center gap-4 p-3 bg-dark rounded-xl cursor-pointer hover:bg-card transition-colors">
                  <input
                    type="checkbox"
                    checked={editFormData.allow_cross_reseller_activation}
                    onChange={(e) => setEditFormData({ ...editFormData, allow_cross_reseller_activation: e.target.checked })}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Transfert MAC inter-revendeur</p>
                    <p className="text-xs text-muted">Peut activer des MAC d'autres revendeurs</p>
                  </div>
                </label>

                <label className="flex items-center gap-4 p-3 bg-dark rounded-xl cursor-pointer hover:bg-card transition-colors">
                  <input
                    type="checkbox"
                    checked={editFormData.can_create_subresellers}
                    onChange={(e) => setEditFormData({ ...editFormData, can_create_subresellers: e.target.checked })}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Créer des sous-revendeurs</p>
                    <p className="text-xs text-muted">Peut créer et gérer ses propres revendeurs</p>
                  </div>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)} 
                  className="flex-1 h-12 rounded-xl font-medium bg-dark border border-border text-muted hover:bg-card transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="flex-1 h-12 rounded-xl font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>Enregistrer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}






















