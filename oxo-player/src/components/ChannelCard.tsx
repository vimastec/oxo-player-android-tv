import { Play, Star, StarOff } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import type { LiveChannel, VODInfo, SeriesInfo } from '../types';

interface ChannelCardProps {
  item: LiveChannel | VODInfo | SeriesInfo;
  type: 'live' | 'movie' | 'series';
  onClick: () => void;
}

export function ChannelCard({ item, type, onClick }: ChannelCardProps) {
  const { addFavorite, removeFavorite, isFavorite } = useAppStore();

  const id = 'stream_id' in item ? item.stream_id : (item as SeriesInfo).series_id;
  const name = item.name;
  const image = 'stream_icon' in item ? item.stream_icon : (item as SeriesInfo).cover;
  const isFav = isFavorite(id, type);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFav) {
      removeFavorite(id, type);
    } else {
      addFavorite({
        id,
        type,
        name,
        icon: image || '',
        addedAt: Date.now(),
      });
    }
  };

  return (
    <div
      onClick={onClick}
      className="group relative bg-oxo-card rounded-xl overflow-hidden 
        border border-oxo-border card-hover cursor-pointer tv-focusable"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Image */}
      <div className="aspect-video bg-oxo-darker relative overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-oxo-card to-oxo-darker">
            <span className="text-4xl font-bold text-oxo-muted/30">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 
          transition-opacity duration-300 flex items-center justify-center">
          <div className="p-4 rounded-full bg-oxo-primary animate-scale-in">
            <Play className="w-8 h-8" fill="white" />
          </div>
        </div>

        {/* Live badge */}
        {type === 'live' && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-red-600 rounded text-xs font-medium">
            LIVE
          </div>
        )}

        {/* Rating for movies/series */}
        {'rating' in item && item.rating && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500/90 rounded text-xs font-bold text-black">
            ★ {item.rating}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm line-clamp-2 flex-1">{name}</h3>
          <button
            onClick={handleFavoriteClick}
            className="p-1.5 rounded-lg hover:bg-oxo-border transition-colors flex-shrink-0"
          >
            {isFav ? (
              <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
            ) : (
              <StarOff className="w-5 h-5 text-oxo-muted" />
            )}
          </button>
        </div>

        {/* Extra info for series */}
        {'genre' in item && (item as SeriesInfo).genre && (
          <p className="text-xs text-oxo-muted mt-1 truncate">
            {(item as SeriesInfo).genre}
          </p>
        )}
      </div>
    </div>
  );
}




























