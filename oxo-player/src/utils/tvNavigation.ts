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
  
  // Couleurs (télécommande Samsung)
  RED: [403, 'ColorF0Red'],
  GREEN: [404, 'ColorF1Green'],
  YELLOW: [405, 'ColorF2Yellow'],
  BLUE: [406, 'ColorF3Blue'],
  
  // Media
  PLAY: [415, 'MediaPlay'],
  PAUSE: [19, 'MediaPause'],
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
};

// Vérifie si une touche correspond à un groupe de codes
export function isKey(event: KeyboardEvent, keys: (number | string)[]): boolean {
  const keyCode = event.keyCode || event.which;
  const key = event.key;
  
  for (const k of keys) {
    if (typeof k === 'number' && keyCode === k) return true;
    if (typeof k === 'string' && key === k) return true;
  }
  return false;
}

// Enregistre les touches pour Samsung Tizen (si disponible)
export function registerTizenKeys(): void {
  try {
    // @ts-ignore - API Tizen
    if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
      const keysToRegister = [
        'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
        'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward',
      ];
      
      keysToRegister.forEach(key => {
        try {
          // @ts-ignore
          tizen.tvinputdevice.registerKey(key);
        } catch (e) {
          console.log('Could not register key:', key);
        }
      });
      
      console.log('Tizen keys registered');
    }
  } catch (e) {
    console.log('Not running on Tizen TV');
  }
}

// Initialise la navigation TV au démarrage de l'app
export function initTVNavigation(): void {
  registerTizenKeys();
  
  // NE RIEN BLOQUER - Laisser Samsung gérer la navigation !
  console.log('TV Navigation initialized - Samsung native mode');
}

