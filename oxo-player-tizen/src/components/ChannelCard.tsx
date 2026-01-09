/**
 * Card pour afficher une chaîne TV, un film ou une série
 */

import { useState } from 'react';
import { Play, Star } from 'lucide-react';

interface ChannelCardProps {
  id: string | number;
  name: string;
  logo?: string;
  rating?: number;
  year?: string;
  onClick: () => void;
  onFocus?: () => void;
  size?: 'small' | 'medium' | 'large';
  showPlayIcon?: boolean;
}

export function ChannelCard({
  name,
  logo,
  rating,
  year,
  onClick,
  onFocus,
  size = 'medium',
  showPlayIcon = false,
}: ChannelCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const sizeClasses = {
    small: 'w-36 h-24',
    medium: 'w-48 h-32',
    large: 'w-64 h-40',
  };

  const posterSizeClasses = {
    small: 'w-36 h-52',
    medium: 'w-48 h-72',
    large: 'w-64 h-96',
  };

  // Détecter si c'est un poster (ratio vertical) ou un logo TV (ratio horizontal)
  const isPoster = rating !== undefined || year !== undefined;
  const cardSize = isPoster ? posterSizeClasses[size] : sizeClasses[size];

  return (
    <button
      onClick={onClick}
      onFocus={() => {
        setIsFocused(true);
        onFocus?.();
      }}
      onBlur={() => setIsFocused(false)}
      className={`relative ${cardSize} rounded-xl overflow-hidden bg-oxo-gray flex-shrink-0 card-hover focusable group`}
      tabIndex={0}
    >
      {/* Image */}
      {logo && !imageError ? (
        <img
          src={logo}
          alt={name}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900 p-4">
          <span className="text-center text-gray-400 text-sm font-medium line-clamp-3">
            {name}
          </span>
        </div>
      )}

      {/* Overlay au focus */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-opacity ${
          isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {/* Play icon */}
        {showPlayIcon && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-oxo-red flex items-center justify-center">
              <Play className="w-8 h-8 text-white ml-1" fill="white" />
            </div>
          </div>
        )}

        {/* Info en bas */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-semibold text-sm line-clamp-2 mb-1">{name}</h3>
          
          <div className="flex items-center gap-2 text-xs text-gray-300">
            {rating !== undefined && rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500" fill="currentColor" />
                {rating.toFixed(1)}
              </span>
            )}
            {year && <span>{year}</span>}
          </div>
        </div>
      </div>

      {/* Focus ring */}
      {isFocused && (
        <div className="absolute inset-0 ring-4 ring-oxo-red rounded-xl pointer-events-none" />
      )}
    </button>
  );
}



