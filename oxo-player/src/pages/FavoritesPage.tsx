import { useState } from 'react';
import { Star, Tv, Film, MonitorPlay, Trash2 } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { VideoPlayer } from '../components/VideoPlayer';
import xtreamApi from '../services/xtreamApi';
import type { Favorite } from '../types';

type FilterType = 'all' | 'live' | 'movie' | 'series';

export function FavoritesPage() {
  const { favorites, removeFavorite, movies, credentials } = useAppStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [playingItem, setPlayingItem] = useState<{
    src: string;
    streamId: number;
    streamType: 'live' | 'movie' | 'series';
    title: string;
    poster?: string;
  } | null>(null);

  const filteredFavorites = filter === 'all'
    ? favorites
    : favorites.filter((f) => f.type === filter);

  const handlePlay = (fav: Favorite) => {
    if (!credentials) return;
    xtreamApi.setCredentials(credentials);

    let src = '';
    if (fav.type === 'live') {
      src = xtreamApi.getLiveStreamUrl(fav.id);
    } else if (fav.type === 'movie') {
      const movie = movies.find((m) => m.stream_id === fav.id);
      src = xtreamApi.getVodStreamUrl(fav.id, movie?.container_extension || 'mp4');
    }

    if (src) {
      setPlayingItem({
        src,
        streamId: fav.id,
        streamType: fav.type,
        title: fav.name,
        poster: fav.icon,
      });
    }
  };

  const getTypeIcon = (type: 'live' | 'movie' | 'series') => {
    switch (type) {
      case 'live':
        return <Tv className="w-4 h-4" />;
      case 'movie':
        return <Film className="w-4 h-4" />;
      case 'series':
        return <MonitorPlay className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: 'live' | 'movie' | 'series') => {
    switch (type) {
      case 'live':
        return 'Chaîne';
      case 'movie':
        return 'Film';
      case 'series':
        return 'Série';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-oxo-border">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Star className="w-6 h-6 text-yellow-400" fill="currentColor" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Favoris</h1>
            <p className="text-oxo-muted">
              {favorites.length} élément{favorites.length > 1 ? 's' : ''} enregistré{favorites.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {[
            { id: 'all', label: 'Tout' },
            { id: 'live', label: 'Chaînes' },
            { id: 'movie', label: 'Films' },
            { id: 'series', label: 'Séries' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as FilterType)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === tab.id
                  ? 'bg-oxo-primary text-white'
                  : 'bg-oxo-card hover:bg-oxo-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-6">
        {filteredFavorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-oxo-card flex items-center justify-center mb-4">
              <Star className="w-10 h-10 text-oxo-muted" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Aucun favori</h3>
            <p className="text-oxo-muted max-w-md">
              {filter === 'all'
                ? 'Ajoutez des chaînes, films ou séries à vos favoris pour y accéder rapidement'
                : `Aucun ${filter === 'live' ? 'chaîne' : filter === 'movie' ? 'film' : 'série'} dans vos favoris`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFavorites.map((fav) => (
              <div
                key={`${fav.type}-${fav.id}`}
                className="bg-oxo-card border border-oxo-border rounded-xl overflow-hidden
                  hover:border-oxo-primary transition-colors group"
              >
                {/* Image */}
                <div
                  onClick={() => handlePlay(fav)}
                  className="aspect-video bg-oxo-darker relative cursor-pointer overflow-hidden"
                >
                  {fav.icon ? (
                    <img
                      src={fav.icon}
                      alt={fav.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl font-bold text-oxo-muted/30">
                        {fav.name.charAt(0)}
                      </span>
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded flex items-center gap-1.5 text-xs">
                    {getTypeIcon(fav.type)}
                    <span>{getTypeLabel(fav.type)}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex items-center justify-between gap-2">
                  <h3 className="font-medium truncate flex-1">{fav.name}</h3>
                  <button
                    onClick={() => removeFavorite(fav.id, fav.type)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Supprimer des favoris"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Video Player */}
      {playingItem && (
        <VideoPlayer
          src={playingItem.src}
          streamId={playingItem.streamId}
          streamType={playingItem.streamType}
          title={playingItem.title}
          poster={playingItem.poster}
          onClose={() => setPlayingItem(null)}
        />
      )}
    </div>
  );
}




