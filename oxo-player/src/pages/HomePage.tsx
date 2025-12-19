import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Tv, Film, PlaySquare, RotateCcw, ListVideo, Settings } from 'lucide-react';

interface HomePageProps {
  onNavigate: (section: 'live' | 'movies' | 'series' | 'catchup' | 'playlist' | 'settings') => void;
  expirationDate?: string;
}

export function HomePage({ onNavigate, expirationDate }: HomePageProps) {
  const [currentDate, setCurrentDate] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const menuItems = [
    { id: 'live', label: 'EN DIRECT', icon: Tv, color: 'from-red-600 to-red-700' },
    { id: 'movies', label: 'FILMS', icon: Film, color: 'from-red-600 to-red-700' },
    { id: 'series', label: 'SÉRIES', icon: PlaySquare, color: 'from-red-600 to-red-700' },
    { id: 'catchup', label: 'REDIFFUSION', icon: RotateCcw, color: 'from-red-600 to-red-700' },
    { id: 'playlist', label: 'PLAYLIST', icon: ListVideo, color: 'from-red-600 to-red-700' },
    { id: 'settings', label: 'PARAMÈTRES', icon: Settings, color: 'from-red-600 to-red-700' },
  ];

  useEffect(() => {
    // Format expiration date
    if (expirationDate) {
      const date = new Date(expirationDate);
      setCurrentDate(date.toISOString().split('T')[0]);
    } else {
      // Default: 1 year from now
      const date = new Date();
      date.setFullYear(date.getFullYear() + 1);
      setCurrentDate(date.toISOString().split('T')[0]);
    }
  }, [expirationDate]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : menuItems.length - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < menuItems.length - 1 ? prev + 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          const item = menuItems[selectedIndex];
          onNavigate(item.id as any);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, menuItems, onNavigate]);

  return (
    <div className="h-screen w-full bg-[#0a0a0a] relative overflow-hidden flex flex-col">
      {/* Background pattern - World map style */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm9-10v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3Cpath d='M6 5V0H5v5H0v1h5v94h1V6h94V5H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Hexagon overlay pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, transparent 20%, #000 70%)`,
        }}
      />

      {/* Header with date */}
      <div className="relative z-10 flex justify-end p-6">
        <div className="text-white text-2xl font-light tracking-wider">
          {currentDate}
        </div>
      </div>

      {/* Center logo */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className="text-center">
          {/* OXO Logo */}
          <div className="inline-flex items-center justify-center w-40 h-40 rounded-3xl bg-gradient-to-br from-red-600 to-red-700 shadow-2xl shadow-red-900/50 mb-6">
            <span className="text-6xl font-black text-white tracking-tight">OXO</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-2">OXO Player</h1>
          <p className="text-gray-500 text-lg">Votre univers de divertissement</p>
        </div>
      </div>

      {/* Bottom menu */}
      <div className="relative z-10 pb-12">
        <div className="flex justify-center gap-6 px-8">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isSelected = index === selectedIndex;
            
            return (
              <div
                key={item.id}
                onClick={() => onNavigate(item.id as any)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`cursor-pointer transition-all duration-300 ${
                  isSelected ? 'transform scale-110 -translate-y-2' : 'hover:scale-105'
                }`}
              >
                {/* Icon container */}
                <div className="relative mb-3">
                  <div className={`w-32 h-32 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 ${
                    isSelected 
                      ? 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-500/40' 
                      : 'bg-gradient-to-br from-gray-700 to-gray-800 shadow-black/40'
                  }`}>
                    <Icon className={`w-16 h-16 transition-colors ${
                      isSelected ? 'text-white' : 'text-gray-300'
                    }`} strokeWidth={1.5} />
                  </div>
                  {/* Glow effect when selected */}
                  {isSelected && (
                    <div className="absolute inset-0 rounded-2xl bg-red-500/20 blur-xl -z-10" />
                  )}
                </div>
                
                {/* Label */}
                <div className={`text-center py-3 px-6 rounded-xl font-semibold text-base transition-all duration-300 ${
                  isSelected 
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/30' 
                    : 'bg-gray-800/80 text-gray-400'
                }`}>
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

