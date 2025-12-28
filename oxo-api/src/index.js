require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const db = require('./database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const resellerRoutes = require('./routes/reseller');
const deviceRoutes = require('./routes/device');
const portalRoutes = require('./routes/portal');

// Security middleware
const {
  generalLimiter,
  loginLimiter,
  activationLimiter,
  deviceLimiter,
  corsOptions,
  initializeFirebase,
  verifyAppHeaders,
  requireSecureConfig,
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (Railway uses reverse proxy)
app.set('trust proxy', 1);

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet - Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Disable CSP for API
}));

// CORS - Configured for allowed origins
app.use(cors(corsOptions));

// General rate limiting
app.use('/api', generalLimiter);

// Require secure config check
app.use(requireSecureConfig);

// App verification for Android requests
app.use(verifyAppHeaders);

// JSON parsing
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Video stream proxy - bypasses CORS for live streams
app.get('/api/stream/proxy', (req, res) => {
  const streamUrl = req.query.url;
  
  if (!streamUrl) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  const fetchStream = (url, redirectCount = 0) => {
    if (redirectCount > 5) {
      return res.status(502).json({ error: 'Too many redirects' });
    }

    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const proxyReq = protocol.get(url, {
        headers: {
          'User-Agent': 'VLC/3.0.16 LibVLC/3.0.16',
          'Accept': '*/*',
          'Connection': 'keep-alive',
        }
      }, (proxyRes) => {
        // Handle redirects
        if (proxyRes.statusCode === 301 || proxyRes.statusCode === 302 || proxyRes.statusCode === 307) {
          const location = proxyRes.headers.location;
          if (location) {
            console.log('Following redirect to:', location);
            return fetchStream(location, redirectCount + 1);
          }
        }

        // Forward headers
        res.set({
          'Content-Type': proxyRes.headers['content-type'] || 'video/mp2t',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        });

        // Pipe the stream
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('Stream proxy error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Stream unavailable' });
        }
      });

      // Handle client disconnect
      req.on('close', () => {
        proxyReq.destroy();
      });

    } catch (err) {
      console.error('Proxy URL error:', err.message);
      if (!res.headersSent) {
        res.status(400).json({ error: 'Invalid URL' });
      }
    }
  };

  fetchStream(streamUrl);
});

// ============================================
// ROUTES WITH SPECIFIC RATE LIMITS
// ============================================

// Auth routes - strict rate limiting on login
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Reseller routes - activation has its own limiter
app.use('/api/reseller/activate', activationLimiter);
app.use('/api/reseller', resellerRoutes);

// Device routes - for Android app
app.use('/api/device', deviceLimiter);
app.use('/api/device', deviceRoutes);

// Portal routes
app.use('/api/portal/login', loginLimiter);
app.use('/api/portal', portalRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'OXO API is running' });
});

// DEBUG: Check devices trial status (TEMPORARY - remove after verification)
app.get('/api/debug/devices-trial', async (req, res) => {
  try {
    const devices = await db.db.prepare(`
      SELECT mac_address, status, trial_start, expiration_date, last_seen, created_at
      FROM devices 
      ORDER BY created_at DESC 
      LIMIT 15
    `).all();
    
    const now = new Date();
    const result = devices.map(d => {
      let daysRemaining = 0;
      if (d.expiration_date) {
        const expDate = new Date(d.expiration_date);
        daysRemaining = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
      }
      return {
        mac: d.mac_address,
        status: d.status,
        trial_start: d.trial_start,
        expiration: d.expiration_date,
        days_remaining: daysRemaining,
        last_seen: d.last_seen,
        created: d.created_at
      };
    });
    
    res.json({ 
      server_time: now.toISOString(),
      devices: result 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SERVER INITIALIZATION
// ============================================

(async () => {
  try {
    // Initialize Firebase Admin (for token verification)
    initializeFirebase();
    
    // Initialize database
    await db.init();

    // Run migrations only for SQLite (PostgreSQL schema is created in database.js)
    if (!db.usePostgres) {
      try {
        const xtreamMigration = require('./migrations/add_xtream_fields');
        xtreamMigration.runMigration();
      } catch (err) {
        console.log('Xtream migration already applied or failed:', err.message);
      }

      try {
        const portalMigration = require('./migrations/add_portal_support');
        portalMigration.runMigration();
      } catch (err) {
        console.log('Portal migration already applied or failed:', err.message);
      }
    } else {
      console.log('✅ PostgreSQL detected - skipping SQLite migrations');
    }

    app.listen(PORT, () => {
      const isProduction = process.env.NODE_ENV === 'production';
      console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║         OXO Player API Server                     ║
  ╠═══════════════════════════════════════════════════╣
  ║  🚀 Server running on port ${PORT}                    ║
  ║  📡 API: http://localhost:${PORT}/api                ║
  ║  🔒 Mode: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}                          ║
  ║  🛡️  Security: helmet, rate-limit, CORS strict     ║
  ╚═══════════════════════════════════════════════════╝
      `);
    });
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  }
})();

