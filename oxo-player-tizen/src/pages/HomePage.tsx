/**
 * Page d'accueil avec menu
 */

import { useEffect, useRef, useState } from 'react';
import { Tv, Film, Video, Settings, ChevronRight } from 'lucide-react';
import type { AppSection } from '../types';
import { useAppStore } from '../stores/appStore';
import { TV_KEYS, isKey } from '../utils/tvNavigation';

interface HomePageProps {
  onNavigate: (section: AppSection) => void;
}

const menuItems: Array<{ 
  id: AppSection; 
  label: string; 
  description: string;
  icon: typeof Tv;
  color: string;
}> = [
  { 
    id: 'live', 
    label: 'TV en direct', 
    description: 'Regardez vos chaînes préférées',
    icon: Tv,
    color: 'from-blue-500 to-blue-700'
  },
  { 
    id: 'movies', 
    label: 'Films', 
    description: 'Découvrez notre catalogue de films',
    icon: Film,
    color: 'from-purple-500 to-purple-700'
  },
  { 
    id: 'series', 
    label: 'Séries', 
    description: 'Vos séries favorites',
    icon: Video,
    color: 'from-green-500 to-green-700'
  },
  { 
    id: 'settings', 
    label: 'Paramètres', 
    description: 'Configuration de l\'application',
    icon: Settings,
    color: 'from-gray-500 to-gray-700'
  },
];

export function HomePage({ onNavigate }: HomePageProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { daysRemaining, deviceStatus, expirationDate } = useAppStore();

  // Focus initial
  useEffect(() => {
    itemRefs.current[0]?.focus();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKey(event, TV_KEYS.UP)) {
        event.preventDefault();
        const newIndex = focusedIndex > 0 ? focusedIndex - 1 : menuItems.length - 1;
        setFocusedIndex(newIndex);
        itemRefs.current[newIndex]?.focus();
      } else if (isKey(event, TV_KEYS.DOWN)) {
        event.preventDefault();
        const newIndex = focusedIndex < menuItems.length - 1 ? focusedIndex + 1 : 0;
        setFocusedIndex(newIndex);
        itemRefs.current[newIndex]?.focus();
      } else if (isKey(event, TV_KEYS.ENTER)) {
        onNavigate(menuItems[focusedIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, onNavigate]);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-oxo-dark">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-oxo-red/10 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 p-8 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-oxo-red to-red-700 rounded-xl flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white rounded-full flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">OXO Player</h1>
            <p className="text-gray-500">Samsung TV</p>
          </div>
        </div>

        {/* Status badge */}
        <div className={`px-4 py-2 rounded-full ${
          deviceStatus === 'active' 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-orange-500/20 text-orange-400'
        }`}>
          {deviceStatus === 'active' ? '✓ Activé' : `Essai - ${daysRemaining}j restants`}
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex h-[calc(100vh-140px)]">
        {/* Left side - Menu */}
        <div className="w-1/2 p-8 pr-4">
          <h2 className="text-2xl font-semibold text-white mb-6">Menu principal</h2>
          
          <div className="space-y-4">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              const isFocused = focusedIndex === index;
              
              return (
                <button
                  key={item.id}
                  ref={el => { itemRefs.current[index] = el; }}
                  onClick={() => onNavigate(item.id)}
                  onFocus={() => setFocusedIndex(index)}
                  className={`w-full flex items-center gap-6 p-6 rounded-2xl transition-all duration-300 focusable ${
                    isFocused 
                      ? `bg-gradient-to-r ${item.color} shadow-2xl scale-105` 
                      : 'bg-oxo-gray hover:bg-oxo-gray/80'
                  }`}
                  tabIndex={0}
                >
                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                    isFocused ? 'bg-white/20' : 'bg-white/10'
                  }`}>
                    <Icon className={`w-8 h-8 ${isFocused ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  
                  <div className="flex-1 text-left">
                    <h3 className={`text-xl font-semibold ${isFocused ? 'text-white' : 'text-gray-200'}`}>
                      {item.label}
                    </h3>
                    <p className={`text-sm ${isFocused ? 'text-white/80' : 'text-gray-500'}`}>
                      {item.description}
                    </p>
                  </div>
                  
                  <ChevronRight className={`w-8 h-8 ${isFocused ? 'text-white' : 'text-gray-600'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right side - Preview */}
        <div className="w-1/2 p-8 pl-4 flex items-center justify-center">
          <div className="w-full max-w-lg">
            {/* Featured item preview */}
            <div className={`aspect-video rounded-3xl bg-gradient-to-br ${menuItems[focusedIndex].color} p-8 flex flex-col justify-end shadow-2xl`}>
              <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                {(() => {
                  const Icon = menuItems[focusedIndex].icon;
                  return <Icon className="w-10 h-10 text-white" />;
                })()}
              </div>
              <h3 className="text-4xl font-bold text-white mb-2">
                {menuItems[focusedIndex].label}
              </h3>
              <p className="text-white/80 text-lg">
                {menuItems[focusedIndex].description}
              </p>
            </div>

            {/* Subscription info */}
            {expirationDate && (
              <div className="mt-6 p-6 bg-oxo-gray rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Expiration de l'abonnement</p>
                    <p className="text-white text-lg font-semibold">
                      {formatDate(expirationDate)}
                    </p>
                  </div>
                  <div className={`text-3xl font-bold ${daysRemaining <= 7 ? 'text-orange-500' : 'text-green-500'}`}>
                    {daysRemaining}j
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer hints */}
      <footer className="absolute bottom-0 left-0 right-0 p-6 flex items-center justify-center gap-8 text-gray-600 text-sm">
        <span className="flex items-center gap-2">
          <span className="px-3 py-1 bg-white/10 rounded">▲▼</span>
          Navigation
        </span>
        <span className="flex items-center gap-2">
          <span className="px-3 py-1 bg-white/10 rounded">OK</span>
          Sélectionner
        </span>
      </footer>
    </div>
  );
}

