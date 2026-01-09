/**
 * Page Séries
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Star } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { TizenPlayer } from '../components/TizenPlayer';
import { TV_KEYS, isKey } from '../utils/tvNavigation';
import { getXtreamClient, initXtreamClient, type XtreamSeries, type XtreamSeriesInfo, type XtreamCategory } from '../services/xtreamApi';

interface SeriesPageProps {
  onBack: () => void;
}

type ViewMode = 'list' | 'detail' | 'playing';

export function SeriesPage({ onBack }: SeriesPageProps) {
  const { xtreamCredentials, playlistType } = useAppStore();
  
  const [categories, setCategories] = useState<XtreamCategory[]>([]);
  const [series, setSeries] = useState<XtreamSeries[]>([]);
  const [filteredSeries, setFilteredSeries] = useState<XtreamSeries[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Detail view
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedSeries, setSelectedSeries] = useState<XtreamSeries | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<XtreamSeriesInfo | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [playingEpisode, setPlayingEpisode] = useState<{ url: string; title: string } | null>(null);
  
  // Focus state
  const [focusArea, setFocusArea] = useState<'categories' | 'series' | 'seasons' | 'episodes'>('categories');
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState(0);
  const [focusedSeriesIndex, setFocusedSeriesIndex] = useState(0);
  const [focusedSeasonIndex, setFocusedSeasonIndex] = useState(0);
  const [focusedEpisodeIndex, setFocusedEpisodeIndex] = useState(0);
  
  const categoryRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const seriesRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const seasonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const episodeRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

      const [cats, seriesList] = await Promise.all([
        client.getSeriesCategories(),
        client.getSeries(),
      ]);

      setCategories(cats);
      setSeries(seriesList);
      setFilteredSeries(seriesList);
      
      if (cats.length > 0) {
        setSelectedCategory(cats[0].category_id);
      }
    } catch (err) {
      console.error('Failed to load series:', err);
      setError('Impossible de charger les séries');
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
      const filtered = series.filter(s => s.category_id === selectedCategory);
      setFilteredSeries(filtered);
      setFocusedSeriesIndex(0);
    } else {
      setFilteredSeries(series);
    }
  }, [selectedCategory, series]);

  // Charger les détails d'une série
  const loadSeriesDetail = async (serie: XtreamSeries) => {
    const client = getXtreamClient();
    if (!client) return;

    setSelectedSeries(serie);
    setViewMode('detail');
    setIsLoading(true);

    try {
      const info = await client.getSeriesInfo(serie.series_id);
      setSeriesInfo(info);
      setSelectedSeason(1);
      setFocusedSeasonIndex(0);
      setFocusedEpisodeIndex(0);
      setFocusArea('seasons');
    } catch (err) {
      console.error('Failed to load series info:', err);
      setError('Impossible de charger les détails');
    } finally {
      setIsLoading(false);
    }
  };

  // Lancer un épisode
  const playEpisode = (episodeId: string, extension: string, title: string) => {
    const client = getXtreamClient();
    if (!client) return;
    
    const url = client.getSeriesStreamUrl(episodeId, extension);
    setPlayingEpisode({ url, title });
    setViewMode('playing');
  };

  // Episodes de la saison sélectionnée
  const currentEpisodes = seriesInfo?.episodes?.[selectedSeason.toString()] || [];

  // Focus initial
  useEffect(() => {
    if (!isLoading && viewMode === 'list' && categories.length > 0) {
      categoryRefs.current[0]?.focus();
    }
  }, [isLoading, viewMode, categories]);

  // Keyboard navigation
  useEffect(() => {
    if (viewMode === 'playing') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKey(event, TV_KEYS.BACK)) {
        event.preventDefault();
        if (viewMode === 'detail') {
          setViewMode('list');
          setFocusArea('series');
          setTimeout(() => seriesRefs.current[focusedSeriesIndex]?.focus(), 0);
        } else if (focusArea === 'series') {
          setFocusArea('categories');
          categoryRefs.current[focusedCategoryIndex]?.focus();
        } else {
          onBack();
        }
        return;
      }

      if (viewMode === 'list') {
        // Navigation liste
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
            setFocusArea('series');
            seriesRefs.current[0]?.focus();
          }
        } else {
          const cols = 6;
          const totalSeries = filteredSeries.length;
          
          if (isKey(event, TV_KEYS.UP)) {
            event.preventDefault();
            const newIndex = focusedSeriesIndex >= cols ? focusedSeriesIndex - cols : focusedSeriesIndex;
            setFocusedSeriesIndex(newIndex);
            seriesRefs.current[newIndex]?.focus();
          } else if (isKey(event, TV_KEYS.DOWN)) {
            event.preventDefault();
            const newIndex = focusedSeriesIndex + cols < totalSeries ? focusedSeriesIndex + cols : focusedSeriesIndex;
            setFocusedSeriesIndex(newIndex);
            seriesRefs.current[newIndex]?.focus();
          } else if (isKey(event, TV_KEYS.LEFT)) {
            event.preventDefault();
            if (focusedSeriesIndex % cols === 0) {
              setFocusArea('categories');
              categoryRefs.current[focusedCategoryIndex]?.focus();
            } else {
              const newIndex = focusedSeriesIndex - 1;
              setFocusedSeriesIndex(newIndex);
              seriesRefs.current[newIndex]?.focus();
            }
          } else if (isKey(event, TV_KEYS.RIGHT)) {
            event.preventDefault();
            if ((focusedSeriesIndex + 1) % cols !== 0 && focusedSeriesIndex < totalSeries - 1) {
              const newIndex = focusedSeriesIndex + 1;
              setFocusedSeriesIndex(newIndex);
              seriesRefs.current[newIndex]?.focus();
            }
          } else if (isKey(event, TV_KEYS.ENTER)) {
            const serie = filteredSeries[focusedSeriesIndex];
            if (serie) {
              loadSeriesDetail(serie);
            }
          }
        }
      } else if (viewMode === 'detail') {
        // Navigation détail
        if (focusArea === 'seasons') {
          if (isKey(event, TV_KEYS.UP)) {
            event.preventDefault();
            const seasons = Object.keys(seriesInfo?.episodes || {}).length;
            const newIndex = focusedSeasonIndex > 0 ? focusedSeasonIndex - 1 : seasons - 1;
            setFocusedSeasonIndex(newIndex);
            setSelectedSeason(newIndex + 1);
            seasonRefs.current[newIndex]?.focus();
          } else if (isKey(event, TV_KEYS.DOWN)) {
            event.preventDefault();
            const seasons = Object.keys(seriesInfo?.episodes || {}).length;
            const newIndex = focusedSeasonIndex < seasons - 1 ? focusedSeasonIndex + 1 : 0;
            setFocusedSeasonIndex(newIndex);
            setSelectedSeason(newIndex + 1);
            seasonRefs.current[newIndex]?.focus();
          } else if (isKey(event, TV_KEYS.RIGHT) || isKey(event, TV_KEYS.ENTER)) {
            event.preventDefault();
            setFocusArea('episodes');
            setFocusedEpisodeIndex(0);
            episodeRefs.current[0]?.focus();
          }
        } else if (focusArea === 'episodes') {
          if (isKey(event, TV_KEYS.UP)) {
            event.preventDefault();
            const newIndex = focusedEpisodeIndex > 0 ? focusedEpisodeIndex - 1 : currentEpisodes.length - 1;
            setFocusedEpisodeIndex(newIndex);
            episodeRefs.current[newIndex]?.focus();
          } else if (isKey(event, TV_KEYS.DOWN)) {
            event.preventDefault();
            const newIndex = focusedEpisodeIndex < currentEpisodes.length - 1 ? focusedEpisodeIndex + 1 : 0;
            setFocusedEpisodeIndex(newIndex);
            episodeRefs.current[newIndex]?.focus();
          } else if (isKey(event, TV_KEYS.LEFT)) {
            event.preventDefault();
            setFocusArea('seasons');
            seasonRefs.current[focusedSeasonIndex]?.focus();
          } else if (isKey(event, TV_KEYS.ENTER)) {
            const episode = currentEpisodes[focusedEpisodeIndex];
            if (episode) {
              playEpisode(episode.id, episode.container_extension, `${selectedSeries?.name} - ${episode.title}`);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, focusArea, focusedCategoryIndex, focusedSeriesIndex, focusedSeasonIndex, focusedEpisodeIndex, categories, filteredSeries, seriesInfo, currentEpisodes, selectedSeries, onBack]);

  // Player
  if (viewMode === 'playing' && playingEpisode) {
    return (
      <TizenPlayer
        src={playingEpisode.url}
        title={playingEpisode.title}
        onClose={() => {
          setPlayingEpisode(null);
          setViewMode('detail');
        }}
      />
    );
  }

  // Detail view
  if (viewMode === 'detail' && selectedSeries) {
    return (
      <div className="min-h-screen bg-oxo-dark flex">
        {/* Left - Series info */}
        <div className="w-1/3 p-8">
          <button
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 focusable p-2 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>

          {selectedSeries.cover && (
            <img
              src={selectedSeries.cover}
              alt={selectedSeries.name}
              className="w-full aspect-[2/3] object-cover rounded-xl mb-6"
            />
          )}
          
          <h1 className="text-3xl font-bold text-white mb-2">{selectedSeries.name}</h1>
          
          <div className="flex items-center gap-4 text-gray-400 mb-4">
            {selectedSeries.rating_5based > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                {selectedSeries.rating_5based.toFixed(1)}
              </span>
            )}
            {selectedSeries.release_date && (
              <span>{selectedSeries.release_date.slice(0, 4)}</span>
            )}
          </div>
          
          {selectedSeries.plot && (
            <p className="text-gray-400 text-sm line-clamp-6">{selectedSeries.plot}</p>
          )}
        </div>

        {/* Middle - Seasons */}
        <div className="w-48 bg-oxo-gray p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Saisons</h2>
          <div className="space-y-2">
            {Object.keys(seriesInfo?.episodes || {}).map((season, index) => (
              <button
                key={season}
                ref={el => { seasonRefs.current[index] = el; }}
                onClick={() => {
                  setSelectedSeason(parseInt(season));
                  setFocusedSeasonIndex(index);
                }}
                onFocus={() => {
                  setFocusArea('seasons');
                  setFocusedSeasonIndex(index);
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all focusable ${
                  selectedSeason === parseInt(season)
                    ? 'bg-oxo-red text-white'
                    : 'text-gray-400 hover:bg-white/10'
                }`}
                tabIndex={0}
              >
                Saison {season}
              </button>
            ))}
          </div>
        </div>

        {/* Right - Episodes */}
        <div className="flex-1 p-8 overflow-y-auto">
          <h2 className="text-xl font-semibold text-white mb-4">
            Saison {selectedSeason} - {currentEpisodes.length} épisodes
          </h2>
          
          <div className="space-y-3">
            {currentEpisodes.map((episode, index) => (
              <button
                key={episode.id}
                ref={el => { episodeRefs.current[index] = el; }}
                onClick={() => playEpisode(episode.id, episode.container_extension, `${selectedSeries.name} - ${episode.title}`)}
                onFocus={() => {
                  setFocusArea('episodes');
                  setFocusedEpisodeIndex(index);
                }}
                className="w-full flex items-center gap-4 p-4 bg-oxo-gray rounded-xl transition-all focusable card-hover text-left"
                tabIndex={0}
              >
                <div className="w-12 h-12 bg-oxo-red/20 rounded-lg flex items-center justify-center text-oxo-red font-bold">
                  {episode.episode_num}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{episode.title}</p>
                  {episode.info?.duration && (
                    <p className="text-gray-500 text-sm">{episode.info.duration}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-oxo-dark flex">
      {/* Sidebar - Categories */}
      <div className="w-72 bg-oxo-gray flex flex-col">
        <div className="p-6 border-b border-white/10">
          <button
            onClick={onBack}
            className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors focusable p-2 rounded-lg"
            tabIndex={0}
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-lg">Retour</span>
          </button>
          <h1 className="text-2xl font-bold text-white mt-4">Séries</h1>
          <p className="text-gray-500">{series.length} séries</p>
        </div>

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

      {/* Main content - Series */}
      <div className="flex-1 p-8 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-oxo-red animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-xl">Chargement...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-red-500 text-xl mb-4">{error}</p>
              <button
                onClick={loadData}
                className="px-6 py-3 bg-oxo-red rounded-xl text-white font-semibold focusable"
                tabIndex={0}
              >
                <RefreshCw className="w-5 h-5 inline mr-2" />
                Réessayer
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-6">
              {categories.find(c => c.category_id === selectedCategory)?.category_name || 'Toutes les séries'}
            </h2>

            <div className="grid grid-cols-6 gap-4">
              {filteredSeries.map((serie, index) => (
                <button
                  key={serie.series_id}
                  ref={el => { seriesRefs.current[index] = el; }}
                  onClick={() => loadSeriesDetail(serie)}
                  onFocus={() => {
                    setFocusArea('series');
                    setFocusedSeriesIndex(index);
                  }}
                  className="group bg-oxo-gray rounded-xl overflow-hidden transition-all focusable card-hover text-left"
                  tabIndex={0}
                >
                  <div className="aspect-[2/3] bg-black/50 relative overflow-hidden">
                    {serie.cover ? (
                      <img
                        src={serie.cover}
                        alt={serie.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl text-gray-600">📺</span>
                      </div>
                    )}
                    
                    {serie.rating_5based > 0 && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
                        <span className="text-white text-xs">{serie.rating_5based.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3">
                    <p className="text-white font-medium line-clamp-2 text-sm">{serie.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}



