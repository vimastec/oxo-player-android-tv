import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, Mail, Store, Loader2, Search } from 'lucide-react';
import { portalApi, SellerContact } from '../services/api';

export default function SellersPage() {
  const navigate = useNavigate();
  const [sellers, setSellers] = useState<SellerContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

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

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Vous êtes revendeur et souhaitez être référencé ?
          </p>
          <p className="text-primary text-sm mt-1">
            Contactez-nous pour rejoindre notre réseau
          </p>
        </div>
      </div>
    </div>
  );
}

