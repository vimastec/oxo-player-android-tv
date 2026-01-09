/**
 * Lecteur vidéo Samsung AVPlay
 * Utilise l'API native Samsung pour une meilleure compatibilité
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { isTizenTV, setScreenSaver } from '../services/tizenApi';
import { TV_KEYS, isKey } from '../utils/tvNavigation';
import { Loader2, Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface TizenPlayerProps {
  src: string;
  title: string;
  onClose: () => void;
  autoPlay?: boolean;
}

type PlayerState = 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ERROR';

export function TizenPlayer({ src, title, onClose, autoPlay = true }: TizenPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('IDLE');
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const controlsTimeoutRef = useRef<number | null>(null);
  const avplayInitialized = useRef(false);

  // Initialiser AVPlay (Samsung) ou HTML5 Video (fallback)
  useEffect(() => {
    if (!src) return;

    setPlayerState('BUFFERING');
    setError(null);
    setScreenSaver(false); // Désactiver écran de veille

    if (isTizenTV() && window.webapis?.avplay) {
      // Utiliser Samsung AVPlay
      initAVPlay(src);
    } else {
      // Fallback HTML5 Video
      initHTML5Video(src);
    }

    return () => {
      cleanup();
      setScreenSaver(true); // Réactiver écran de veille
    };
  }, [src]);

  // Samsung AVPlay initialization
  const initAVPlay = (url: string) => {
    try {
      const avplay = window.webapis.avplay;

      // Fermer si déjà ouvert
      try {
        avplay.close();
      } catch {
        // Ignore
      }

      // Ouvrir le stream
      avplay.open(url);

      // Configurer l'affichage plein écran
      avplay.setDisplayRect(0, 0, 1920, 1080);

      // Listener pour les événements
      avplay.setListener({
        onbufferingstart: () => {
          console.log('AVPlay: Buffering started');
          setPlayerState('BUFFERING');
        },
        onbufferingprogress: (percent: number) => {
          console.log('AVPlay: Buffering', percent, '%');
        },
        onbufferingcomplete: () => {
          console.log('AVPlay: Buffering complete');
          setPlayerState('PLAYING');
        },
        oncurrentplaytime: (time: number) => {
          setCurrentTime(time);
        },
        onerror: (eventType: string) => {
          console.error('AVPlay Error:', eventType);
          setError('Erreur de lecture');
          setPlayerState('ERROR');
        },
        onstreamcompleted: () => {
          console.log('AVPlay: Stream completed');
          setPlayerState('IDLE');
        },
        onevent: (eventType: string, eventData: string) => {
          console.log('AVPlay Event:', eventType, eventData);
        },
      });

      // Préparer et démarrer
      avplay.prepareAsync(
        () => {
          console.log('AVPlay: Prepared successfully');
          setDuration(avplay.getDuration());
          avplayInitialized.current = true;
          
          if (autoPlay) {
            avplay.play();
            setPlayerState('PLAYING');
          } else {
            setPlayerState('READY');
          }
        },
        (error: Error) => {
          console.error('AVPlay: Prepare failed', error);
          setError('Impossible de charger le flux');
          setPlayerState('ERROR');
        }
      );
    } catch (err) {
      console.error('AVPlay init error:', err);
      setError('Erreur d\'initialisation');
      setPlayerState('ERROR');
    }
  };

  // HTML5 Video fallback (pour dev sur navigateur)
  const initHTML5Video = (url: string) => {
    const video = videoRef.current;
    if (!video) return;

    video.src = url;
    video.load();

    if (autoPlay) {
      video.play().catch((err) => {
        console.error('HTML5 Video play error:', err);
        setError('Lecture impossible');
      });
    }
  };

  // Cleanup
  const cleanup = () => {
    if (isTizenTV() && window.webapis?.avplay && avplayInitialized.current) {
      try {
        window.webapis.avplay.stop();
        window.webapis.avplay.close();
      } catch {
        // Ignore
      }
      avplayInitialized.current = false;
    }
  };

  // Contrôles
  const togglePlayPause = useCallback(() => {
    if (isTizenTV() && window.webapis?.avplay) {
      const state = window.webapis.avplay.getState();
      if (state === 'PLAYING') {
        window.webapis.avplay.pause();
        setPlayerState('PAUSED');
      } else if (state === 'PAUSED' || state === 'READY') {
        window.webapis.avplay.play();
        setPlayerState('PLAYING');
      }
    } else if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setPlayerState('PLAYING');
      } else {
        videoRef.current.pause();
        setPlayerState('PAUSED');
      }
    }
  }, []);

  const seekForward = useCallback(() => {
    if (isTizenTV() && window.webapis?.avplay) {
      window.webapis.avplay.jumpForward(10000); // 10 secondes
    } else if (videoRef.current) {
      videoRef.current.currentTime += 10;
    }
  }, []);

  const seekBackward = useCallback(() => {
    if (isTizenTV() && window.webapis?.avplay) {
      window.webapis.avplay.jumpBackward(10000); // 10 secondes
    } else if (videoRef.current) {
      videoRef.current.currentTime -= 10;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    // Note: AVPlay gère le volume via l'API TV audio
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
    }
  }, []);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (playerState === 'PLAYING') {
        setShowControls(false);
      }
    }, 5000);
  }, [playerState]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      showControlsTemporarily();

      if (isKey(event, TV_KEYS.BACK)) {
        event.preventDefault();
        onClose();
      } else if (isKey(event, TV_KEYS.ENTER) || isKey(event, TV_KEYS.PLAY_PAUSE)) {
        togglePlayPause();
      } else if (isKey(event, TV_KEYS.PLAY)) {
        if (playerState !== 'PLAYING') togglePlayPause();
      } else if (isKey(event, TV_KEYS.PAUSE)) {
        if (playerState === 'PLAYING') togglePlayPause();
      } else if (isKey(event, TV_KEYS.STOP)) {
        onClose();
      } else if (isKey(event, TV_KEYS.RIGHT) || isKey(event, TV_KEYS.FAST_FORWARD)) {
        seekForward();
      } else if (isKey(event, TV_KEYS.LEFT) || isKey(event, TV_KEYS.REWIND)) {
        seekBackward();
      } else if (isKey(event, TV_KEYS.MUTE)) {
        toggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, togglePlayPause, seekForward, seekBackward, toggleMute, showControlsTemporarily, playerState]);

  // Video events (HTML5 fallback)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isTizenTV()) return;

    const handlers = {
      play: () => setPlayerState('PLAYING'),
      pause: () => setPlayerState('PAUSED'),
      waiting: () => setPlayerState('BUFFERING'),
      playing: () => setPlayerState('PLAYING'),
      timeupdate: () => setCurrentTime(video.currentTime * 1000),
      loadedmetadata: () => setDuration(video.duration * 1000),
      error: () => {
        setError('Erreur de lecture');
        setPlayerState('ERROR');
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      video.addEventListener(event, handler);
    });

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        video.removeEventListener(event, handler);
      });
    };
  }, []);

  // Format time
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black"
      onMouseMove={showControlsTemporarily}
    >
      {/* Video Element (HTML5 fallback) */}
      {!isTizenTV() && (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          autoPlay={autoPlay}
        />
      )}

      {/* Buffering Indicator */}
      {playerState === 'BUFFERING' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-oxo-red animate-spin mx-auto mb-4" />
            <p className="text-white text-xl">Chargement...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {playerState === 'ERROR' && error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center p-8">
            <p className="text-red-500 text-2xl mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-8 py-4 bg-oxo-red rounded-lg text-white text-xl font-semibold focusable"
              tabIndex={0}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Bar - Title */}
        <div className="absolute top-0 left-0 right-0 p-8 bg-gradient-to-b from-black/80 to-transparent">
          <h2 className="text-3xl font-bold text-white truncate">{title}</h2>
        </div>

        {/* Center - Play/Pause */}
        {playerState === 'PAUSED' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-8 rounded-full bg-white/20 backdrop-blur-sm">
              <Play className="w-24 h-24 text-white" fill="white" />
            </div>
          </div>
        )}

        {/* Bottom Bar - Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 to-transparent">
          {/* Progress Bar */}
          {duration > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-4 text-white text-lg mb-2">
                <span>{formatTime(currentTime)}</span>
                <div className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-oxo-red rounded-full transition-all"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Play/Pause */}
              <button
                onClick={togglePlayPause}
                className="p-4 rounded-full bg-white/20 hover:bg-white/30 focusable"
                tabIndex={0}
              >
                {playerState === 'PLAYING' ? (
                  <Pause className="w-10 h-10 text-white" fill="white" />
                ) : (
                  <Play className="w-10 h-10 text-white" fill="white" />
                )}
              </button>

              {/* Volume */}
              <button
                onClick={toggleMute}
                className="p-4 rounded-full bg-white/20 hover:bg-white/30 focusable"
                tabIndex={0}
              >
                {isMuted ? (
                  <VolumeX className="w-8 h-8 text-white" />
                ) : (
                  <Volume2 className="w-8 h-8 text-white" />
                )}
              </button>

              {/* Live indicator */}
              {duration === 0 && (
                <span className="flex items-center gap-2 text-white text-xl">
                  <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>

            {/* Hints */}
            <div className="flex items-center gap-6 text-gray-400 text-lg">
              <span>◀ -10s</span>
              <span>▶ +10s</span>
              <span className="text-oxo-red">BACK: Fermer</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

