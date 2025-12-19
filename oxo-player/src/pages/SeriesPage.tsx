import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Play, Loader2 } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { CategoryBar } from '../components/CategoryBar';
import { ChannelCard } from '../components/ChannelCard';
import { SearchBar } from '../components/SearchBar';
import { VideoPlayer } from '../components/VideoPlayer';
import xtreamApi from '../services/xtreamApi';
import type { SeriesInfo, SeriesDetails, Episode } from '../types';

interface SeriesPageProps {
  onBack?: () => void;
}

export function SeriesPage({ onBack }: SeriesPageProps) {
  const { series, seriesCategories, searchQuery, credentials } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<SeriesInfo | null>(null);
  const [seriesDetails, setSeriesDetails] = useState<SeriesDetails | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [playingEpisode, setPlayingEpisode] = useState<Episode | null>(null);

  const filteredSeries = useMemo(() => {
    let filtered = series;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((s) => s.category_id === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((s) =>
        s.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [series, selectedCategory, searchQuery]);

  // Load series details when a series is selected
  useEffect(() => {
    if (selectedSeries && credentials) {
      setIsLoadingDetails(true);
      xtreamApi.setCredentials(credentials);
      xtreamApi.getSeriesInfo(selectedSeries.series_id)
        .then((details) => {
          setSeriesDetails(details);
          // Set first available season
          if (details.episodes) {
            const seasons = Object.keys(details.episodes).map(Number).sort((a, b) => a - b);
            if (seasons.length > 0) {
              setSelectedSeason(seasons[0]);
            }
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingDetails(false));
    }
  }, [selectedSeries, credentials]);

  const handleSeriesClick = (seriesItem: SeriesInfo) => {
    setSelectedSeries(seriesItem);
    setSeriesDetails(null);
  };

  const handleBackToList = () => {
    setSelectedSeries(null);
    setSeriesDetails(null);
  };

  const getEpisodeUrl = (episode: Episode): string => {
    if (credentials) {
      xtreamApi.setCredentials(credentials);
      return xtreamApi.getSeriesStreamUrl(
        parseInt(episode.id),
        episode.container_extension || 'mp4'
      );
    }
    return '';
  };

  const currentEpisodes = useMemo(() => {
    if (!seriesDetails?.episodes) return [];
    return seriesDetails.episodes[selectedSeason.toString()] || [];
  }, [seriesDetails, selectedSeason]);

  const availableSeasons = useMemo(() => {
    if (!seriesDetails?.episodes) return [];
    return Object.keys(seriesDetails.episodes).map(Number).sort((a, b) => a - b);
  }, [seriesDetails]);

  // Series detail view
  if (selectedSeries) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with back button */}
        <div className="flex-shrink-0 p-6 border-b border-oxo-border">
          <button
            onClick={handleBackToList}
            className="flex items-center gap-2 text-oxo-muted hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour aux séries
          </button>

          {/* Series info */}
          <div className="flex gap-6">
            {/* Poster */}
            <div className="flex-shrink-0 w-48 rounded-xl overflow-hidden">
              {selectedSeries.cover ? (
                <img
                  src={selectedSeries.cover}
                  alt={selectedSeries.name}
                  className="w-full h-auto object-cover"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-oxo-card flex items-center justify-center">
                  <span className="text-4xl">📺</span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1">
              <h1 className="font-display text-3xl font-bold mb-2">
                {selectedSeries.name}
              </h1>
              {selectedSeries.genre && (
                <p className="text-oxo-primary mb-2">{selectedSeries.genre}</p>
              )}
              {selectedSeries.rating && (
                <p className="text-yellow-400 mb-4">★ {selectedSeries.rating}</p>
              )}
              {selectedSeries.plot && (
                <p className="text-oxo-muted line-clamp-4">{selectedSeries.plot}</p>
              )}
            </div>
          </div>
        </div>

        {/* Episodes */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
          {isLoadingDetails ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-10 h-10 text-oxo-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* Season selector */}
              {availableSeasons.length > 0 && (
                <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
                  {availableSeasons.map((season) => (
                    <button
                      key={season}
                      onClick={() => setSelectedSeason(season)}
                      className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                        selectedSeason === season
                          ? 'bg-oxo-primary text-white'
                          : 'bg-oxo-card hover:bg-oxo-border'
                      }`}
                    >
                      Saison {season}
                    </button>
                  ))}
                </div>
              )}

              {/* Episodes grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentEpisodes.map((episode) => (
                  <div
                    key={episode.id}
                    onClick={() => setPlayingEpisode(episode)}
                    className="bg-oxo-card border border-oxo-border rounded-xl p-4 
                      hover:border-oxo-primary cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-oxo-darker flex items-center justify-center
                        group-hover:bg-oxo-primary transition-colors">
                        <Play className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">
                          Épisode {episode.episode_num}
                        </h4>
                        <p className="text-sm text-oxo-muted truncate">
                          {episode.title || `Épisode ${episode.episode_num}`}
                        </p>
                        {episode.info?.duration && (
                          <p className="text-xs text-oxo-muted mt-1">
                            {episode.info.duration}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {currentEpisodes.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-oxo-muted">Aucun épisode disponible pour cette saison</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Video Player */}
        {playingEpisode && selectedSeries && (
          <VideoPlayer
            src={getEpisodeUrl(playingEpisode)}
            streamId={parseInt(playingEpisode.id)}
            streamType="series"
            title={`${selectedSeries.name} - S${selectedSeason}E${playingEpisode.episode_num}`}
            onClose={() => setPlayingEpisode(null)}
            episodeInfo={{
              seriesId: selectedSeries.series_id,
              seasonNum: selectedSeason,
              episodeNum: playingEpisode.episode_num,
            }}
          />
        )}
      </div>
    );
  }

  // Series list view
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-oxo-border">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-oxo-muted hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>
        )}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold mb-1">Séries</h1>
            <p className="text-oxo-muted">
              {filteredSeries.length} séries disponibles
            </p>
          </div>
          <div className="lg:w-96">
            <SearchBar />
          </div>
        </div>

        <CategoryBar
          categories={seriesCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </div>

      {/* Content grid */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
        {filteredSeries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-oxo-card flex items-center justify-center mb-4">
              <span className="text-4xl">📺</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Aucune série trouvée</h3>
            <p className="text-oxo-muted">
              {searchQuery
                ? 'Essayez avec d\'autres mots-clés'
                : 'Aucune série dans cette catégorie'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredSeries.map((seriesItem) => (
              <ChannelCard
                key={seriesItem.series_id}
                item={seriesItem}
                type="series"
                onClick={() => handleSeriesClick(seriesItem)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

