/**
 * Navigation télécommande Samsung TV
 * Gère les touches de la télécommande et la navigation D-pad
 */

import { isTizenTV, exitApp } from '../services/tizenApi';

// Codes de touches pour Samsung Tizen TV
export const TV_KEYS = {
  // Navigation
  LEFT: [37, 'ArrowLeft'],
  RIGHT: [39, 'ArrowRight'],
  UP: [38, 'ArrowUp'],
  DOWN: [40, 'ArrowDown'],
  
  // Actions
  ENTER: [13, 'Enter'],
  BACK: [10009, 'XF86Back', 'Backspace', 'Escape'],
  EXIT: [10182, 'XF86Exit'],
  
  // Touches couleurs (télécommande Samsung)
  RED: [403, 'ColorF0Red'],
  GREEN: [404, 'ColorF1Green'],
  YELLOW: [405, 'ColorF2Yellow'],
  BLUE: [406, 'ColorF3Blue'],
  
  // Media
  PLAY: [415, 'MediaPlay'],
  PAUSE: [19, 'MediaPause'],
  PLAY_PAUSE: [10252, 'MediaPlayPause'],
  STOP: [413, 'MediaStop'],
  REWIND: [412, 'MediaRewind'],
  FAST_FORWARD: [417, 'MediaFastForward'],
  
  // Numéros
  NUM_0: [48, '0'],
  NUM_1: [49, '1'],
  NUM_2: [50, '2'],
  NUM_3: [51, '3'],
  NUM_4: [52, '4'],
  NUM_5: [53, '5'],
  NUM_6: [54, '6'],
  NUM_7: [55, '7'],
  NUM_8: [56, '8'],
  NUM_9: [57, '9'],
  
  // Contrôle volume
  VOLUME_UP: [447, 'VolumeUp'],
  VOLUME_DOWN: [448, 'VolumeDown'],
  MUTE: [449, 'VolumeMute'],
  
  // Chaînes
  CHANNEL_UP: [427, 'ChannelUp'],
  CHANNEL_DOWN: [428, 'ChannelDown'],
  
  // Info
  INFO: [457, 'Info'],
  GUIDE: [458, 'Guide'],
};

/**
 * Vérifie si une touche correspond à un groupe de codes
 */
export function isKey(event: KeyboardEvent, keys: (number | string)[]): boolean {
  const keyCode = event.keyCode || event.which;
  const key = event.key;
  
  for (const k of keys) {
    if (typeof k === 'number' && keyCode === k) return true;
    if (typeof k === 'string' && key === k) return true;
  }
  return false;
}

/**
 * Enregistre les touches spéciales pour Samsung Tizen
 */
export function registerTizenKeys(): void {
  if (!isTizenTV()) {
    console.log('Not on Tizen TV - using browser keyboard');
    return;
  }

  try {
    const keysToRegister = [
      // Touches couleurs
      'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
      // Media
      'MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 
      'MediaRewind', 'MediaFastForward',
      // Autres
      'Info', 'Guide', 'Exit',
    ];
    
    // @ts-ignore - API Tizen
    const tvinputdevice = tizen.tvinputdevice;
    
    keysToRegister.forEach(key => {
      try {
        tvinputdevice.registerKey(key);
      } catch (e) {
        console.log('Could not register key:', key);
      }
    });
    
    console.log('Tizen remote keys registered');
  } catch (e) {
    console.error('Failed to register Tizen keys:', e);
  }
}

/**
 * Hook pour gérer la navigation sur une page
 */
export function useKeyHandler(handlers: {
  onBack?: () => void;
  onEnter?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onRed?: () => void;
  onGreen?: () => void;
  onYellow?: () => void;
  onBlue?: () => void;
  onNumber?: (num: number) => void;
}): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    // Navigation
    if (isKey(event, TV_KEYS.BACK)) {
      event.preventDefault();
      handlers.onBack?.();
    }
    else if (isKey(event, TV_KEYS.ENTER)) {
      handlers.onEnter?.();
    }
    else if (isKey(event, TV_KEYS.UP)) {
      handlers.onUp?.();
    }
    else if (isKey(event, TV_KEYS.DOWN)) {
      handlers.onDown?.();
    }
    else if (isKey(event, TV_KEYS.LEFT)) {
      handlers.onLeft?.();
    }
    else if (isKey(event, TV_KEYS.RIGHT)) {
      handlers.onRight?.();
    }
    // Media
    else if (isKey(event, TV_KEYS.PLAY) || isKey(event, TV_KEYS.PLAY_PAUSE)) {
      handlers.onPlay?.();
    }
    else if (isKey(event, TV_KEYS.PAUSE)) {
      handlers.onPause?.();
    }
    else if (isKey(event, TV_KEYS.STOP)) {
      handlers.onStop?.();
    }
    // Couleurs
    else if (isKey(event, TV_KEYS.RED)) {
      handlers.onRed?.();
    }
    else if (isKey(event, TV_KEYS.GREEN)) {
      handlers.onGreen?.();
    }
    else if (isKey(event, TV_KEYS.YELLOW)) {
      handlers.onYellow?.();
    }
    else if (isKey(event, TV_KEYS.BLUE)) {
      handlers.onBlue?.();
    }
    // Numéros
    else if (handlers.onNumber) {
      for (let i = 0; i <= 9; i++) {
        const numKey = TV_KEYS[`NUM_${i}` as keyof typeof TV_KEYS];
        if (numKey && isKey(event, numKey)) {
          handlers.onNumber(i);
          break;
        }
      }
    }
    // Exit app
    else if (isKey(event, TV_KEYS.EXIT)) {
      exitApp();
    }
  };
}

/**
 * Focus le premier élément focusable
 */
export function focusFirst(container?: HTMLElement): void {
  const root = container || document.body;
  const focusable = root.querySelector<HTMLElement>('[tabindex]:not([tabindex="-1"]), button, a, input');
  focusable?.focus();
}

/**
 * Navigation spatiale - trouve l'élément dans une direction
 */
export function findNextFocusable(
  current: HTMLElement,
  direction: 'up' | 'down' | 'left' | 'right',
  container?: HTMLElement
): HTMLElement | null {
  const root = container || document.body;
  const focusables = Array.from(
    root.querySelectorAll<HTMLElement>('[tabindex]:not([tabindex="-1"]), button, a')
  );
  
  if (focusables.length === 0) return null;
  
  const currentRect = current.getBoundingClientRect();
  const currentCenter = {
    x: currentRect.left + currentRect.width / 2,
    y: currentRect.top + currentRect.height / 2,
  };
  
  let bestCandidate: HTMLElement | null = null;
  let bestDistance = Infinity;
  
  for (const el of focusables) {
    if (el === current) continue;
    
    const rect = el.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    
    // Vérifier si l'élément est dans la bonne direction
    let isInDirection = false;
    switch (direction) {
      case 'up':
        isInDirection = center.y < currentCenter.y;
        break;
      case 'down':
        isInDirection = center.y > currentCenter.y;
        break;
      case 'left':
        isInDirection = center.x < currentCenter.x;
        break;
      case 'right':
        isInDirection = center.x > currentCenter.x;
        break;
    }
    
    if (!isInDirection) continue;
    
    // Calculer la distance
    const distance = Math.sqrt(
      Math.pow(center.x - currentCenter.x, 2) + 
      Math.pow(center.y - currentCenter.y, 2)
    );
    
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = el;
    }
  }
  
  return bestCandidate;
}

