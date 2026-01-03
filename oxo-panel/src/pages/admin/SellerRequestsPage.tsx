import { useEffect, useState } from 'react';
import { Trash2, Loader2, Phone, MapPin, Package, MessageSquare, Check, X, Clock, UserCheck } from 'lucide-react';
import { adminApi } from '../../services/api';

interface SellerRequest {
  id: number;
  name: string;
  phone: string;
  city: string;
  quantity: number;
  message: string | null;
  status: 'pending' | 'contacted' | 'approved' | 'rejected';
  created_at: string;
}

const statusConfig = {
  pending: { label: 'En attente', color: 'badge-warning', icon: Clock },
  contacted: { label: 'Contacté', color: 'badge-info', icon: Phone },
  approved: { label: 'Approuvé', color: 'badge-success', icon: UserCheck },
  rejected: { label: 'Refusé', color: 'badge-error', icon: X },
};

export function SellerRequestsPage() {
  const [requests, setRequests] = useState<SellerRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SellerRequest | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await adminApi.getSellerRequests();
      setRequests(response.data);
    } catch (error) {
      console.error('Error loading seller requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await adminApi.updateSellerRequest(id, { status });
      loadRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette demande ?')) return;
    try {
      await adminApi.deleteSellerRequest(id);
      loadRequests();
      setSelectedRequest(null);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

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
          <h1 className="text-2xl font-bold flex items-center gap-3">
            Demandes de partenariat
            {pendingCount > 0 && (
              <span className="px-3 py-1 bg-warning text-black text-sm font-bold rounded-full">
                {pendingCount} nouvelle{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p className="text-muted text-sm mt-1">
            Personnes souhaitant devenir revendeurs OXO Player
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requests List */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            {requests.length > 0 ? (
              <div className="divide-y divide-border">
                {requests.map((request) => {
                  const config = statusConfig[request.status];
                  const StatusIcon = config.icon;
                  
                  return (
                    <div
                      key={request.id}
                      onClick={() => setSelectedRequest(request)}
                      className={`p-4 cursor-pointer transition-colors hover:bg-card ${
                        selectedRequest?.id === request.id ? 'bg-card border-l-4 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{request.name}</h3>
                            <span className={`badge ${config.color} text-xs`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {config.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {request.city}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {request.quantity}+ / mois
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-2">
                            {new Date(request.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted mx-auto mb-4" />
                <p className="text-muted">Aucune demande de partenariat</p>
              </div>
            )}
          </div>
        </div>

        {/* Request Details */}
        <div className="lg:col-span-1">
          {selectedRequest ? (
            <div className="card p-6 sticky top-6">
              <h3 className="text-lg font-bold mb-4">Détails de la demande</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted uppercase">Nom</label>
                  <p className="font-semibold text-lg">{selectedRequest.name}</p>
                </div>

                <div>
                  <label className="text-xs text-muted uppercase">Téléphone</label>
                  <a
                    href={`tel:${selectedRequest.phone}`}
                    className="flex items-center gap-2 text-success font-medium hover:underline"
                  >
                    <Phone className="w-4 h-4" />
                    {selectedRequest.phone}
                  </a>
                </div>

                <div>
                  <label className="text-xs text-muted uppercase">Ville</label>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted" />
                    {selectedRequest.city}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-muted uppercase">Quantité estimée</label>
                  <p className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted" />
                    {selectedRequest.quantity}+ activations / mois
                  </p>
                </div>

                {selectedRequest.message && (
                  <div>
                    <label className="text-xs text-muted uppercase">Message</label>
                    <p className="text-sm bg-card p-3 rounded-lg mt-1">
                      {selectedRequest.message}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs text-muted uppercase mb-2 block">Changer le statut</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedRequest.id, 'contacted')}
                      className={`btn btn-sm ${selectedRequest.status === 'contacted' ? 'btn-info' : 'btn-secondary'}`}
                    >
                      <Phone className="w-4 h-4" />
                      Contacté
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedRequest.id, 'approved')}
                      className={`btn btn-sm ${selectedRequest.status === 'approved' ? 'btn-success' : 'btn-secondary'}`}
                    >
                      <Check className="w-4 h-4" />
                      Approuvé
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedRequest.id, 'pending')}
                      className={`btn btn-sm ${selectedRequest.status === 'pending' ? 'btn-warning' : 'btn-secondary'}`}
                    >
                      <Clock className="w-4 h-4" />
                      En attente
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedRequest.id, 'rejected')}
                      className={`btn btn-sm ${selectedRequest.status === 'rejected' ? 'btn-error' : 'btn-secondary'}`}
                    >
                      <X className="w-4 h-4" />
                      Refusé
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(selectedRequest.id)}
                  className="btn btn-error w-full mt-4"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer la demande
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-6 text-center">
              <MessageSquare className="w-12 h-12 text-muted mx-auto mb-4" />
              <p className="text-muted">Sélectionnez une demande pour voir les détails</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}





