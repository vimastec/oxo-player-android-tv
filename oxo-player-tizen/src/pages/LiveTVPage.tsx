/**
 * Page Live TV - Liste des chaînes en direct
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { TizenPlayer } from '../components/TizenPlayer';
import { TV_KEYS, isKey } from '../utils/tvNavigation';
import { getXtreamClient, initXtreamClient, type XtreamLiveStream, type XtreamCategory } from '../services/xtreamApi';

interface LiveTVPageProps {
  onBack: () => void;
}

export function LiveTVPage({ onBack }: LiveTVPageProps) {
  const { xtreamCredentials, playlistType } = useAppStore();
  
  const [categories, setCategories] = useState<XtreamCategory[]>([]);
  const [channels, setChannels] = useState<XtreamLiveStream[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<XtreamLiveStream[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Player state
  const [playingChannel, setPlayingChannel] = useState<XtreamLiveStream | null>(null);
  
  // Focus state
  const [focusArea, setFocusArea] = useState<'categories' | 'channels'>('categories');
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState(0);
  const [focusedChannelIndex, setFocusedChannelIndex] = useState(0);
  
  const categoryRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const channelRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Charger les données
  const loadData = useCallback(async () => {
    if (playlistType !== 'xtream' || !xtreamCredentials) {
      setError('Aucune playlist Xtream configurée');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let client = getXtreamClient();
      if (!client) {
        client = initXtreamClient(xtreamCredentials);
      }

      // Charger catégories et chaînes
      const [cats, streams] = await Promise.all([
        client.getLiveCategories(),
        client.getLiveStreams(),
      ]);

      setCategories(cats);
      setChannels(streams);
      setFilteredChannels(streams);
      
      if (cats.length > 0) {
        setSelectedCategory(cats[0].category_id);
      }
    } catch (err) {
      console.error('Failed to load live TV:', err);
      setError('Impossible de charger les chaînes');
    } finally {
      setIsLoading(false);
    }
  }, [playlistType, xtreamCredentials]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtrer par catégorie
  useEffect(() => {
    if (selectedCategory) {
      const filtered = channels.filter(ch => ch.category_id === selectedCategory);
      setFilteredChannels(filtered);
      setFocusedChannelIndex(0);
    } else {
      setFilteredChannels(channels);
    }
  }, [selectedCategory, channels]);

  // Focus initial
  useEffect(() => {
    if (!isLoading && categories.length > 0) {
      categoryRefs.current[0]?.focus();
    }
  }, [isLoading, categories]);

  // Lancer une chaîne
  const playChannel = (channel: XtreamLiveStream) => {
    const client = getXtreamClient();
    if (!client) return;
    
    setPlayingChannel(channel);
  };

  // Keyboard navigation
  useEffect(() => {
    if (playingChannel) return; // Player gère ses propres touches

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKey(event, TV_KEYS.BACK)) {
        event.preventDefault();
        if (focusArea === 'channels') {
          setFocusArea('categories');
          categoryRefs.current[focusedCategoryIndex]?.focus();
        } else {
          onBack();
        }
        return;
      }

      if (focusArea === 'categories') {
        if (isKey(event, TV_KEYS.UP)) {
          event.preventDefault();
          const newIndex = focusedCategoryIndex > 0 ? focusedCategoryIndex - 1 : categories.length - 1;
          setFocusedCategoryIndex(newIndex);
          categoryRefs.current[newIndex]?.focus();
        } else if (isKey(event, TV_KEYS.DOWN)) {
          event.preventDefault();
          const newIndex = focusedCategoryIndex < categories.length - 1 ? focusedCategoryIndex + 1 : 0;
          setFocusedCategoryIndex(newIndex);
          categoryRefs.current[newIndex]?.focus();
        } else if (isKey(event, TV_KEYS.RIGHT) || isKey(event, TV_KEYS.ENTER)) {
          event.preventDefault();
          setFocusArea('channels');
          channelRefs.current[0]?.focus();
        }
      } else {
        // Channels area - grid navigation
        const cols = 5; // 5 colonnes
        const totalChannels = filteredChannels.length;
        
        if (isKey(event, TV_KEYS.UP)) {
          event.preventDefault();
          const newIndex = focusedChannelIndex >= cols ? focusedChannelIndex - cols : focusedChannelIndex;
          setFocusedChannelIndex(newIndex);
          channelRefs.current[newIndex]?.focus();
        } else if (isKey(event, TV_KEYS.DOWN)) {
          event.preventDefault();
          const newIndex = focusedChannelIndex + cols < totalChannels ? focusedChannelIndex + cols : focusedChannelIndex;
          setFocusedChannelIndex(newIndex);
          channelRefs.current[newIndex]?.focus();
        } else if (isKey(event, TV_KEYS.LEFT)) {
          event.preventDefault();
          if (focusedChannelIndex % cols === 0) {
            // Première colonne - retour aux catégories
            setFocusArea('categories');
            categoryRefs.current[focusedCategoryIndex]?.focus();
          } else {
            const newIndex = focusedChannelIndex - 1;
            setFocusedChannelIndex(newIndex);
            channelRefs.current[newIndex]?.focus();
          }
        } else if (isKey(event, TV_KEYS.RIGHT)) {
          event.preventDefault();
          if ((focusedChannelIndex + 1) % cols !== 0 && focusedChannelIndex < totalChannels - 1) {
            const newIndex = focusedChannelIndex + 1;
            setFocusedChannelIndex(newIndex);
            channelRefs.current[newIndex]?.focus();
          }
        } else if (isKey(event, TV_KEYS.ENTER)) {
          const channel = filteredChannels[focusedChannelIndex];
          if (channel) {
            playChannel(channel);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusArea, focusedCategoryIndex, focusedChannelIndex, categories, filteredChannels, onBack, playingChannel]);

  // Player
  if (playingChannel) {
    const client = getXtreamClient();
    const streamUrl = client?.getLiveStreamUrl(playingChannel.stream_id) || '';
    
    return (
      <TizenPlayer
        src={streamUrl}
        title={playingChannel.name}
        onClose={() => setPlayingChannel(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-oxo-dark flex">
      {/* Sidebar - Categories */}
      <div className="w-72 bg-oxo-gray flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <button
            onClick={onBack}
            className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors focusable p-2 rounded-lg"
            tabIndex={0}
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-lg">Retour</span>
          </button>
          <h1 className="text-2xl font-bold text-white mt-4">TV en direct</h1>
          <p className="text-gray-500">{channels.length} chaînes</p>
        </div>

        {/* Categories list */}
        <div className="flex-1 overflow-y-auto p-4">
          {categories.map((cat, index) => (
            <button
              key={cat.category_id}
              ref={el => { categoryRefs.current[index] = el; }}
              onClick={() => {
                setSelectedCategory(cat.category_id);
                setFocusedCategoryIndex(index);
              }}
              onFocus={() => {
                setFocusArea('categories');
                setFocusedCategoryIndex(index);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl mb-2 transition-all focusable ${
                selectedCategory === cat.category_id
                  ? 'bg-oxo-red text-white'
                  : 'text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
              tabIndex={0}
            >
              <span className="line-clamp-1">{cat.category_name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content - Channels */}
      <div className="flex-1 p-8 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-oxo-red animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-xl">Chargement des chaînes...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-500 text-xl mb-4">{error}</p>
              <button
                onClick={loadData}
                className="px-6 py-3 bg-oxo-red rounded-xl text-white font-semibold focusable flex items-center gap-2 mx-auto"
                tabIndex={0}
              >
                <RefreshCw className="w-5 h-5" />
                Réessayer
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Category title */}
            <h2 className="text-2xl font-bold text-white mb-6">
              {categories.find(c => c.category_id === selectedCategory)?.category_name || 'Toutes les chaînes'}
            </h2>

            {/* Channels grid */}
            <div className="grid grid-cols-5 gap-4">
              {filteredChannels.map((channel, index) => (
                <button
                  key={channel.stream_id}
                  ref={el => { channelRefs.current[index] = el; }}
                  onClick={() => playChannel(channel)}
                  onFocus={() => {
                    setFocusArea('channels');
                    setFocusedChannelIndex(index);
                  }}
                  className="bg-oxo-gray rounded-xl p-4 transition-all focusable card-hover text-left"
                  tabIndex={0}
                >
                  {/* Logo */}
                  <div className="aspect-video bg-black/50 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {channel.stream_icon ? (
                      <img
                        src={channel.stream_icon}
                        alt={channel.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-3xl text-gray-600">📺</span>
                    )}
                  </div>
                  
                  {/* Name */}
                  <p className="text-white font-medium line-clamp-2 text-sm">
                    {channel.name}
                  </p>
                </button>
              ))}
            </div>

            {filteredChannels.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-500 text-xl">Aucune chaîne dans cette catégorie</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer hints */}
      <div className="fixed bottom-6 right-6 flex items-center gap-6 text-gray-600 text-sm">
        <span className="flex items-center gap-2">
          <span className="px-2 py-1 bg-white/10 rounded text-xs">◀</span>
          Retour
        </span>
        <span className="flex items-center gap-2">
          <span className="px-2 py-1 bg-white/10 rounded text-xs">OK</span>
          Regarder
        </span>
      </div>
    </div>
  );
}

