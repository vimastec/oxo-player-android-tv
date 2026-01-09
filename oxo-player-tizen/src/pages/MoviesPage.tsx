/**
 * Page Films (VOD)
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Play, Star } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { TizenPlayer } from '../components/TizenPlayer';
import { TV_KEYS, isKey } from '../utils/tvNavigation';
import { getXtreamClient, initXtreamClient, type XtreamMovie, type XtreamCategory } from '../services/xtreamApi';

interface MoviesPageProps {
  onBack: () => void;
}

export function MoviesPage({ onBack }: MoviesPageProps) {
  const { xtreamCredentials, playlistType } = useAppStore();
  
  const [categories, setCategories] = useState<XtreamCategory[]>([]);
  const [movies, setMovies] = useState<XtreamMovie[]>([]);
  const [filteredMovies, setFilteredMovies] = useState<XtreamMovie[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Player state
  const [playingMovie, setPlayingMovie] = useState<XtreamMovie | null>(null);
  
  // Focus state
  const [focusArea, setFocusArea] = useState<'categories' | 'movies'>('categories');
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState(0);
  const [focusedMovieIndex, setFocusedMovieIndex] = useState(0);
  
  const categoryRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const movieRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

      const [cats, vods] = await Promise.all([
        client.getVodCategories(),
        client.getVodStreams(),
      ]);

      setCategories(cats);
      setMovies(vods);
      setFilteredMovies(vods);
      
      if (cats.length > 0) {
        setSelectedCategory(cats[0].category_id);
      }
    } catch (err) {
      console.error('Failed to load movies:', err);
      setError('Impossible de charger les films');
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
      const filtered = movies.filter(m => m.category_id === selectedCategory);
      setFilteredMovies(filtered);
      setFocusedMovieIndex(0);
    } else {
      setFilteredMovies(movies);
    }
  }, [selectedCategory, movies]);

  // Focus initial
  useEffect(() => {
    if (!isLoading && categories.length > 0) {
      categoryRefs.current[0]?.focus();
    }
  }, [isLoading, categories]);

  // Lancer un film
  const playMovie = (movie: XtreamMovie) => {
    setPlayingMovie(movie);
  };

  // Keyboard navigation
  useEffect(() => {
    if (playingMovie) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKey(event, TV_KEYS.BACK)) {
        event.preventDefault();
        if (focusArea === 'movies') {
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
          setFocusArea('movies');
          movieRefs.current[0]?.focus();
        }
      } else {
        const cols = 6;
        const totalMovies = filteredMovies.length;
        
        if (isKey(event, TV_KEYS.UP)) {
          event.preventDefault();
          const newIndex = focusedMovieIndex >= cols ? focusedMovieIndex - cols : focusedMovieIndex;
          setFocusedMovieIndex(newIndex);
          movieRefs.current[newIndex]?.focus();
        } else if (isKey(event, TV_KEYS.DOWN)) {
          event.preventDefault();
          const newIndex = focusedMovieIndex + cols < totalMovies ? focusedMovieIndex + cols : focusedMovieIndex;
          setFocusedMovieIndex(newIndex);
          movieRefs.current[newIndex]?.focus();
        } else if (isKey(event, TV_KEYS.LEFT)) {
          event.preventDefault();
          if (focusedMovieIndex % cols === 0) {
            setFocusArea('categories');
            categoryRefs.current[focusedCategoryIndex]?.focus();
          } else {
            const newIndex = focusedMovieIndex - 1;
            setFocusedMovieIndex(newIndex);
            movieRefs.current[newIndex]?.focus();
          }
        } else if (isKey(event, TV_KEYS.RIGHT)) {
          event.preventDefault();
          if ((focusedMovieIndex + 1) % cols !== 0 && focusedMovieIndex < totalMovies - 1) {
            const newIndex = focusedMovieIndex + 1;
            setFocusedMovieIndex(newIndex);
            movieRefs.current[newIndex]?.focus();
          }
        } else if (isKey(event, TV_KEYS.ENTER)) {
          const movie = filteredMovies[focusedMovieIndex];
          if (movie) {
            playMovie(movie);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusArea, focusedCategoryIndex, focusedMovieIndex, categories, filteredMovies, onBack, playingMovie]);

  // Player
  if (playingMovie) {
    const client = getXtreamClient();
    const streamUrl = client?.getVodStreamUrl(playingMovie.stream_id, playingMovie.container_extension) || '';
    
    return (
      <TizenPlayer
        src={streamUrl}
        title={playingMovie.name}
        onClose={() => setPlayingMovie(null)}
      />
    );
  }

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
          <h1 className="text-2xl font-bold text-white mt-4">Films</h1>
          <p className="text-gray-500">{movies.length} films</p>
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

      {/* Main content - Movies */}
      <div className="flex-1 p-8 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-oxo-red animate-spin mx-auto mb-4" />
              <p className="text-gray-400 text-xl">Chargement des films...</p>
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
            <h2 className="text-2xl font-bold text-white mb-6">
              {categories.find(c => c.category_id === selectedCategory)?.category_name || 'Tous les films'}
            </h2>

            {/* Movies grid */}
            <div className="grid grid-cols-6 gap-4">
              {filteredMovies.map((movie, index) => (
                <button
                  key={movie.stream_id}
                  ref={el => { movieRefs.current[index] = el; }}
                  onClick={() => playMovie(movie)}
                  onFocus={() => {
                    setFocusArea('movies');
                    setFocusedMovieIndex(index);
                  }}
                  className="group bg-oxo-gray rounded-xl overflow-hidden transition-all focusable card-hover text-left"
                  tabIndex={0}
                >
                  {/* Poster */}
                  <div className="aspect-[2/3] bg-black/50 relative overflow-hidden">
                    {movie.stream_icon ? (
                      <img
                        src={movie.stream_icon}
                        alt={movie.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '';
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl text-gray-600">🎬</span>
                      </div>
                    )}
                    
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-focus:opacity-100 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-oxo-red flex items-center justify-center">
                        <Play className="w-8 h-8 text-white ml-1" fill="white" />
                      </div>
                    </div>

                    {/* Rating badge */}
                    {movie.rating_5based > 0 && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
                        <span className="text-white text-xs">{movie.rating_5based.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-3">
                    <p className="text-white font-medium line-clamp-2 text-sm">
                      {movie.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {filteredMovies.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-500 text-xl">Aucun film dans cette catégorie</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

