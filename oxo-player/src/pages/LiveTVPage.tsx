import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/appStore';
import { VideoPlayer } from '../components/VideoPlayer';
import { VideoPreview } from '../components/VideoPreview';
import { Search, Star, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import xtreamApi from '../services/xtreamApi';
import type { LiveChannel } from '../types';

interface LiveTVPageProps {
  onBack?: () => void;
}

export function LiveTVPage({ onBack }: LiveTVPageProps) {
  const { liveChannels, liveCategories, credentials, favorites, addFavorite, removeFavorite, isFavorite } = useAppStore();
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  const channelListRef = useRef<HTMLDivElement>(null);
  const selectedChannelRef = useRef<HTMLDivElement>(null);

  // Categories with channel counts
  const categoriesWithCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    liveChannels.forEach(ch => {
      const catId = ch.category_id || 'other';
      counts[catId] = (counts[catId] || 0) + 1;
    });

    // Add special categories
    const specialCategories: { id: string; name: string; count: number; icon?: React.ReactNode }[] = [
      { id: '__all__', name: 'All', count: liveChannels.length },
      { id: '__favorites__', name: 'Favorites', count: favorites.filter(f => f.type === 'live').length, icon: <Star className="w-4 h-4" /> },
      { id: '__recent__', name: 'Recently Viewed', count: 0, icon: <Clock className="w-4 h-4" /> },
    ];

    const regularCategories = liveCategories.map(cat => ({
      id: cat.category_id,
      name: cat.category_name,
      count: counts[cat.category_id] || 0,
    }));

    return [...specialCategories, ...regularCategories];
  }, [liveCategories, liveChannels, favorites]);

  // Filtered channels based on selected category
  const filteredChannels = useMemo(() => {
    let channels = liveChannels;

    if (selectedCategoryId === '__favorites__') {
      const favIds = favorites.filter(f => f.type === 'live').map(f => f.id);
      channels = liveChannels.filter(ch => favIds.includes(ch.stream_id));
    } else if (selectedCategoryId === '__recent__') {
      // TODO: Implement recently viewed
      channels = [];
    } else if (selectedCategoryId && selectedCategoryId !== '__all__') {
      channels = liveChannels.filter(ch => ch.category_id === selectedCategoryId);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter(ch => ch.name.toLowerCase().includes(query));
    }

    return channels;
  }, [liveChannels, selectedCategoryId, searchQuery, favorites]);

  // Auto-select first channel when category changes
  useEffect(() => {
    if (filteredChannels.length > 0 && !selectedChannel) {
      setSelectedChannel(filteredChannels[0]);
    }
  }, [filteredChannels]);

  // Scroll selected channel into view
  useEffect(() => {
    if (selectedChannelRef.current) {
      selectedChannelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedChannel]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFullscreen) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          setIsFullscreen(false);
        }
        return;
      }

      const currentIndex = filteredChannels.findIndex(ch => ch.stream_id === selectedChannel?.stream_id);

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            setSelectedChannel(filteredChannels[currentIndex - 1]);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < filteredChannels.length - 1) {
            setSelectedChannel(filteredChannels[currentIndex + 1]);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedChannel) {
            setIsFullscreen(true);
          }
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          if (selectedChannel) {
            setSelectedChannel(null);
          } else if (onBack) {
            onBack();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredChannels, selectedChannel, isFullscreen]);

  const getStreamUrl = (channel: LiveChannel): string => {
    let streamUrl = '';
    
    if (channel.direct_source) {
      streamUrl = channel.direct_source;
    } else if (credentials) {
      xtreamApi.setCredentials(credentials);
      streamUrl = xtreamApi.getLiveStreamUrl(channel.stream_id);
    }
    
    // Use proxy for external streams to bypass CORS
    if (streamUrl && (streamUrl.includes('http://') || streamUrl.includes('https://'))) {
      return `http://localhost:3000/api/stream/proxy?url=${encodeURIComponent(streamUrl)}`;
    }
    
    return streamUrl;
  };

  const handleChannelClick = (channel: LiveChannel) => {
    if (selectedChannel?.stream_id === channel.stream_id) {
      // Double click - go fullscreen
      setIsFullscreen(true);
    } else {
      // First click - select and preview
      setSelectedChannel(channel);
    }
  };

  const handleToggleFavorite = () => {
    if (!selectedChannel) return;
    
    if (isFavorite(selectedChannel.stream_id, 'live')) {
      removeFavorite(selectedChannel.stream_id, 'live');
    } else {
      addFavorite({
        id: selectedChannel.stream_id,
        type: 'live',
        name: selectedChannel.name,
        icon: selectedChannel.stream_icon,
        addedAt: Date.now(),
      });
    }
  };

  // Fullscreen video player
  if (isFullscreen && selectedChannel) {
    return (
      <VideoPlayer
        src={getStreamUrl(selectedChannel)}
        streamId={selectedChannel.stream_id}
        streamType="live"
        title={selectedChannel.name}
        poster={selectedChannel.stream_icon}
        onClose={() => setIsFullscreen(false)}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a1628]">
      {/* Header */}
      <div className="flex-shrink-0 h-12 flex items-center bg-[#0d1e36] border-b border-[#1a3a5c] px-4">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mr-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Retour</span>
          </button>
        )}
        <span className="flex-1 text-center text-sm text-blue-400 font-medium">En direct</span>
        {onBack && <div className="w-20" />} {/* Spacer for centering */}
      </div>

      {/* Main content - 3 columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column - Categories */}
        <div className="w-[320px] flex-shrink-0 border-r border-[#1a3a5c] overflow-y-auto scrollbar-hide">
          {categoriesWithCounts.map((cat, index) => (
            <div
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                selectedCategoryId === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-[#1a3a5c] text-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-500 w-6 text-right text-sm">{index + 1}</span>
                {cat.icon && <span className="text-gray-400">{cat.icon}</span>}
                <span className="truncate">{cat.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${selectedCategoryId === cat.id ? 'text-white' : 'text-gray-500'}`}>
                  {cat.count}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          ))}
        </div>

        {/* Middle column - Channels list */}
        <div 
          ref={channelListRef}
          className="w-[420px] flex-shrink-0 border-r border-[#1a3a5c] overflow-y-auto scrollbar-hide"
        >
          {filteredChannels.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Aucune chaîne
            </div>
          ) : (
            filteredChannels.map((channel, index) => (
              <div
                key={channel.stream_id}
                ref={selectedChannel?.stream_id === channel.stream_id ? selectedChannelRef : null}
                onClick={() => handleChannelClick(channel)}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                  selectedChannel?.stream_id === channel.stream_id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-[#1a3a5c] text-gray-300'
                }`}
              >
                <span className="text-gray-500 w-8 text-right text-sm">{index + 1}</span>
                
                {/* Channel logo */}
                <div className="w-10 h-10 rounded overflow-hidden bg-[#0d1e36] flex-shrink-0">
                  {channel.stream_icon ? (
                    <img
                      src={channel.stream_icon}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                      TV
                    </div>
                  )}
                </div>

                {/* Channel name */}
                <span className="truncate flex-1 text-sm">{channel.name}</span>
              </div>
            ))
          )}
        </div>

        {/* Right column - Video preview */}
        <div className="flex-1 flex flex-col bg-[#0d1e36]">
          {selectedChannel ? (
            <>
              {/* Video preview */}
              <div className="flex-1 relative bg-black">
                <VideoPreview
                  key={selectedChannel.stream_id}
                  src={getStreamUrl(selectedChannel)}
                  poster={selectedChannel.stream_icon}
                  onDoubleClick={() => setIsFullscreen(true)}
                />
              </div>

              {/* Channel info */}
              <div className="flex-shrink-0 p-4 border-t border-[#1a3a5c]">
                <h2 className="text-lg font-medium text-white truncate">
                  {selectedChannel.name}
                </h2>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Sélectionnez une chaîne
            </div>
          )}

          {/* Bottom buttons */}
          <div className="flex-shrink-0 p-4 flex gap-4">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex-1 py-3 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
            >
              Chercher
            </button>
            <button
              onClick={handleToggleFavorite}
              disabled={!selectedChannel}
              className={`flex-1 py-3 rounded-full font-medium transition-colors ${
                selectedChannel && isFavorite(selectedChannel.stream_id, 'live')
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {selectedChannel && isFavorite(selectedChannel.stream_id, 'live') ? '★ Favori' : 'Préféré'}
            </button>
          </div>
        </div>
      </div>

      {/* Search modal */}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8">
          <div className="bg-[#0d1e36] rounded-2xl p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">Rechercher une chaîne</h3>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom de la chaîne..."
                autoFocus
                className="w-full pl-12 pr-4 py-3 bg-[#0a1628] border border-[#1a3a5c] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearch(false);
                }}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => setShowSearch(false)}
                className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
              >
                Rechercher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
