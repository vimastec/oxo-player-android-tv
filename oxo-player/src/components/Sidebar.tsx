import { 
  Tv, 
  Film, 
  MonitorPlay, 
  Calendar, 
  Star, 
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import type { AppSection } from '../types';

interface NavItem {
  id: AppSection;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'live', label: 'Live TV', icon: <Tv className="w-6 h-6" /> },
  { id: 'movies', label: 'Films', icon: <Film className="w-6 h-6" /> },
  { id: 'series', label: 'Séries', icon: <MonitorPlay className="w-6 h-6" /> },
  { id: 'epg', label: 'Guide TV', icon: <Calendar className="w-6 h-6" /> },
  { id: 'favorites', label: 'Favoris', icon: <Star className="w-6 h-6" /> },
  { id: 'settings', label: 'Paramètres', icon: <Settings className="w-6 h-6" /> },
];

export function Sidebar() {
  const { currentSection, setCurrentSection, disconnect, userInfo } = useAppStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleNavClick = (section: AppSection) => {
    setCurrentSection(section);
    setIsMobileOpen(false);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-oxo-card rounded-xl border border-oxo-border"
      >
        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative top-0 left-0 h-full z-40
          bg-oxo-darker border-r border-oxo-border
          transition-all duration-300 ease-out
          ${isCollapsed ? 'w-20' : 'w-64'}
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-oxo-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-oxo-primary to-oxo-secondary flex items-center justify-center">
                <span className="text-xl font-bold">OXO</span>
              </div>
              {!isCollapsed && (
                <div className="animate-fade-in">
                  <h1 className="font-display font-bold text-xl">OXO Player</h1>
                  <p className="text-xs text-oxo-muted">IPTV Streaming</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center gap-4 px-4 py-3 rounded-xl
                  transition-all duration-200 tv-focusable
                  ${currentSection === item.id
                    ? 'bg-oxo-primary text-white shadow-lg shadow-oxo-primary/30'
                    : 'hover:bg-oxo-card text-oxo-muted hover:text-white'
                  }
                `}
              >
                {item.icon}
                {!isCollapsed && (
                  <span className="font-medium animate-fade-in">{item.label}</span>
                )}
              </button>
            ))}
          </nav>

          {/* User info & Logout */}
          <div className="p-4 border-t border-oxo-border">
            {userInfo && !isCollapsed && (
              <div className="mb-4 px-4 py-3 bg-oxo-card rounded-xl animate-fade-in">
                <p className="text-sm font-medium truncate">{userInfo.username}</p>
                <p className="text-xs text-oxo-muted">
                  Expire: {new Date(parseInt(userInfo.exp_date) * 1000).toLocaleDateString()}
                </p>
              </div>
            )}
            
            <button
              onClick={disconnect}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl
                text-red-400 hover:bg-red-500/10 transition-colors tv-focusable"
            >
              <LogOut className="w-6 h-6" />
              {!isCollapsed && <span className="font-medium">Déconnexion</span>}
            </button>
          </div>

          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2
              w-6 h-12 bg-oxo-card border border-oxo-border rounded-full
              items-center justify-center hover:bg-oxo-primary transition-colors"
          >
            <span className={`transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
              ›
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}






















