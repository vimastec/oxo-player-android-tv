import { Search, X } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

export function SearchBar() {
  const { searchQuery, setSearchQuery } = useAppStore();

  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-oxo-muted" />
      <input
        type="text"
        placeholder="Rechercher chaînes, films, séries..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-12 pr-12 py-3 bg-oxo-card border border-oxo-border rounded-xl
          text-white placeholder-oxo-muted focus:outline-none focus:border-oxo-primary
          transition-colors"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full
            hover:bg-oxo-border transition-colors"
        >
          <X className="w-4 h-4 text-oxo-muted" />
        </button>
      )}
    </div>
  );
}


























