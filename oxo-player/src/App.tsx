import { useEffect, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { LiveTVPage } from './pages/LiveTVPage';
import { MoviesPage } from './pages/MoviesPage';
import { SeriesPage } from './pages/SeriesPage';
import { SettingsPage } from './pages/SettingsPage';
import { DeviceActivationPage } from './pages/DeviceActivationPage';
import { HomePage } from './pages/HomePage';

type AppSection = 'home' | 'live' | 'movies' | 'series' | 'catchup' | 'playlist' | 'settings';

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        {/* OXO Logo Animation */}
        <div className="relative inline-block mb-6">
          <div className="w-32 h-32 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 rounded-3xl shadow-xl flex items-center justify-center animate-pulse">
              <div className="w-16 h-16 border-4 border-white rounded-full flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-white rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">OXO Player</h1>
        <p className="text-gray-500">Chargement...</p>
        <div className="mt-6 w-48 h-1 bg-gray-800 rounded-full mx-auto overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full"
            style={{ animation: 'loading 2s ease-in-out' }}
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
  const { isConnected } = useAppStore();
  const [showSplash, setShowSplash] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [currentSection, setCurrentSection] = useState<AppSection>('home');
  const [expirationDate, setExpirationDate] = useState<string | undefined>();

  // Check if we have a stored connection
  useEffect(() => {
    if (isConnected) {
      setIsActivated(true);
    }
  }, [isConnected]);

  // Handle navigation
  const handleNavigate = (section: AppSection) => {
    setCurrentSection(section);
  };

  // Handle back to home
  const handleBackToHome = () => {
    setCurrentSection('home');
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!isActivated && !isConnected) {
    return (
      <DeviceActivationPage 
        onActivated={(expDate) => {
          setIsActivated(true);
          setExpirationDate(expDate);
        }} 
      />
    );
  }

  // Render current section
  const renderSection = () => {
    switch (currentSection) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} expirationDate={expirationDate} />;
      case 'live':
        return <LiveTVPage onBack={handleBackToHome} />;
      case 'movies':
        return <MoviesPage onBack={handleBackToHome} />;
      case 'series':
        return <SeriesPage onBack={handleBackToHome} />;
      case 'settings':
        return <SettingsPage onBack={handleBackToHome} />;
      case 'catchup':
        return (
          <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl text-gray-500 mb-4">Rediffusion</p>
              <p className="text-gray-600">Bientôt disponible</p>
              <button 
                onClick={handleBackToHome}
                className="mt-6 px-6 py-3 bg-red-600 rounded-lg text-white hover:bg-red-700"
              >
                Retour
              </button>
            </div>
          </div>
        );
      case 'playlist':
        return (
          <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl text-gray-500 mb-4">Changer Playlist</p>
              <p className="text-gray-600">Contactez votre revendeur</p>
              <button 
                onClick={handleBackToHome}
                className="mt-6 px-6 py-3 bg-red-600 rounded-lg text-white hover:bg-red-700"
              >
                Retour
              </button>
            </div>
          </div>
        );
      default:
        return <HomePage onNavigate={handleNavigate} expirationDate={expirationDate} />;
    }
  };

  return renderSection();
}

export default App;
