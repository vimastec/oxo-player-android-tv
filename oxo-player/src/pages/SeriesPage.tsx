import { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowLeft, Play, Loader2, Star, StarOff } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { CategoryBar } from '../components/CategoryBar';
import { SearchBar } from '../components/SearchBar';
import { VideoPlayer } from '../components/VideoPlayer';
import xtreamApi from '../services/xtreamApi';
import type { SeriesInfo, SeriesDetails, Episode, M3UEpisode } from '../types';

// Type pour les épisodes locaux (M3U) ou API (Xtream)
type LocalOrApiEpisode = Episode | M3UEpisode;

// Helper pour obtenir les propriétés d'un épisode de manière unifiée
function getEpisodeInfo(episode: LocalOrApiEpisode) {
  // Épisode M3U local
  if ('episodeNum' in episode) {
    return {
      episodeNum: episode.episodeNum,
      title: episode.title,
      duration: undefined as string | undefined,
    };
  }
  // Épisode API Xtream
  return {
    episodeNum: episode.episode_num,
    title: episode.title,
    duration: episode.info?.duration,
  };
}

interface SeriesPageProps {
  onBack?: () => void;
}

const ITEMS_PER_PAGE = 50;

export function SeriesPage({ onBack }: SeriesPageProps) {
  const { series, seriesCategories, seriesEpisodes, searchQuery, credentials, addFavorite, removeFavorite, isFavorite } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<SeriesInfo | null>(null);
  const [seriesDetails, setSeriesDetails] = useState<SeriesDetails | null>(null);
  const [localEpisodes, setLocalEpisodes] = useState<{ [season: string]: M3UEpisode[] } | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [playingEpisode, setPlayingEpisode] = useState<LocalOrApiEpisode | null>(null);
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredSeries = useMemo(() => {
    let filtered = series;
    if (selectedCategory) {
      filtered = filtered.filter((s) => s.category_id === selectedCategory);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(query));
    }
    return filtered;
  }, [series, selectedCategory, searchQuery]);

  const totalPages = Math.ceil(filteredSeries.length / ITEMS_PER_PAGE);
  const paginatedSeries = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSeries.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSeries, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIndex(0);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    if (!selectedSeries) return;
    
    setIsLoadingDetails(true);
    setSelectedEpisodeIndex(0);
    setLocalEpisodes(null);
    setSeriesDetails(null);
    
    // 1. Vérifier d'abord si on a des épisodes locaux (parsés depuis M3U)
    const localEps = seriesEpisodes[selectedSeries.series_id];
    if (localEps && Object.keys(localEps).length > 0) {
      console.log('📺 Using local M3U episodes for series:', selectedSeries.name);
      setLocalEpisodes(localEps);
      const seasons = Object.keys(localEps).map(Number).sort((a, b) => a - b);
      if (seasons.length > 0) setSelectedSeason(seasons[0]);
      setIsLoadingDetails(false);
      return;
    }
    
    // 2. Sinon, essayer l'API Xtream si on a des credentials
    if (credentials) {
      console.log('🌐 Fetching series details from Xtream API:', selectedSeries.name);
      xtreamApi.setCredentials(credentials);
      xtreamApi.getSeriesInfo(selectedSeries.series_id)
        .then((details) => {
          setSeriesDetails(details);
          if (details.episodes) {
            const seasons = Object.keys(details.episodes).map(Number).sort((a, b) => a - b);
            if (seasons.length > 0) setSelectedSeason(seasons[0]);
          }
        })
        .catch((error) => {
          console.error('Failed to fetch series info from API:', error);
          // Si l'API échoue, on n'a pas d'épisodes
        })
        .finally(() => setIsLoadingDetails(false));
    } else {
      console.log('⚠️ No credentials and no local episodes for series:', selectedSeries.name);
      setIsLoadingDetails(false);
    }
  }, [selectedSeries, credentials, seriesEpisodes]);

  const currentEpisodes = useMemo((): LocalOrApiEpisode[] => {
    // Priorité aux épisodes locaux (M3U)
    if (localEpisodes) {
      return localEpisodes[selectedSeason.toString()] || [];
    }
    // Sinon utiliser les épisodes de l'API Xtream
    if (seriesDetails?.episodes) {
      return seriesDetails.episodes[selectedSeason.toString()] || [];
    }
    return [];
  }, [localEpisodes, seriesDetails, selectedSeason]);

  const availableSeasons = useMemo(() => {
    // Priorité aux épisodes locaux (M3U)
    if (localEpisodes) {
      return Object.keys(localEpisodes).map(Number).sort((a, b) => a - b);
    }
    // Sinon utiliser les épisodes de l'API Xtream
    if (seriesDetails?.episodes) {
      return Object.keys(seriesDetails.episodes).map(Number).sort((a, b) => a - b);
    }
    return [];
  }, [localEpisodes, seriesDetails]);

  const handleSeriesClick = useCallback((seriesItem: SeriesInfo, index: number) => {
    if (selectedIndex === index) {
      setSelectedSeries(seriesItem);
    } else {
      setSelectedIndex(index);
    }
  }, [selectedIndex]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent, seriesItem: SeriesInfo) => {
    e.stopPropagation();
    if (isFavorite(seriesItem.series_id, 'series')) {
      removeFavorite(seriesItem.series_id, 'series');
    } else {
      addFavorite({
        id: seriesItem.series_id,
        type: 'series',
        name: seriesItem.name,
        icon: seriesItem.cover || '',
        addedAt: Date.now(),
      });
    }
  }, [isFavorite, removeFavorite, addFavorite]);

  const getEpisodeUrl = useCallback((episode: LocalOrApiEpisode): string => {
    // Épisode M3U local - utiliser l'URL directe
    if ('url' in episode && episode.url) {
      return episode.url;
    }
    // Épisode API Xtream
    if ('direct_source' in episode && episode.direct_source) {
      return episode.direct_source;
    }
    if (credentials && 'id' in episode) {
      xtreamApi.setCredentials(credentials);
      return xtreamApi.getSeriesStreamUrl(parseInt(episode.id), episode.container_extension || 'mp4');
    }
    return '';
  }, [credentials]);

  // Series detail view
  if (selectedSeries) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 p-6 border-b border-oxo-border">
          <button onClick={() => { setSelectedSeries(null); setSeriesDetails(null); }}
            className="flex items-center gap-2 text-oxo-muted hover:text-white transition-colors mb-4 tv-focusable">
            <ArrowLeft className="w-5 h-5" />
            Retour aux séries
          </button>
          <div className="flex gap-6">
            <div className="flex-shrink-0 w-48 rounded-xl overflow-hidden">
              {selectedSeries.cover ? (
                <img src={selectedSeries.cover} alt={selectedSeries.name} className="w-full h-auto object-cover" />
              ) : (
                <div className="w-full aspect-[2/3] bg-oxo-card flex items-center justify-center"><span className="text-4xl">📺</span></div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="font-display text-3xl font-bold mb-2">{selectedSeries.name}</h1>
              {selectedSeries.genre && <p className="text-oxo-primary mb-2">{selectedSeries.genre}</p>}
              {selectedSeries.rating && <p className="text-yellow-400 mb-4">★ {selectedSeries.rating}</p>}
              {selectedSeries.plot && <p className="text-oxo-muted line-clamp-4">{selectedSeries.plot}</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
          {isLoadingDetails ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-10 h-10 text-oxo-primary animate-spin" />
            </div>
          ) : (
            <>
              {availableSeasons.length > 0 && (
                <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
                  {availableSeasons.map((season) => (
                    <button key={season} onClick={() => { setSelectedSeason(season); setSelectedEpisodeIndex(0); }}
                      className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors tv-focusable ${
                        selectedSeason === season ? 'bg-oxo-primary text-white' : 'bg-oxo-card hover:bg-oxo-border'
                      }`}>
                      Saison {season}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentEpisodes.map((episode, index) => {
                  const isSelected = index === selectedEpisodeIndex;
                  const epInfo = getEpisodeInfo(episode);
                  return (
                    <button
                      key={episode.id}
                      type="button"
                      tabIndex={0}
                      data-tv-auto-focus={index === 0 ? 'true' : undefined}
                      onFocus={() => setSelectedEpisodeIndex(index)}
                      onClick={() => {
                        if (isSelected) setPlayingEpisode(episode);
                        else setSelectedEpisodeIndex(index);
                      }}
                      className={`bg-oxo-card border rounded-xl p-4 cursor-pointer transition-all text-left
                        ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-500/10' : 'border-oxo-border hover:border-oxo-primary'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors
                          ${isSelected ? 'bg-oxo-primary' : 'bg-oxo-darker'}`}>
                          <Play className="w-6 h-6" fill={isSelected ? 'white' : 'currentColor'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">Épisode {epInfo.episodeNum}</h4>
                          <p className="text-sm text-oxo-muted truncate">{epInfo.title || `Épisode ${epInfo.episodeNum}`}</p>
                          {epInfo.duration && <p className="text-xs text-oxo-muted mt-1">{epInfo.duration}</p>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {currentEpisodes.length === 0 && (
                <div className="text-center py-12"><p className="text-oxo-muted">Aucun épisode disponible pour cette saison</p></div>
              )}
            </>
          )}
        </div>

        {playingEpisode && selectedSeries && (
          <VideoPlayer
            src={getEpisodeUrl(playingEpisode)}
            streamId={parseInt(playingEpisode.id)}
            streamType="series"
            title={`${selectedSeries.name} - S${selectedSeason}E${getEpisodeInfo(playingEpisode).episodeNum}`}
            onClose={() => setPlayingEpisode(null)}
          />
        )}
      </div>
    );
  }

  // Series list view
  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 p-6 border-b border-oxo-border">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-oxo-muted hover:text-white transition-colors mb-4 tv-focusable">
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>
        )}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold mb-1">Séries</h1>
            <p className="text-oxo-muted">
              {filteredSeries.length} séries disponibles
              {totalPages > 1 && ` • Page ${currentPage}/${totalPages}`}
            </p>
          </div>
          <div className="lg:w-96"><SearchBar /></div>
        </div>
        <CategoryBar categories={seriesCategories} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
        {paginatedSeries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-oxo-card flex items-center justify-center mb-4"><span className="text-4xl">📺</span></div>
            <h3 className="text-xl font-semibold mb-2">Aucune série trouvée</h3>
            <p className="text-oxo-muted">{searchQuery ? 'Essayez avec d\'autres mots-clés' : 'Aucune série dans cette catégorie'}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {paginatedSeries.map((seriesItem, index) => {
                const isSelected = index === selectedIndex;
                const isFav = isFavorite(seriesItem.series_id, 'series');
                return (
                  <button
                    key={seriesItem.series_id}
                    type="button"
                    tabIndex={0}
                    data-tv-auto-focus={index === 0 ? 'true' : undefined}
                    onFocus={() => setSelectedIndex(index)}
                    onClick={() => handleSeriesClick(seriesItem, index)}
                    className={`group relative bg-oxo-card rounded-xl overflow-hidden border cursor-pointer transition-all duration-200 text-left
                      ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 scale-105 z-10' : 'border-oxo-border hover:border-oxo-primary'}`}>
                    <div className="aspect-[2/3] bg-oxo-darker relative overflow-hidden">
                      {seriesItem.cover ? (
                        <img src={seriesItem.cover} alt={seriesItem.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-oxo-card to-oxo-darker">
                          <span className="text-4xl">📺</span>
                        </div>
                      )}
                      <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300
                        ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <div className="p-4 rounded-full bg-oxo-primary"><Play className="w-8 h-8" fill="white" /></div>
                      </div>
                      {seriesItem.rating && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500/90 rounded text-xs font-bold text-black">★ {seriesItem.rating}</div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm line-clamp-2 flex-1">{seriesItem.name}</h3>
                        <button onClick={(e) => handleToggleFavorite(e, seriesItem)} className="p-1 rounded-lg hover:bg-oxo-border transition-colors flex-shrink-0">
                          {isFav ? <Star className="w-4 h-4 text-yellow-400" fill="currentColor" /> : <StarOff className="w-4 h-4 text-oxo-muted" />}
                        </button>
                      </div>
                      {seriesItem.genre && <p className="text-xs text-oxo-muted mt-1 truncate">{seriesItem.genre}</p>}
                    </div>
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); setSelectedIndex(0); }}
                  disabled={currentPage === 1} className="px-4 py-2 bg-oxo-card rounded-lg disabled:opacity-50 hover:bg-oxo-border transition-colors tv-focusable">
                  ← Précédent
                </button>
                <span className="px-4 py-2 text-oxo-muted">{currentPage} / {totalPages}</span>
                <button onClick={() => { setCurrentPage(prev => Math.min(totalPages, prev + 1)); setSelectedIndex(0); }}
                  disabled={currentPage === totalPages} className="px-4 py-2 bg-oxo-card rounded-lg disabled:opacity-50 hover:bg-oxo-border transition-colors tv-focusable">
                  Suivant →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
