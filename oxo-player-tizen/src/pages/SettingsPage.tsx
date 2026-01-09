/**
 * Page Paramètres
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Info, RefreshCw, LogOut, Wifi, HardDrive } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { getDeviceMac, getDeviceModel, getDeviceIP, exitApp } from '../services/tizenApi';
import { TV_KEYS, isKey } from '../utils/tvNavigation';

interface SettingsPageProps {
  onBack: () => void;
}

interface SettingItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Info;
  action?: () => void;
  value?: string;
  danger?: boolean;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { macAddress, deviceStatus, daysRemaining, expirationDate, reset } = useAppStore();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const settings: SettingItem[] = [
    {
      id: 'device',
      label: 'Informations appareil',
      description: 'Modèle et adresse MAC',
      icon: HardDrive,
      value: getDeviceModel(),
    },
    {
      id: 'mac',
      label: 'Adresse MAC',
      description: 'Identifiant unique de l\'appareil',
      icon: Wifi,
      value: macAddress || getDeviceMac(),
    },
    {
      id: 'ip',
      label: 'Adresse IP',
      description: 'Adresse réseau actuelle',
      icon: Wifi,
      value: getDeviceIP(),
    },
    {
      id: 'status',
      label: 'Statut abonnement',
      description: expirationDate ? `Expire le ${new Date(expirationDate).toLocaleDateString('fr-FR')}` : 'Non activé',
      icon: Info,
      value: deviceStatus === 'active' ? `Actif (${daysRemaining}j)` : deviceStatus === 'trial' ? `Essai (${daysRemaining}j)` : 'Expiré',
    },
    {
      id: 'refresh',
      label: 'Actualiser la playlist',
      description: 'Recharger les chaînes et contenus',
      icon: RefreshCw,
      action: () => {
        // Force reload
        window.location.reload();
      },
    },
    {
      id: 'reset',
      label: 'Réinitialiser l\'application',
      description: 'Supprimer toutes les données locales',
      icon: LogOut,
      action: () => {
        if (confirm('Voulez-vous vraiment réinitialiser l\'application ?')) {
          reset();
          localStorage.clear();
          window.location.reload();
        }
      },
      danger: true,
    },
    {
      id: 'exit',
      label: 'Quitter l\'application',
      description: 'Fermer OXO Player',
      icon: LogOut,
      action: () => exitApp(),
      danger: true,
    },
  ];

  // Focus initial
  useEffect(() => {
    itemRefs.current[0]?.focus();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isKey(event, TV_KEYS.BACK)) {
        event.preventDefault();
        onBack();
      } else if (isKey(event, TV_KEYS.UP)) {
        event.preventDefault();
        const newIndex = focusedIndex > 0 ? focusedIndex - 1 : settings.length - 1;
        setFocusedIndex(newIndex);
        itemRefs.current[newIndex]?.focus();
      } else if (isKey(event, TV_KEYS.DOWN)) {
        event.preventDefault();
        const newIndex = focusedIndex < settings.length - 1 ? focusedIndex + 1 : 0;
        setFocusedIndex(newIndex);
        itemRefs.current[newIndex]?.focus();
      } else if (isKey(event, TV_KEYS.ENTER)) {
        const setting = settings[focusedIndex];
        if (setting.action) {
          setting.action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, settings, onBack]);

  return (
    <div className="min-h-screen bg-oxo-dark p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors focusable p-2 rounded-lg mb-4"
          tabIndex={-1}
        >
          <ArrowLeft className="w-6 h-6" />
          <span className="text-lg">Retour</span>
        </button>
        <h1 className="text-4xl font-bold text-white">Paramètres</h1>
      </div>

      {/* Settings list */}
      <div className="max-w-2xl">
        <div className="space-y-3">
          {settings.map((setting, index) => {
            const Icon = setting.icon;
            
            return (
              <button
                key={setting.id}
                ref={el => { itemRefs.current[index] = el; }}
                onClick={() => setting.action?.()}
                onFocus={() => setFocusedIndex(index)}
                className={`w-full flex items-center gap-6 p-6 rounded-2xl transition-all focusable text-left ${
                  setting.danger
                    ? 'bg-red-500/10 hover:bg-red-500/20'
                    : 'bg-oxo-gray hover:bg-oxo-gray/80'
                }`}
                tabIndex={0}
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  setting.danger ? 'bg-red-500/20' : 'bg-white/10'
                }`}>
                  <Icon className={`w-7 h-7 ${setting.danger ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                
                <div className="flex-1">
                  <h3 className={`text-xl font-semibold ${setting.danger ? 'text-red-500' : 'text-white'}`}>
                    {setting.label}
                  </h3>
                  {setting.description && (
                    <p className="text-gray-500 text-sm mt-1">{setting.description}</p>
                  )}
                </div>
                
                {setting.value && (
                  <div className="text-right">
                    <p className="text-white font-mono text-lg">{setting.value}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Version info */}
      <div className="fixed bottom-8 left-8 text-gray-600">
        <p>OXO Player v1.0.0</p>
        <p>Pour Samsung Tizen TV</p>
      </div>

      {/* Key hints */}
      <div className="fixed bottom-8 right-8 flex items-center gap-6 text-gray-600 text-sm">
        <span className="flex items-center gap-2">
          <span className="px-2 py-1 bg-white/10 rounded text-xs">◀</span>
          Retour
        </span>
        <span className="flex items-center gap-2">
          <span className="px-2 py-1 bg-white/10 rounded text-xs">OK</span>
          Sélectionner
        </span>
      </div>
    </div>
  );
}

