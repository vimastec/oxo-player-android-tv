import { useState, useMemo, useCallback, useEffect } from 'react';
import { ArrowLeft, Play, Star, StarOff } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { CategoryBar } from '../components/CategoryBar';
import { SearchBar } from '../components/SearchBar';
import { VideoPlayer } from '../components/VideoPlayer';
import xtreamApi from '../services/xtreamApi';
import type { VODInfo } from '../types';

interface MoviesPageProps {
  onBack?: () => void;
}

// Pagination pour les grosses listes
const ITEMS_PER_PAGE = 50;

export function MoviesPage({ onBack }: MoviesPageProps) {
  const { movies, vodCategories, searchQuery, credentials, addFavorite, removeFavorite, isFavorite } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [playingMovie, setPlayingMovie] = useState<VODInfo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredMovies = useMemo(() => {
    let filtered = movies;

    if (selectedCategory) {
      filtered = filtered.filter((m) => m.category_id === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((m) => m.name.toLowerCase().includes(query));
    }

    return filtered;
  }, [movies, selectedCategory, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredMovies.length / ITEMS_PER_PAGE);
  const paginatedMovies = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMovies.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMovies, currentPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIndex(0);
  }, [selectedCategory, searchQuery]);

  const handleMovieClick = useCallback((movie: VODInfo, index: number) => {
    if (selectedIndex === index) {
      setPlayingMovie(movie);
    } else {
      setSelectedIndex(index);
    }
  }, [selectedIndex]);

  const handleToggleFavorite = useCallback((e: React.MouseEvent, movie: VODInfo) => {
    e.stopPropagation();
    if (isFavorite(movie.stream_id, 'movie')) {
      removeFavorite(movie.stream_id, 'movie');
    } else {
      addFavorite({
        id: movie.stream_id,
        type: 'movie',
        name: movie.name,
        icon: movie.stream_icon || '',
        addedAt: Date.now(),
      });
    }
  }, [isFavorite, removeFavorite, addFavorite]);

  const getStreamUrl = useCallback((movie: VODInfo): string => {
    if (movie.direct_source) {
      return movie.direct_source;
    }
    if (credentials) {
      xtreamApi.setCredentials(credentials);
      return xtreamApi.getVodStreamUrl(movie.stream_id, movie.container_extension || 'mp4');
    }
    return '';
  }, [credentials]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-oxo-border">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-oxo-muted hover:text-white transition-colors mb-4 tv-focusable">
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>
        )}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold mb-1">Films</h1>
            <p className="text-oxo-muted">
              {filteredMovies.length} films disponibles
              {totalPages > 1 && ` • Page ${currentPage}/${totalPages}`}
            </p>
          </div>
          <div className="lg:w-96">
            <SearchBar />
          </div>
        </div>

        <CategoryBar
          categories={vodCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
      </div>

      {/* Content grid */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
        {paginatedMovies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-oxo-card flex items-center justify-center mb-4">
              <span className="text-4xl">🎬</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Aucun film trouvé</h3>
            <p className="text-oxo-muted">
              {searchQuery ? 'Essayez avec d\'autres mots-clés' : 'Aucun film dans cette catégorie'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {paginatedMovies.map((movie, index) => {
                const isSelected = index === selectedIndex;
                const isFav = isFavorite(movie.stream_id, 'movie');

                return (
                  <button
                    key={movie.stream_id}
                    type="button"
                    onClick={() => handleMovieClick(movie, index)}
                    onFocus={() => setSelectedIndex(index)}
                    tabIndex={0}
                    data-tv-auto-focus={index === 0 ? 'true' : undefined}
                    className={`group relative bg-oxo-card rounded-xl overflow-hidden 
                      border cursor-pointer transition-all duration-200 text-left
                      ${isSelected 
                        ? 'border-blue-500 ring-2 ring-blue-500 scale-105 z-10' 
                        : 'border-oxo-border hover:border-oxo-primary'
                      }`}
                  >
                    {/* Image */}
                    <div className="aspect-[2/3] bg-oxo-darker relative overflow-hidden">
                      {movie.stream_icon ? (
                        <img
                          src={movie.stream_icon}
                          alt={movie.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-oxo-card to-oxo-darker">
                          <span className="text-4xl font-bold text-oxo-muted/30">{movie.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300
                        ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <div className="p-4 rounded-full bg-oxo-primary">
                          <Play className="w-8 h-8" fill="white" />
                        </div>
                      </div>

                      {/* Rating */}
                      {movie.rating && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500/90 rounded text-xs font-bold text-black">
                          ★ {movie.rating}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium text-sm line-clamp-2 flex-1">{movie.name}</h3>
                        <button
                          onClick={(e) => handleToggleFavorite(e, movie)}
                          className="p-1 rounded-lg hover:bg-oxo-border transition-colors flex-shrink-0"
                          type="button"
                        >
                          {isFav ? (
                            <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                          ) : (
                            <StarOff className="w-4 h-4 text-oxo-muted" />
                          )}
                        </button>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); setSelectedIndex(0); }}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-oxo-card rounded-lg disabled:opacity-50 hover:bg-oxo-border transition-colors tv-focusable"
                >
                  ← Précédent
                </button>
                <span className="px-4 py-2 text-oxo-muted">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => { setCurrentPage(prev => Math.min(totalPages, prev + 1)); setSelectedIndex(0); }}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-oxo-card rounded-lg disabled:opacity-50 hover:bg-oxo-border transition-colors tv-focusable"
                >
                  Suivant →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Video Player Modal */}
      {playingMovie && (
        <VideoPlayer
          src={getStreamUrl(playingMovie)}
          streamId={playingMovie.stream_id}
          streamType="movie"
          title={playingMovie.name}
          poster={playingMovie.stream_icon}
          onClose={() => setPlayingMovie(null)}
        />
      )}
    </div>
  );
}
