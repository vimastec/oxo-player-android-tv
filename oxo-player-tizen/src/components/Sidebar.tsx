/**
 * Sidebar de navigation principale
 */

import { useEffect, useRef } from 'react';
import { Home, Tv, Film, Video, Settings, LogOut } from 'lucide-react';
import type { AppSection } from '../types';
import { exitApp } from '../services/tizenApi';

interface SidebarProps {
  currentSection: AppSection;
  onNavigate: (section: AppSection) => void;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  daysRemaining?: number;
}

const menuItems: Array<{ id: AppSection; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'live', label: 'TV en direct', icon: Tv },
  { id: 'movies', label: 'Films', icon: Film },
  { id: 'series', label: 'Séries', icon: Video },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export function Sidebar({ 
  currentSection, 
  onNavigate, 
  isExpanded, 
  onExpandedChange,
  daysRemaining 
}: SidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus le premier élément quand expanded
  useEffect(() => {
    if (isExpanded) {
      const currentIndex = menuItems.findIndex(item => item.id === currentSection);
      itemRefs.current[currentIndex]?.focus();
    }
  }, [isExpanded, currentSection]);

  const handleItemClick = (section: AppSection) => {
    onNavigate(section);
    onExpandedChange(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = (index + 1) % (menuItems.length + 1); // +1 pour le bouton quitter
      if (nextIndex < menuItems.length) {
        itemRefs.current[nextIndex]?.focus();
      } else {
        // Focus sur le bouton quitter
        document.getElementById('exit-button')?.focus();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = index === 0 ? menuItems.length : index - 1;
      if (prevIndex < menuItems.length) {
        itemRefs.current[prevIndex]?.focus();
      }
    } else if (event.key === 'ArrowRight') {
      onExpandedChange(false);
    }
  };

  return (
    <div
      ref={sidebarRef}
      className={`fixed left-0 top-0 h-full bg-gradient-to-b from-oxo-gray to-oxo-dark z-40 transition-all duration-300 flex flex-col ${
        isExpanded ? 'w-72' : 'w-24'
      }`}
      onMouseEnter={() => onExpandedChange(true)}
      onMouseLeave={() => onExpandedChange(false)}
    >
      {/* Logo */}
      <div className="p-6 flex items-center justify-center">
        <div className={`transition-all duration-300 ${isExpanded ? 'w-16 h-16' : 'w-12 h-12'}`}>
          <div className="w-full h-full bg-gradient-to-br from-oxo-red to-red-700 rounded-xl flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white rounded-full flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>
        {isExpanded && (
          <span className="ml-4 text-2xl font-bold text-white">OXO</span>
        )}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            
            return (
              <li key={item.id}>
                <button
                  ref={el => { itemRefs.current[index] = el; }}
                  onClick={() => handleItemClick(item.id)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all focusable ${
                    isActive
                      ? 'bg-oxo-red text-white'
                      : 'text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                  tabIndex={0}
                >
                  <Icon className={`w-7 h-7 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
                  {isExpanded && (
                    <span className="text-lg font-medium whitespace-nowrap">{item.label}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        {/* Days remaining */}
        {isExpanded && daysRemaining !== undefined && (
          <div className="mb-4 px-4 py-3 bg-white/5 rounded-lg">
            <p className="text-sm text-gray-400">Abonnement</p>
            <p className={`text-lg font-bold ${daysRemaining <= 7 ? 'text-orange-500' : 'text-green-500'}`}>
              {daysRemaining} jours restants
            </p>
          </div>
        )}
        
        {/* Exit button */}
        <button
          id="exit-button"
          onClick={() => exitApp()}
          className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-gray-400 hover:bg-red-500/20 hover:text-red-500 transition-all focusable"
          tabIndex={0}
        >
          <LogOut className="w-7 h-7 flex-shrink-0" />
          {isExpanded && (
            <span className="text-lg font-medium">Quitter</span>
          )}
        </button>
      </div>
    </div>
  );
}

