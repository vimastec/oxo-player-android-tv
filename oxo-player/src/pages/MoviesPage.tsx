import { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { CategoryBar } from '../components/CategoryBar';
import { ChannelCard } from '../components/ChannelCard';
import { SearchBar } from '../components/SearchBar';
import { VideoPlayer } from '../components/VideoPlayer';
import xtreamApi from '../services/xtreamApi';
import type { VODInfo } from '../types';

interface MoviesPageProps {
  onBack?: () => void;
}

export function MoviesPage({ onBack }: MoviesPageProps) {
  const { movies, vodCategories, searchQuery, credentials } = useAppStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [playingMovie, setPlayingMovie] = useState<VODInfo | null>(null);

  const filteredMovies = useMemo(() => {
    let filtered = movies;

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((m) => m.category_id === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((m) =>
        m.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [movies, selectedCategory, searchQuery]);

  const handleMovieClick = (movie: VODInfo) => {
    setPlayingMovie(movie);
  };

  const getStreamUrl = (movie: VODInfo): string => {
    if (credentials) {
      xtreamApi.setCredentials(credentials);
      return xtreamApi.getVodStreamUrl(movie.stream_id, movie.container_extension || 'mp4');
    }
    return '';
  };

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
            <h1 className="font-display text-2xl font-bold mb-1">Films</h1>
            <p className="text-oxo-muted">
              {filteredMovies.length} films disponibles
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
        {filteredMovies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-oxo-card flex items-center justify-center mb-4">
              <span className="text-4xl">🎬</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Aucun film trouvé</h3>
            <p className="text-oxo-muted">
              {searchQuery
                ? 'Essayez avec d\'autres mots-clés'
                : 'Aucun film dans cette catégorie'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredMovies.map((movie) => (
              <ChannelCard
                key={movie.stream_id}
                item={movie}
                type="movie"
                onClick={() => handleMovieClick(movie)}
              />
            ))}
          </div>
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

