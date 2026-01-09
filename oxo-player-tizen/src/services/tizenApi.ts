/**
 * Samsung Tizen TV APIs
 * Interfaces avec les APIs natives de la TV Samsung
 */

// Types pour les APIs Tizen (déclarations globales)
declare global {
  interface Window {
    tizen: typeof tizen;
    webapis: typeof webapis;
  }
  
  const tizen: {
    tvinputdevice: {
      registerKey(key: string): void;
      unregisterKey(key: string): void;
      getSupportedKeys(): Array<{ name: string; code: number }>;
    };
    application: {
      getCurrentApplication(): {
        exit(): void;
        hide(): void;
        getRequestedAppControl(): unknown;
      };
    };
  };
  
  const webapis: {
    network: {
      getMac(): string;
      getIp(): string;
      isConnectedToGateway(): boolean;
      getActiveConnectionType(): number;
    };
    avplay: {
      open(url: string): void;
      close(): void;
      prepare(): void;
      prepareAsync(successCallback: () => void, errorCallback: (error: Error) => void): void;
      play(): void;
      pause(): void;
      stop(): void;
      seekTo(position: number, successCallback?: () => void, errorCallback?: (error: Error) => void): void;
      getState(): string;
      getDuration(): number;
      getCurrentTime(): number;
      setDisplayRect(x: number, y: number, width: number, height: number): void;
      setListener(listener: AVPlayListener): void;
      setSpeed(speed: number): void;
      jumpForward(milliseconds: number): void;
      jumpBackward(milliseconds: number): void;
      setStreamingProperty(type: string, value: string): void;
    };
    productinfo: {
      getModel(): string;
      getFirmware(): string;
      getDuid(): string;
      getModelCode(): string;
    };
    appcommon: {
      setScreenSaver(type: number, time?: number): void;
    };
  };
  
  interface AVPlayListener {
    onbufferingstart?: () => void;
    onbufferingprogress?: (percent: number) => void;
    onbufferingcomplete?: () => void;
    oncurrentplaytime?: (time: number) => void;
    onevent?: (eventType: string, eventData: string) => void;
    onerror?: (eventType: string) => void;
    onsubtitlechange?: (duration: number, text: string, data3: number, data4: string) => void;
    ondrmevent?: (drmEvent: string, drmData: string) => void;
    onstreamcompleted?: () => void;
  }
}

/**
 * Vérifie si on est sur une TV Tizen
 */
export function isTizenTV(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.tizen !== 'undefined' &&
         typeof window.webapis !== 'undefined';
}

/**
 * Initialise l'application Tizen
 */
export function initTizenApp(): void {
  if (!isTizenTV()) {
    console.log('Not running on Tizen TV - using browser fallback');
    return;
  }
  
  try {
    // Désactiver l'écran de veille pendant la lecture
    if (webapis.appcommon) {
      webapis.appcommon.setScreenSaver(0); // Désactiver
    }
    
    console.log('Tizen App initialized');
    console.log('Model:', getDeviceModel());
    console.log('MAC:', getDeviceMac());
  } catch (error) {
    console.error('Failed to initialize Tizen app:', error);
  }
}

/**
 * Récupère l'adresse MAC de la TV (vraie adresse)
 */
export function getDeviceMac(): string {
  if (!isTizenTV()) {
    // Fallback pour développement sur navigateur
    let mac = localStorage.getItem('oxo_device_mac');
    if (!mac) {
      const segments = [];
      for (let i = 0; i < 6; i++) {
        const segment = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
        segments.push(segment.toUpperCase());
      }
      mac = segments.join(':');
      localStorage.setItem('oxo_device_mac', mac);
    }
    return mac;
  }
  
  try {
    const mac = webapis.network.getMac();
    // Formater en XX:XX:XX:XX:XX:XX
    if (mac && mac.length === 12) {
      return mac.match(/.{2}/g)!.join(':').toUpperCase();
    }
    return mac.toUpperCase();
  } catch (error) {
    console.error('Failed to get MAC address:', error);
    return 'UNKNOWN';
  }
}

/**
 * Récupère l'IP de la TV
 */
export function getDeviceIP(): string {
  if (!isTizenTV()) {
    return '127.0.0.1';
  }
  
  try {
    return webapis.network.getIp();
  } catch (error) {
    console.error('Failed to get IP address:', error);
    return 'UNKNOWN';
  }
}

/**
 * Récupère le modèle de la TV
 */
export function getDeviceModel(): string {
  if (!isTizenTV()) {
    return 'Browser (Dev Mode)';
  }
  
  try {
    return webapis.productinfo.getModel();
  } catch (error) {
    console.error('Failed to get device model:', error);
    return 'Samsung TV';
  }
}

/**
 * Récupère l'ID unique de la TV (DUID)
 */
export function getDeviceId(): string {
  if (!isTizenTV()) {
    return localStorage.getItem('oxo_device_id') || 'browser-dev';
  }
  
  try {
    return webapis.productinfo.getDuid();
  } catch (error) {
    console.error('Failed to get device ID:', error);
    return 'UNKNOWN';
  }
}

/**
 * Vérifie si la TV est connectée à Internet
 */
export function isNetworkConnected(): boolean {
  if (!isTizenTV()) {
    return navigator.onLine;
  }
  
  try {
    return webapis.network.isConnectedToGateway();
  } catch (error) {
    console.error('Failed to check network:', error);
    return false;
  }
}

/**
 * Ferme l'application
 */
export function exitApp(): void {
  if (!isTizenTV()) {
    console.log('Exit app (browser - no action)');
    return;
  }
  
  try {
    tizen.application.getCurrentApplication().exit();
  } catch (error) {
    console.error('Failed to exit app:', error);
  }
}

/**
 * Active/désactive l'écran de veille
 */
export function setScreenSaver(enabled: boolean): void {
  if (!isTizenTV()) return;
  
  try {
    webapis.appcommon.setScreenSaver(enabled ? 1 : 0);
  } catch (error) {
    console.error('Failed to set screen saver:', error);
  }
}



