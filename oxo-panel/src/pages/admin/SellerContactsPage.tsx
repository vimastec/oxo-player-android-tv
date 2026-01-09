import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, X, Phone, MapPin, Mail, Store } from 'lucide-react';
import { adminApi } from '../../services/api';

interface SellerContact {
  id: number;
  name: string;
  city: string;
  phone: string;
  email: string | null;
  address: string | null;
  is_active: number;
  created_at: string;
}

export function SellerContactsPage() {
  const [sellers, setSellers] = useState<SellerContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSeller, setEditingSeller] = useState<SellerContact | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    phone: '',
    email: '',
    address: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadSellers();
  }, []);

  const loadSellers = async () => {
    try {
      const response = await adminApi.getSellerContacts();
      setSellers(response.data);
    } catch (error) {
      console.error('Error loading seller contacts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSeller(null);
    setFormData({ name: '', city: '', phone: '', email: '', address: '' });
    setShowModal(true);
  };

  const openEditModal = (seller: SellerContact) => {
    setEditingSeller(seller);
    setFormData({
      name: seller.name,
      city: seller.city,
      phone: seller.phone,
      email: seller.email || '',
      address: seller.address || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (editingSeller) {
        await adminApi.updateSellerContact(editingSeller.id, formData);
      } else {
        await adminApi.createSellerContact(formData);
      }
      setShowModal(false);
      setFormData({ name: '', city: '', phone: '', email: '', address: '' });
      setEditingSeller(null);
      loadSellers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce revendeur ?')) return;
    try {
      await adminApi.deleteSellerContact(id);
      loadSellers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const handleToggleStatus = async (seller: SellerContact) => {
    try {
      await adminApi.updateSellerContact(seller.id, { is_active: seller.is_active === 1 ? false : true });
      loadSellers();
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
        <div>
          <h1 className="text-2xl font-bold">Points de vente</h1>
          <p className="text-muted text-sm mt-1">
            Liste des revendeurs agréés affichée sur le portail
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus className="w-5 h-5" />
          Ajouter un point de vente
        </button>
      </div>

      <div className="card overflow-hidden">
        {sellers.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Ville</th>
                  <th>Téléphone</th>
                  <th>Email</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((seller) => (
                  <tr key={seller.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-primary" />
                        <span className="font-medium">{seller.name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 text-muted">
                        <MapPin className="w-4 h-4" />
                        {seller.city}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-success" />
                        {seller.phone}
                      </div>
                    </td>
                    <td>
                      {seller.email ? (
                        <div className="flex items-center gap-2 text-muted">
                          <Mail className="w-4 h-4" />
                          {seller.email}
                        </div>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          seller.is_active === 1 ? 'badge-success' : 'badge-error'
                        }`}
                      >
                        {seller.is_active === 1 ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleStatus(seller)}
                          className={`p-2 rounded-lg hover:bg-card ${
                            seller.is_active === 1 ? 'text-warning' : 'text-success'
                          }`}
                          title={seller.is_active === 1 ? 'Désactiver' : 'Activer'}
                        >
                          {seller.is_active === 1 ? '⏸️' : '▶️'}
                        </button>
                        <button
                          onClick={() => openEditModal(seller)}
                          className="p-2 rounded-lg hover:bg-card text-primary"
                          title="Modifier"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(seller.id)}
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
            <Store className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted">Aucun point de vente</p>
            <p className="text-muted text-sm mt-1">
              Ajoutez des revendeurs pour qu'ils apparaissent sur le portail
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                {editingSeller ? 'Modifier le point de vente' : 'Nouveau point de vente'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-card rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Nom du point de vente <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Boutique OXO"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Ville <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Paris"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Téléphone <span className="text-error">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="Ex: +33 6 12 34 56 78"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Email (optionnel)
                </label>
                <input
                  type="email"
                  placeholder="Ex: contact@boutique.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Adresse (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 123 Rue de Paris"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary flex-1">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingSeller ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}










