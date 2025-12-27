import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Mail, Store, Loader2, Search, Send, CheckCircle, Users } from 'lucide-react';
import { portalApi, SellerContact } from '../services/api';

export default function SellersPage() {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<SellerContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  
  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    quantity: 10,
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    loadSellers();
  }, []);

  const loadSellers = async () => {
    try {
      const data = await portalApi.getSellers();
      setSellers(data);
    } catch (error) {
      console.error('Error loading sellers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError('');

    try {
      await portalApi.submitSellerRequest(formData);
      setSubmitSuccess(true);
      setFormData({ name: '', phone: '', city: '', quantity: 10, message: '' });
    } catch (error: any) {
      setSubmitError(error.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get unique cities for filter
  const cities = [...new Set(sellers.map(s => s.city))].sort();

  // Filter sellers
  const filteredSellers = sellers.filter(seller => {
    const matchesSearch = seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          seller.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCity = !selectedCity || seller.city === selectedCity;
    return matchesSearch && matchesCity;
  });

  // Group by city
  const sellersByCity = filteredSellers.reduce((acc, seller) => {
    if (!acc[seller.city]) {
      acc[seller.city] = [];
    }
    acc[seller.city].push(seller);
    return acc;
  }, {} as Record<string, SellerContact[]>);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Background effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-radial from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-radial from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-dark-300 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Où acheter OXO Player ?</h1>
            <p className="text-gray-400 text-sm mt-1">
              Trouvez un revendeur agréé près de chez vous
            </p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher un revendeur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* City filter */}
          {cities.length > 1 && (
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="bg-dark-200 border border-dark-100 rounded-lg px-4 py-3 text-white min-w-[200px]"
            >
              <option value="">Toutes les villes</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          )}
        </div>

        {/* Sellers list */}
        {Object.keys(sellersByCity).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(sellersByCity).sort().map(([city, citySellers]) => (
              <div key={city}>
                {/* City header */}
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold text-white">{city}</h2>
                  <span className="text-gray-500 text-sm">({citySellers.length})</span>
                </div>

                {/* Sellers grid */}
                <div className="grid gap-4 md:grid-cols-2">
                  {citySellers.map(seller => (
                    <div
                      key={seller.id}
                      className="card p-5 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Store className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white text-lg mb-2">
                            {seller.name}
                          </h3>
                          
                          {/* Phone */}
                          <a
                            href={`tel:${seller.phone}`}
                            className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors mb-2"
                          >
                            <Phone className="w-4 h-4" />
                            <span className="font-medium">{seller.phone}</span>
                          </a>

                          {/* Email */}
                          {seller.email && (
                            <a
                              href={`mailto:${seller.email}`}
                              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2"
                            >
                              <Mail className="w-4 h-4" />
                              <span className="text-sm truncate">{seller.email}</span>
                            </a>
                          )}

                          {/* Address */}
                          {seller.address && (
                            <p className="text-gray-500 text-sm mt-2">
                              📍 {seller.address}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Store className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Aucun revendeur trouvé
            </h3>
            <p className="text-gray-400">
              {searchTerm || selectedCity
                ? 'Essayez de modifier vos critères de recherche'
                : 'Les revendeurs seront bientôt disponibles'}
            </p>
          </div>
        )}

        {/* Become a Reseller Section */}
        <div className="mt-12 card p-6 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Devenez revendeur OXO Player</h3>
              <p className="text-gray-400 text-sm">Rejoignez notre réseau de partenaires</p>
            </div>
          </div>

          {!showContactForm && !submitSuccess && (
            <button
              onClick={() => setShowContactForm(true)}
              className="w-full btn btn-primary py-3 mt-4"
            >
              <Send className="w-5 h-5 mr-2" />
              Faire une demande
            </button>
          )}

          {submitSuccess && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h4 className="text-green-400 font-semibold text-lg">Demande envoyée !</h4>
              <p className="text-gray-400 text-sm mt-2">
                Nous vous contacterons très bientôt pour discuter de votre partenariat.
              </p>
              <button
                onClick={() => {
                  setSubmitSuccess(false);
                  setShowContactForm(false);
                }}
                className="mt-4 text-primary hover:underline text-sm"
              >
                Fermer
              </button>
            </div>
          )}

          {showContactForm && !submitSuccess && (
            <form onSubmit={handleSubmitRequest} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nom complet <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Votre nom"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Téléphone <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+212 6XX XXX XXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ville <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Votre ville"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Quantité estimée / mois
                  </label>
                  <select
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                    className="bg-dark-200 border border-dark-100 rounded-lg px-4 py-3 text-white w-full"
                  >
                    <option value={5}>5 - 10 activations</option>
                    <option value={10}>10 - 25 activations</option>
                    <option value={25}>25 - 50 activations</option>
                    <option value={50}>50 - 100 activations</option>
                    <option value={100}>100+ activations</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Message (optionnel)
                </label>
                <textarea
                  placeholder="Parlez-nous de votre activité..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={3}
                  className="bg-dark-200 border border-dark-100 rounded-lg px-4 py-3 text-white w-full resize-none"
                />
              </div>

              {submitError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  {submitError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowContactForm(false)}
                  className="btn btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Envoyer la demande
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

