import { useEffect, useState } from 'react';

interface HomePageProps {
  onNavigate: (section: 'live' | 'movies' | 'series' | 'catchup' | 'playlist' | 'settings') => void;
  expirationDate?: string;
}

// Icônes SVG simples (pas de lucide-react pour compatibilité)
const TvIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
    <polyline points="17 2 12 7 7 2"/>
  </svg>
);

const FilmIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
    <line x1="7" y1="2" x2="7" y2="22"/>
    <line x1="17" y1="2" x2="17" y2="22"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="2" y1="7" x2="7" y2="7"/>
    <line x1="2" y1="17" x2="7" y2="17"/>
    <line x1="17" y1="17" x2="22" y2="17"/>
    <line x1="17" y1="7" x2="22" y2="7"/>
  </svg>
);

const PlayIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/>
    <polygon points="10 8 16 12 10 16 10 8"/>
  </svg>
);

const RotateIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="1 4 1 10 7 10"/>
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
);

const ListIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

const SettingsIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

const menuItems = [
  { id: 'live', label: 'EN DIRECT', Icon: TvIcon },
  { id: 'movies', label: 'FILMS', Icon: FilmIcon },
  { id: 'series', label: 'SÉRIES', Icon: PlayIcon },
  { id: 'catchup', label: 'REDIFFUSION', Icon: RotateIcon },
  { id: 'playlist', label: 'PLAYLIST', Icon: ListIcon },
  { id: 'settings', label: 'PARAMÈTRES', Icon: SettingsIcon },
];

export function HomePage({ onNavigate, expirationDate }: HomePageProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    if (expirationDate) {
      const date = new Date(expirationDate);
      setCurrentDate(date.toISOString().split('T')[0]);
    } else {
      const date = new Date();
      setCurrentDate(date.toISOString().split('T')[0]);
    }
  }, [expirationDate]);

  // Mettre à jour l'index sélectionné quand le focus change
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const tabIndex = target.getAttribute('tabindex');
      if (tabIndex) {
        const index = parseInt(tabIndex) - 1;
        if (index >= 0 && index < menuItems.length) {
          setSelectedIndex(index);
        }
      }
    };
    
    document.addEventListener('focus', handleFocus, true);
    return () => document.removeEventListener('focus', handleFocus, true);
  }, []);

  // Styles inline pour compatibilité Tizen
  const containerStyle: React.CSSProperties = {
    height: '100vh',
    width: '100%',
    backgroundColor: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'Arial, sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '24px',
  };

  const dateStyle: React.CSSProperties = {
    color: 'white',
    fontSize: '24px',
    fontWeight: 300,
  };

  const centerStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const logoContainerStyle: React.CSSProperties = {
    textAlign: 'center' as const,
  };

  const logoBoxStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '160px',
    height: '160px',
    borderRadius: '24px',
    background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    boxShadow: '0 25px 50px -12px rgba(185, 28, 28, 0.5)',
    marginBottom: '24px',
  };

  const logoTextStyle: React.CSSProperties = {
    fontSize: '60px',
    fontWeight: 900,
    color: 'white',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '48px',
    fontWeight: 'bold',
    color: 'white',
    marginBottom: '8px',
  };

  const subtitleStyle: React.CSSProperties = {
    color: '#6b7280',
    fontSize: '18px',
  };

  const menuContainerStyle: React.CSSProperties = {
    paddingBottom: '48px',
  };

  const menuGridStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    padding: '0 20px',
    flexWrap: 'wrap' as const,
    maxWidth: '1400px',
    margin: '0 auto',
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={dateStyle}>{currentDate}</div>
      </div>

      {/* Logo central */}
      <div style={centerStyle}>
        <div style={logoContainerStyle}>
          <div style={logoBoxStyle}>
            <span style={logoTextStyle}>OXO</span>
          </div>
          <h1 style={titleStyle}>OXO Player</h1>
          <p style={subtitleStyle}>Votre univers de divertissement</p>
        </div>
      </div>

      {/* Menu */}
      <div style={menuContainerStyle}>
        <div style={menuGridStyle}>
          {menuItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            const Icon = item.Icon;

            const itemStyle: React.CSSProperties = {
              cursor: 'pointer',
              transition: 'transform 0.2s',
              transform: isSelected ? 'scale(1.05)' : 'scale(1)',
              outline: 'none',
              width: '180px',
              display: 'inline-block',
            };

            const iconBoxStyle: React.CSSProperties = {
              width: '180px',
              height: '180px',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              background: isSelected 
                ? 'linear-gradient(135deg, #ef4444, #b91c1c)' 
                : 'linear-gradient(135deg, #374151, #1f2937)',
              boxShadow: isSelected 
                ? '0 0 30px rgba(239, 68, 68, 0.4)' 
                : '0 10px 15px rgba(0, 0, 0, 0.3)',
              color: isSelected ? 'white' : '#d1d5db',
            };

            const labelStyle: React.CSSProperties = {
              textAlign: 'center' as const,
              padding: '16px 24px',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '16px',
              background: isSelected 
                ? 'linear-gradient(90deg, #dc2626, #b91c1c)' 
                : 'rgba(31, 41, 55, 0.8)',
              color: isSelected ? 'white' : '#9ca3af',
              boxShadow: isSelected ? '0 4px 15px rgba(220, 38, 38, 0.3)' : 'none',
            };

            return (
              <button
                key={item.id}
                type="button"
                style={itemStyle}
                tabIndex={0}
                data-tv-auto-focus={index === 0 ? 'true' : undefined}
                onClick={() => onNavigate(item.id as 'live' | 'movies' | 'series' | 'catchup' | 'playlist' | 'settings')}
                onMouseEnter={() => setSelectedIndex(index)}
                onFocus={() => setSelectedIndex(index)}
              >
                <div style={iconBoxStyle}>
                  <Icon />
                </div>
                <div style={labelStyle}>{item.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
