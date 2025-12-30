/**
 * Security Middleware
 * - Rate limiting
 * - Firebase token verification
 * - App verification (package, signature, version)
 */

const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');

// ============================================
// CONFIGURATION
// ============================================

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://oxo-panel-admin.web.app',
  'https://oxo-portal.web.app',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

// Allowed Android app packages
const ALLOWED_PACKAGES = [
  'com.oxoplayer.tv',
];

// Allowed APK signatures (SHA-256 fingerprints)
// Get this by running: keytool -list -v -keystore your-key.jks -alias your-alias
const ALLOWED_SIGNATURES = [
  'CC:47:65:7E:A6:BC:67:08:90:DB:4A:E2:FB:00:A3:17:7E:0D:F7:81:23:79:D7:7C:91:3A:B3:BA:25:AD:E0:7C',
];

// Minimum app version (major.minor.patch as number: 1.0.0 = 100)
const MIN_APP_VERSION = 100; // 1.0.0

// ============================================
// RATE LIMITERS
// ============================================

// General API rate limit
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Trop de requêtes. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For header if behind proxy (Railway)
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
});

// Strict rate limit for login
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts per 5 minutes
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 5 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
});

// Rate limit for MAC activation
const activationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 activations per minute
  message: { error: 'Trop d\'activations. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Limit by user ID + IP
    const userId = req.user?.id || 'anon';
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    return `${userId}-${ip}`;
  },
});

// Rate limit for device registration (Android app)
const deviceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: { error: 'Trop de requêtes. Réessayez dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  },
});

// ============================================
// CORS CONFIGURATION
// ============================================

function corsOptions(req, callback) {
  const origin = req.header('Origin');
  
  // Allow requests with no origin (mobile apps, curl, etc.)
  if (!origin) {
    return callback(null, { origin: true, credentials: true });
  }
  
  // Check if origin is allowed
  if (ALLOWED_ORIGINS.includes(origin)) {
    callback(null, { origin: true, credentials: true });
  } else {
    // In production, reject unknown origins
    if (process.env.NODE_ENV === 'production') {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(null, { origin: false });
    } else {
      // In development, allow all
      callback(null, { origin: true, credentials: true });
    }
  }
}

// ============================================
// FIREBASE ADMIN INITIALIZATION
// ============================================

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;
  
  try {
    // Check if service account is provided via env
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (serviceAccount) {
      const parsedAccount = JSON.parse(serviceAccount);
      admin.initializeApp({
        credential: admin.credential.cert(parsedAccount),
      });
      console.log('🔥 Firebase Admin initialized with service account');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use default credentials file
      admin.initializeApp();
      console.log('🔥 Firebase Admin initialized with default credentials');
    } else {
      console.warn('⚠️ Firebase Admin not configured - token verification disabled');
      return;
    }
    
    firebaseInitialized = true;
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
  }
}

// ============================================
// FIREBASE TOKEN VERIFICATION MIDDLEWARE
// ============================================

async function verifyFirebaseToken(req, res, next) {
  // Skip if Firebase not initialized
  if (!firebaseInitialized) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token Firebase manquant' });
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error.message);
    return res.status(401).json({ error: 'Token Firebase invalide ou expiré' });
  }
}

// ============================================
// APP VERIFICATION MIDDLEWARE (for Android)
// ============================================

function verifyAppHeaders(req, res, next) {
  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  const packageName = req.headers['x-app-package'];
  const appVersion = req.headers['x-app-version'];
  const appSignature = req.headers['x-app-signature'];
  
  // If no app headers, it's probably a web request - skip
  if (!packageName && !appVersion) {
    return next();
  }
  
  // Verify package name
  if (packageName && !ALLOWED_PACKAGES.includes(packageName)) {
    console.warn(`⚠️ Blocked request from unknown package: ${packageName}`);
    return res.status(403).json({ error: 'Application non autorisée' });
  }
  
  // Verify minimum version
  if (appVersion) {
    const versionParts = appVersion.split('.').map(Number);
    const versionNumber = versionParts[0] * 100 + (versionParts[1] || 0);
    
    if (versionNumber < MIN_APP_VERSION) {
      return res.status(426).json({ 
        error: 'Version de l\'application obsolète',
        message: 'Veuillez mettre à jour l\'application',
        min_version: '1.0.0'
      });
    }
  }
  
  // Verify app signature against known APK signatures
  // TODO: Activer cette vérification quand l'application sera finalisée
  if (appSignature) {
    if (!ALLOWED_SIGNATURES.includes(appSignature)) {
      // MODE DÉVELOPPEMENT: Log seulement, ne pas bloquer
      console.warn(`⚠️ Unknown APK signature (dev mode - not blocking): ${appSignature.substring(0, 30)}...`);
      // Décommenter les lignes suivantes pour activer le blocage en production:
      // return res.status(403).json({ 
      //   error: 'Application non autorisée',
      //   message: 'Signature APK invalide. Téléchargez l\'application officielle.'
      // });
    } else {
      console.log(`✅ Valid APK signature verified`);
    }
  }
  
  next();
}

// ============================================
// SECURITY HEADERS CHECK
// ============================================

function requireSecureConfig(req, res, next) {
  // In production, ensure critical env vars are set
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'oxo_secret') {
      console.error('❌ CRITICAL: JWT_SECRET not set or using default value!');
      // Don't block, but log warning
    }
  }
  next();
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  generalLimiter,
  loginLimiter,
  activationLimiter,
  deviceLimiter,
  corsOptions,
  initializeFirebase,
  verifyFirebaseToken,
  verifyAppHeaders,
  requireSecureConfig,
  ALLOWED_ORIGINS,
};


