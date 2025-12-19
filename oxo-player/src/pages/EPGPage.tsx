import { useState, useEffect, useMemo } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import xtreamApi from '../services/xtreamApi';
import type { LiveChannel, EPGEntry } from '../types';

export function EPGPage() {
  const { liveChannels, credentials } = useAppStore();
  const [selectedChannel, setSelectedChannel] = useState<LiveChannel | null>(null);
  const [epgData, setEpgData] = useState<EPGEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load EPG when channel is selected
  useEffect(() => {
    if (selectedChannel && credentials) {
      setIsLoading(true);
      xtreamApi.setCredentials(credentials);
      xtreamApi.getEPG(selectedChannel.stream_id)
        .then((data) => {
          setEpgData(data.epg_listings || []);
        })
        .catch((err) => {
          console.error('EPG error:', err);
          setEpgData([]);
        })
        .finally(() => setIsLoading(false));
    }
  }, [selectedChannel, credentials]);

  // Select first channel by default
  useEffect(() => {
    if (liveChannels.length > 0 && !selectedChannel) {
      setSelectedChannel(liveChannels[0]);
    }
  }, [liveChannels, selectedChannel]);

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isCurrentProgram = (entry: EPGEntry): boolean => {
    const now = currentTime.getTime() / 1000;
    return entry.start_timestamp <= now && entry.stop_timestamp >= now;
  };

  const isPastProgram = (entry: EPGEntry): boolean => {
    const now = currentTime.getTime() / 1000;
    return entry.stop_timestamp < now;
  };

  const getProgress = (entry: EPGEntry): number => {
    const now = currentTime.getTime() / 1000;
    const duration = entry.stop_timestamp - entry.start_timestamp;
    const elapsed = now - entry.start_timestamp;
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
  };

  return (
    <div className="h-full flex">
      {/* Channel list */}
      <div className="w-80 flex-shrink-0 border-r border-oxo-border overflow-y-auto scrollbar-hide">
        <div className="p-4 border-b border-oxo-border sticky top-0 bg-oxo-dark z-10">
          <h2 className="font-display text-lg font-bold">Chaînes</h2>
          <p className="text-sm text-oxo-muted">{liveChannels.length} chaînes</p>
        </div>
        <div className="p-2">
          {liveChannels.map((channel) => (
            <button
              key={channel.stream_id}
              onClick={() => setSelectedChannel(channel)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                selectedChannel?.stream_id === channel.stream_id
                  ? 'bg-oxo-primary text-white'
                  : 'hover:bg-oxo-card'
              }`}
            >
              {channel.stream_icon ? (
                <img
                  src={channel.stream_icon}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover bg-oxo-card"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-oxo-card flex items-center justify-center">
                  <span className="text-lg">{channel.name.charAt(0)}</span>
                </div>
              )}
              <span className="flex-1 text-left truncate text-sm font-medium">
                {channel.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* EPG content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {selectedChannel && (
          <>
            {/* Channel header */}
            <div className="p-6 border-b border-oxo-border sticky top-0 bg-oxo-dark z-10">
              <div className="flex items-center gap-4">
                {selectedChannel.stream_icon && (
                  <img
                    src={selectedChannel.stream_icon}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                )}
                <div>
                  <h1 className="font-display text-2xl font-bold">
                    {selectedChannel.name}
                  </h1>
                  <p className="text-oxo-muted flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {currentTime.toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* EPG list */}
            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-10 h-10 text-oxo-primary animate-spin" />
                </div>
              ) : epgData.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-oxo-card flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-oxo-muted" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Aucun programme disponible
                  </h3>
                  <p className="text-oxo-muted">
                    Le guide des programmes n'est pas disponible pour cette chaîne
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {epgData.map((entry, index) => {
                    const isCurrent = isCurrentProgram(entry);
                    const isPast = isPastProgram(entry);

                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-xl border transition-colors ${
                          isCurrent
                            ? 'bg-oxo-primary/10 border-oxo-primary'
                            : isPast
                            ? 'bg-oxo-card/50 border-oxo-border opacity-60'
                            : 'bg-oxo-card border-oxo-border'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-shrink-0 text-center">
                            <p className={`font-bold ${isCurrent ? 'text-oxo-primary' : ''}`}>
                              {formatTime(entry.start_timestamp)}
                            </p>
                            <p className="text-xs text-oxo-muted">
                              {formatTime(entry.stop_timestamp)}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-semibold ${isCurrent ? 'text-oxo-primary' : ''}`}>
                              {entry.title}
                            </h4>
                            {entry.description && (
                              <p className="text-sm text-oxo-muted mt-1 line-clamp-2">
                                {entry.description}
                              </p>
                            )}
                            {isCurrent && (
                              <div className="mt-3">
                                <div className="h-1 bg-oxo-border rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-oxo-primary rounded-full transition-all"
                                    style={{ width: `${getProgress(entry)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          {isCurrent && (
                            <span className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded">
                              EN COURS
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}




