# OXO Player - Samsung Tizen TV

🎬 Application IPTV pour Samsung Smart TV (Tizen OS)

## 📋 Prérequis

- Node.js 18+
- Tizen Studio avec TV Extensions
- Samsung TV en mode développeur
- Certificat Samsung créé

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Lancer en mode développement (navigateur)
npm run dev

# Build pour Tizen
npm run build
```

## 📦 Déploiement sur TV Samsung

### 1. Build de l'application

```bash
npm run build
```

### 2. Copier les fichiers Tizen dans dist

```bash
cp config.xml dist/
cp public/icon.png dist/
```

### 3. Créer le package .wgt avec Tizen Studio

1. Ouvrir Tizen Studio
2. File → Import → Tizen Project
3. Sélectionner le dossier `dist`
4. Right-click sur le projet → Build Signed Package
5. Sélectionner votre certificat Samsung

### 4. Installer sur la TV

1. Device Manager → Connecter à votre TV
2. Right-click sur le projet → Run As → Tizen TV Application

## 🎮 Navigation télécommande

| Touche | Action |
|--------|--------|
| ▲▼◀▶ | Navigation |
| OK/Enter | Sélectionner |
| Back | Retour |
| Play/Pause | Lecture/Pause |
| Stop | Arrêter |
| Rouge | Actualiser |

## 📁 Structure du projet

```
oxo-player-tizen/
├── config.xml          # Configuration Tizen
├── index.html          # Point d'entrée
├── src/
│   ├── App.tsx         # Application principale
│   ├── components/     # Composants React
│   │   ├── TizenPlayer.tsx  # Lecteur Samsung AVPlay
│   │   ├── Sidebar.tsx
│   │   └── ChannelCard.tsx
│   ├── pages/          # Pages de l'application
│   │   ├── ActivationPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── LiveTVPage.tsx
│   │   ├── MoviesPage.tsx
│   │   ├── SeriesPage.tsx
│   │   └── SettingsPage.tsx
│   ├── services/       # API et services
│   │   ├── tizenApi.ts     # APIs Samsung
│   │   ├── deviceApi.ts    # API OXO Backend
│   │   └── xtreamApi.ts    # API Xtream Codes
│   ├── stores/         # State management
│   └── utils/          # Utilitaires
│       └── tvNavigation.ts # Navigation télécommande
└── public/
    └── icon.png        # Icône de l'app
```

## 🔧 APIs Samsung utilisées

- **webapis.network** - Récupération de la vraie adresse MAC
- **webapis.avplay** - Lecteur vidéo natif Samsung
- **tizen.tvinputdevice** - Gestion des touches télécommande
- **webapis.productinfo** - Infos appareil (modèle, firmware)

## ⚠️ Notes importantes

1. **Résolution** : L'app est optimisée pour 1920x1080 (Full HD)
2. **AVPlay** : Le lecteur Samsung AVPlay offre un meilleur support des codecs que HLS.js
3. **MAC Address** : Sur Tizen, on utilise la vraie MAC de la TV (pas de pseudo-MAC)
4. **Certificat** : Obligatoire pour installer sur une vraie TV

## 🐛 Debug

Pour voir les logs sur la TV :

```bash
sdb connect <IP_TV>
sdb dlog -v long | grep OXO
```

## 📄 Licence

Propriétaire - OXO Player

