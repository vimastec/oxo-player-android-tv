import { useEffect, useRef, useState } from 'react';
import mpegts from 'mpegts.js';
import { Loader2, Tv } from 'lucide-react';

interface VideoPreviewProps {
  src: string;
  poster?: string;
  onDoubleClick?: () => void;
}

export function VideoPreview({ src, poster, onDoubleClick }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<mpegts.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Cleanup function
  const cleanup = () => {
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.unload();
        playerRef.current.detachMediaElement();
        playerRef.current.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
      playerRef.current = null;
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    cleanup();
    setError(false);
    setIsLoading(true);

    console.log('VideoPreview loading:', src);

    // Check if mpegts.js is supported
    if (!mpegts.isSupported()) {
      console.error('mpegts.js is not supported in this browser');
      setError(true);
      setIsLoading(false);
      return;
    }

    try {
      const player = mpegts.createPlayer({
        type: 'mpegts',
        isLive: true,
        url: src,
      }, {
        enableWorker: true,
        enableStashBuffer: true,
        stashInitialSize: 384 * 1024, // 384KB initial buffer
        liveBufferLatencyChasing: false,
        liveBufferLatencyMaxLatency: 3.0,
        liveBufferLatencyMinRemain: 1.0,
        autoCleanupSourceBuffer: true,
        autoCleanupMaxBackwardDuration: 30,
        autoCleanupMinBackwardDuration: 15,
      });

      player.attachMediaElement(video);
      player.load();

      player.on(mpegts.Events.ERROR, (errorType, errorDetail) => {
        console.error('mpegts preview error:', errorType, errorDetail);
        setError(true);
        setIsLoading(false);
      });

      player.on(mpegts.Events.MEDIA_INFO, () => {
        console.log('Media info received, starting playback');
        // Try to play with sound, fallback to muted if browser blocks it
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      });

      // Fallback: try to play after a timeout
      setTimeout(() => {
        if (video.paused) {
          video.play().catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
        setIsLoading(false);
      }, 2000);

      playerRef.current = player;

    } catch (err) {
      console.error('VideoPreview init error:', err);
      setError(true);
      setIsLoading(false);
    }

    return cleanup;
  }, [src]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlaying = () => {
      setIsLoading(false);
      setError(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handleError = (e: Event) => {
      console.error('Video error:', e);
      setError(true);
      setIsLoading(false);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('waiting', handleWaiting);

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('waiting', handleWaiting);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black cursor-pointer"
      onClick={onDoubleClick}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        poster={poster}
        playsInline
      />

      {/* Loading indicator */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d1e36]">
          <Tv className="w-16 h-16 text-gray-600 mb-4" />
          <p className="text-gray-500 text-sm">Signal indisponible</p>
        </div>
      )}
    </div>
  );
}
