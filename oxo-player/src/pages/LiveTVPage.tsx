import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { VideoPlayer } from '../components/VideoPlayer';
import { VideoPreview } from '../components/VideoPreview';
import { Search, Star, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import xtreamApi from '../services/xtreamApi';
import type { LiveChannel } from '../types';

interface LiveTVPageProps {
  onBack?: () => void;
}

// Hauteur d'un élément de liste
const CHANNEL_ITEM_HEIGHT = 56;
const CATEGORY_ITEM_HEIGHT = 48;

// Row component for categories
interface CategoryRowProps {
  index: number;
  cat: { id: string; name: string; count: number; icon?: React.ReactNode };
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
}

function CategoryRowComponent({ index, cat, isSelected, isFocused, onClick }: CategoryRowProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-600 text-white'
          : isFocused
          ? 'bg-blue-500/50 text-white'
          : 'hover:bg-[#1a3a5c] text-gray-300'
      }`}
      style={{ height: CATEGORY_ITEM_HEIGHT }}
    >
      <div className="flex items-center gap-3">
        <span className="text-gray-500 w-6 text-right text-sm">{index + 1}</span>
        {cat.icon && <span className="text-gray-400">{cat.icon}</span>}
        <span className="truncate">{cat.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${isSelected || isFocused ? 'text-white' : 'text-gray-500'}`}>
          {cat.count}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </div>
    </div>
  );
}

// Row component for channels
interface ChannelRowProps {
  index: number;
  channel: LiveChannel;
  isSelected: boolean;
  isFocused: boolean;
  onClick: () => void;
}

function ChannelRowComponent({ index, channel, isSelected, isFocused, onClick }: ChannelRowProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-600 text-white'
          : isFocused
          ? 'bg-blue-500/50 text-white'
          : 'hover:bg-[#1a3a5c] text-gray-300'
      }`}
      style={{ height: CHANNEL_ITEM_HEIGHT }}
    >
      <span className="text-gray-500 w-8 text-right text-sm">{index + 1}</span>
      
      {/* Channel logo */}
      <div className="w-10 h-10 rounded overflow-hidden bg-[#0d1e36] flex-shrink-0">
        {channel.stream_icon ? (
          <img
            src={channel.stream_icon}
            alt=""
            className="w-full h-full object-contain"
            loading="lazy"
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
  );
}

export function LiveTVPage({ onBack }: LiveTVPageProps) {
  const { liveChannels, liveCategories, credentials, favorites, addFavorite, removeFavorite, isFavorite } = useAppStore();
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const categoryListRef = useRef<HTMLDivElement>(null);
  const channelListRef = useRef<HTMLDivElement>(null);
  
  // Index sélectionnés pour la navigation
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [selectedChannelIndex, setSelectedChannelIndex] = useState(0);
  const [focusColumn, setFocusColumn] = useState<'categories' | 'channels' | 'preview'>('categories');
  

  // Categories with channel counts
  const categoriesWithCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    liveChannels.forEach(ch => {
      const catId = ch.category_id || 'other';
      counts[catId] = (counts[catId] || 0) + 1;
    });

    const specialCategories: { id: string; name: string; count: number; icon?: React.ReactNode }[] = [
      { id: '__all__', name: 'Toutes', count: liveChannels.length },
      { id: '__favorites__', name: 'Favoris', count: favorites.filter(f => f.type === 'live').length, icon: <Star className="w-4 h-4" /> },
      { id: '__recent__', name: 'Récents', count: 0, icon: <Clock className="w-4 h-4" /> },
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
      channels = [];
    } else if (selectedCategoryId && selectedCategoryId !== '__all__') {
      channels = liveChannels.filter(ch => ch.category_id === selectedCategoryId);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      channels = channels.filter(ch => ch.name.toLowerCase().includes(query));
    }

    return channels;
  }, [liveChannels, selectedCategoryId, searchQuery, favorites]);

  // Scroll to selected items
  useEffect(() => {
    if (categoryListRef.current && selectedCategoryIndex >= 0) {
      const element = categoryListRef.current.children[selectedCategoryIndex] as HTMLElement;
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedCategoryIndex]);

  useEffect(() => {
    if (channelListRef.current && selectedChannelIndex >= 0) {
      const element = channelListRef.current.children[selectedChannelIndex] as HTMLElement;
      element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedChannelIndex]);

  // Update selected channel when index changes
  useEffect(() => {
    if (filteredChannels.length > 0 && selectedChannelIndex >= 0 && selectedChannelIndex < filteredChannels.length) {
      setSelectedChannel(filteredChannels[selectedChannelIndex]);
    }
  }, [selectedChannelIndex, filteredChannels]);

  // Reset channel index when category changes
  useEffect(() => {
    setSelectedChannelIndex(0);
    if (filteredChannels.length > 0) {
      setSelectedChannel(filteredChannels[0]);
    } else {
      setSelectedChannel(null);
    }
  }, [selectedCategoryId]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSearch) {
        if (e.key === 'Escape') setShowSearch(false);
        return;
      }

      if (isFullscreen) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          setIsFullscreen(false);
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (focusColumn === 'categories') {
            setSelectedCategoryIndex(prev => Math.max(0, prev - 1));
          } else if (focusColumn === 'channels') {
            setSelectedChannelIndex(prev => Math.max(0, prev - 1));
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (focusColumn === 'categories') {
            setSelectedCategoryIndex(prev => Math.min(categoriesWithCounts.length - 1, prev + 1));
          } else if (focusColumn === 'channels') {
            setSelectedChannelIndex(prev => Math.min(filteredChannels.length - 1, prev + 1));
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (focusColumn === 'channels') setFocusColumn('categories');
          else if (focusColumn === 'preview') setFocusColumn('channels');
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (focusColumn === 'categories') setFocusColumn('channels');
          else if (focusColumn === 'channels') setFocusColumn('preview');
          break;
        case 'Enter':
          e.preventDefault();
          if (focusColumn === 'categories') {
            const cat = categoriesWithCounts[selectedCategoryIndex];
            if (cat) {
              setSelectedCategoryId(cat.id);
              setFocusColumn('channels');
            }
          } else if (focusColumn === 'channels' || focusColumn === 'preview') {
            if (selectedChannel) setIsFullscreen(true);
          }
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          if (focusColumn === 'preview') setFocusColumn('channels');
          else if (focusColumn === 'channels') setFocusColumn('categories');
          else if (onBack) onBack();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusColumn, selectedCategoryIndex, selectedChannelIndex, categoriesWithCounts, filteredChannels, selectedChannel, isFullscreen, showSearch, onBack]);

  const getStreamUrl = useCallback((channel: LiveChannel): string => {
    let streamUrl = '';
    if (channel.direct_source) {
      streamUrl = channel.direct_source;
    } else if (credentials) {
      xtreamApi.setCredentials(credentials);
      streamUrl = xtreamApi.getLiveStreamUrl(channel.stream_id);
    }
    if (streamUrl && (streamUrl.includes('http://') || streamUrl.includes('https://'))) {
      return `http://localhost:3000/api/stream/proxy?url=${encodeURIComponent(streamUrl)}`;
    }
    return streamUrl;
  }, [credentials]);

  const handleChannelClick = useCallback((channel: LiveChannel, index: number) => {
    if (selectedChannel?.stream_id === channel.stream_id) {
      setIsFullscreen(true);
    } else {
      setSelectedChannelIndex(index);
      setSelectedChannel(channel);
      setFocusColumn('channels');
    }
  }, [selectedChannel]);

  const handleCategoryClick = useCallback((categoryId: string, index: number) => {
    setSelectedCategoryId(categoryId);
    setSelectedCategoryIndex(index);
    setFocusColumn('categories');
  }, []);

  const handleToggleFavorite = useCallback(() => {
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
  }, [selectedChannel, isFavorite, removeFavorite, addFavorite]);

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
    <div ref={containerRef} className="h-screen flex flex-col bg-[#0a1628]">
      {/* Header */}
      <div className="flex-shrink-0 h-12 flex items-center bg-[#0d1e36] border-b border-[#1a3a5c] px-4">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mr-4 tv-focusable">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Retour</span>
          </button>
        )}
        <span className="flex-1 text-center text-sm text-blue-400 font-medium">
          En direct ({filteredChannels.length} chaînes)
        </span>
        {onBack && <div className="w-20" />}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Categories */}
        <div ref={categoryListRef} className={`w-[320px] flex-shrink-0 border-r border-[#1a3a5c] overflow-y-auto scrollbar-hide ${
          focusColumn === 'categories' ? 'ring-2 ring-blue-500 ring-inset' : ''
        }`}>
          {categoriesWithCounts.map((cat, index) => (
            <CategoryRowComponent
              key={cat.id}
              index={index}
              cat={cat}
              isSelected={selectedCategoryId === cat.id}
              isFocused={focusColumn === 'categories' && selectedCategoryIndex === index}
              onClick={() => handleCategoryClick(cat.id, index)}
            />
          ))}
        </div>

        {/* Channels */}
        <div ref={channelListRef} className={`w-[420px] flex-shrink-0 border-r border-[#1a3a5c] overflow-y-auto scrollbar-hide ${
          focusColumn === 'channels' ? 'ring-2 ring-blue-500 ring-inset' : ''
        }`}>
          {filteredChannels.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">Aucune chaîne</div>
          ) : (
            filteredChannels.map((channel, index) => (
              <ChannelRowComponent
                key={channel.stream_id}
                index={index}
                channel={channel}
                isSelected={selectedChannel?.stream_id === channel.stream_id}
                isFocused={focusColumn === 'channels' && selectedChannelIndex === index}
                onClick={() => handleChannelClick(channel, index)}
              />
            ))
          )}
        </div>

        {/* Preview */}
        <div className={`flex-1 flex flex-col bg-[#0d1e36] ${focusColumn === 'preview' ? 'ring-2 ring-blue-500 ring-inset' : ''}`}>
          {selectedChannel ? (
            <>
              <div className="flex-1 relative bg-black">
                <VideoPreview
                  key={selectedChannel.stream_id}
                  src={getStreamUrl(selectedChannel)}
                  poster={selectedChannel.stream_icon}
                  onDoubleClick={() => setIsFullscreen(true)}
                />
              </div>
              <div className="flex-shrink-0 p-4 border-t border-[#1a3a5c]">
                <h2 className="text-lg font-medium text-white truncate">{selectedChannel.name}</h2>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">Sélectionnez une chaîne</div>
          )}
          <div className="flex-shrink-0 p-4 flex gap-4">
            <button onClick={() => setShowSearch(!showSearch)} className="flex-1 py-3 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors tv-focusable">
              Chercher
            </button>
            <button onClick={handleToggleFavorite} disabled={!selectedChannel}
              className={`flex-1 py-3 rounded-full font-medium transition-colors tv-focusable ${
                selectedChannel && isFavorite(selectedChannel.stream_id, 'live')
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}>
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
              <button onClick={() => { setSearchQuery(''); setShowSearch(false); }}
                className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors tv-focusable">
                Annuler
              </button>
              <button onClick={() => setShowSearch(false)}
                className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors tv-focusable">
                Rechercher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
