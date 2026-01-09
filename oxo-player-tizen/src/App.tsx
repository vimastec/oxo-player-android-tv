/**
 * OXO Player - Application principale pour Samsung Tizen TV
 */

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from './stores/appStore';
import { ActivationPage } from './pages/ActivationPage';
import { HomePage } from './pages/HomePage';
import { LiveTVPage } from './pages/LiveTVPage';
import { MoviesPage } from './pages/MoviesPage';
import { SeriesPage } from './pages/SeriesPage';
import { SettingsPage } from './pages/SettingsPage';
import { getPlaylist } from './services/deviceApi';
import { initXtreamClient } from './services/xtreamApi';
import { Loader2 } from 'lucide-react';
import type { AppSection } from './types';

// Splash Screen
function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-oxo-dark flex items-center justify-center">
      <div className="text-center">
        {/* Logo animé */}
        <div className="relative inline-block mb-8">
          <div className="w-40 h-40 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-oxo-red to-red-700 rounded-3xl shadow-2xl flex items-center justify-center animate-pulse">
              <div className="w-20 h-20 border-4 border-white rounded-full flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-white rounded-full flex items-center justify-center">
                  <div className="w-5 h-5 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <h1 className="text-5xl font-bold text-white mb-3">OXO Player</h1>
        <p className="text-xl text-gray-500 mb-8">Samsung TV Edition</p>
        
        {/* Barre de chargement */}
        <div className="w-64 h-1.5 bg-gray-800 rounded-full mx-auto overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-oxo-red to-red-500 rounded-full"
            style={{ 
              animation: 'loading 2.5s ease-in-out',
              width: '0%'
            }}
          />
        </div>
      </div>
      
      <style>{`
        @keyframes loading {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}

function App() {
  const { 
    isConnected, 
    setConnected, 
    setDeviceInfo,
    setPlaylistType,
    setXtreamCredentials,
    currentSection,
    setSection,
  } = useAppStore();
  
  const [showSplash, setShowSplash] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(false);

  // Charger la playlist après activation
  const loadPlaylist = useCallback(async () => {
    setIsLoadingPlaylist(true);
    
    try {
      const playlistData = await getPlaylist();
      
      if (playlistData.error) {
        console.error('Playlist error:', playlistData.error);
        setIsLoadingPlaylist(false);
        return;
      }

      // Déterminer le type de playlist
      if (playlistData.xtream) {
        setPlaylistType('xtream');
        setXtreamCredentials(playlistData.xtream);
        
        // Initialiser le client Xtream
        const client = initXtreamClient(playlistData.xtream);
        
        // Tester la connexion
        try {
          await client.authenticate();
          console.log('Xtream authentication successful');
        } catch (err) {
          console.error('Xtream auth failed:', err);
        }
      } else {
        setPlaylistType('m3u');
        // TODO: Parser le M3U
      }
      
      setConnected(true);
    } catch (err) {
      console.error('Failed to load playlist:', err);
    } finally {
      setIsLoadingPlaylist(false);
    }
  }, [setConnected, setPlaylistType, setXtreamCredentials]);

  // Vérifier si déjà connecté
  useEffect(() => {
    if (isConnected) {
      setIsActivated(true);
    }
  }, [isConnected]);

  // Handler d'activation
  const handleActivated = useCallback((expirationDate?: string) => {
    setIsActivated(true);
    
    if (expirationDate) {
      const expDate = new Date(expirationDate);
      const now = new Date();
      const diffTime = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      setDeviceInfo({
        macAddress: '', // Will be set by tizenApi
        status: diffDays > 0 ? 'active' : 'expired',
        daysRemaining: Math.max(0, diffDays),
        expirationDate,
      });
    }
    
    // Charger la playlist
    loadPlaylist();
  }, [setDeviceInfo, loadPlaylist]);

  // Handler de navigation
  const handleNavigate = (section: AppSection) => {
    setSection(section);
  };

  // Handler retour
  const handleBack = () => {
    setSection('home');
  };

  // Splash screen
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  // Page d'activation
  if (!isActivated && !isConnected) {
    return <ActivationPage onActivated={handleActivated} />;
  }

  // Chargement playlist
  if (isLoadingPlaylist) {
    return (
      <div className="fixed inset-0 bg-oxo-dark flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-oxo-red animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-400">Chargement de votre playlist...</p>
        </div>
      </div>
    );
  }

  // Render section
  const renderSection = () => {
    switch (currentSection) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'live':
        return <LiveTVPage onBack={handleBack} />;
      case 'movies':
        return <MoviesPage onBack={handleBack} />;
      case 'series':
        return <SeriesPage onBack={handleBack} />;
      case 'settings':
        return <SettingsPage onBack={handleBack} />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return renderSection();
}

export default App;

