#!/bin/bash

echo "🚀 Déploiement OXO Panel sur Firebase"
echo "======================================"
echo ""

# Check if firebase-tools is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI n'est pas installé"
    echo "📦 Installation de firebase-tools..."
    npm install -g firebase-tools
fi

echo "📦 Installation des dépendances..."
npm install

echo "🔨 Build du projet..."
npm run build

echo "🌐 Déploiement sur Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "✅ Déploiement terminé!"
echo "🌍 Panel accessible sur: https://oxo-panel-admin.web.app/"













