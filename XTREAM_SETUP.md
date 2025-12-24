# 🎯 Guide d'intégration Xtream Code - OXO Player

## ✅ Modifications apportées

### 1. **Base de données (oxo-api)**
- ✅ Ajout des colonnes dans la table `devices`:
  - `playlist_type` (TEXT) - Type: 'm3u' ou 'xtream'
  - `xtream_host` (TEXT) - Serveur Xtream
  - `xtream_username` (TEXT) - Nom d'utilisateur
  - `xtream_password` (TEXT) - Mot de passe
- ✅ Migration exécutée avec succès

### 2. **API (oxo-api)**
- ✅ Nouvelle route: `PUT /api/reseller/devices/:mac/xtream`
  - Paramètres: `{ host, username, password }`
  - Enregistre les identifiants Xtream pour un appareil
- ✅ Modification des routes existantes pour supporter Xtream:
  - `/api/device/register` - Retourne `playlist_type`
  - `/api/device/playlist/:mac` - Retourne les identifiants Xtream si configurés
  - `/api/device/status/:mac` - Gère les deux types de playlists

### 3. **Panel Admin (oxo-panel)**
- ✅ Interface de choix entre M3U et Xtream Code
- ✅ Formulaire de saisie des identifiants Xtream:
  - Host / Serveur
  - Username
  - Password
- ✅ Nouvelle méthode API: `setXtreamCredentials()`

### 4. **App Android (oxo-player-android)**
- ✅ L'application supporte déjà Xtream Code via `XtreamClient` et `XtreamRepository`
- ✅ Détection automatique du type de configuration
- ✅ Parsing automatique des identifiants depuis M3U ou utilisation directe

## 📋 Comment utiliser

### Pour les revendeurs (Panel)

1. **Accéder au panel**: https://oxo-panel-admin.web.app/
2. **Activer un appareil** (page "Activer")
3. **Configurer la playlist** (page "Mes appareils"):
   - Cliquer sur "Ajouter/Modifier playlist"
   - **Option 1: M3U URL** (comme avant)
     - Saisir l'URL de la playlist
     - Ou uploader un fichier .m3u
   - **Option 2: Xtream Code** (nouveau!)
     - Saisir le serveur (ex: `server.com` ou `12.34.56.78:25461`)
     - Saisir le username
     - Saisir le password
   - Cliquer sur "Sauvegarder"

### Pour l'app Android

L'application Android récupère automatiquement:
- Si **type = 'm3u'**: L'URL de la playlist comme avant
- Si **type = 'xtream'**: Les identifiants Xtream Code directement

```json
// Réponse API pour type M3U
{
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "status": "active",
  "playlist_type": "m3u",
  "playlist_url": "http://server.com/playlist.m3u"
}

// Réponse API pour type Xtream
{
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "status": "active",
  "playlist_type": "xtream",
  "xtream": {
    "host": "server.com",
    "username": "user123",
    "password": "pass123"
  }
}
```

## 🚀 Déploiement

### Panel (Firebase)
```bash
cd oxo-panel
./deploy.sh
```

Ou manuellement:
```bash
cd oxo-panel
npm install
npm run build
firebase deploy --only hosting
```

### API (Railway)
L'API est déjà déployée sur Railway. Les modifications sont automatiquement déployées via Git push.

Pour mettre à jour:
```bash
cd oxo-api
git add .
git commit -m "Add Xtream Code support"
git push railway main
```

### App Android
Recompiler et redistribuer l'APK (pas de changement nécessaire car déjà compatible).

## 🔧 Migration existante

Pour les appareils déjà configurés avec M3U:
- ✅ Pas de problème! `playlist_type` est défini par défaut à 'm3u'
- ✅ Les appareils existants continuent de fonctionner normalement
- ✅ Vous pouvez basculer d'un type à l'autre à tout moment

## 📝 Notes importantes

1. **Format du Host**:
   - ✅ Correct: `server.com` ou `12.34.56.78:25461`
   - ❌ Incorrect: `http://server.com` ou `https://server.com`
   - Le protocole et le slash final sont automatiquement nettoyés

2. **Sécurité**:
   - Les mots de passe Xtream sont stockés en clair dans la base de données
   - Pour une meilleure sécurité en production, envisager le chiffrement

3. **Compatibilité**:
   - L'app Android détecte automatiquement si des credentials Xtream sont fournis
   - Basculement transparent entre M3U et Xtream

## ✨ Avantages de Xtream Code

1. **Meilleur performance**: API optimisée pour IPTV
2. **Catégories natives**: Live TV, Films, Séries séparés
3. **Métadonnées riches**: Logos, descriptions, EPG
4. **Mise à jour dynamique**: Contenu mis à jour côté serveur
5. **Gestion des séries**: Saisons et épisodes structurés

## 🐛 Troubleshooting

### "Aucune playlist configurée"
- Vérifier que l'appareil est activé
- Vérifier que les identifiants Xtream ou l'URL M3U sont bien configurés

### "Erreur de connexion Xtream"
- Vérifier le format du host (sans http://)
- Vérifier les identifiants auprès du fournisseur IPTV
- Tester avec un outil comme Postman: `http://HOST/player_api.php?username=USER&password=PASS`

### L'app Android ne reçoit pas les identifiants
- Vérifier la migration de la base de données
- Redémarrer le serveur API
- Vérifier les logs API

## 📞 Support

Pour toute question ou problème:
1. Vérifier les logs de l'API
2. Vérifier les logs de l'app Android (Logcat)
3. Tester l'endpoint API manuellement avec Postman





