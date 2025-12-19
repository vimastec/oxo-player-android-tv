require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const db = require('./database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const resellerRoutes = require('./routes/reseller');
const deviceRoutes = require('./routes/device');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reseller', resellerRoutes);
app.use('/api/device', deviceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'OXO API is running' });
});

// Initialize database and start server
db.init();

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║         OXO Player API Server             ║
  ╠═══════════════════════════════════════════╣
  ║  🚀 Server running on port ${PORT}            ║
  ║  📡 API: http://localhost:${PORT}/api        ║
  ║                                           ║
  ║  Admin credentials:                       ║
  ║  📧 Email: ${process.env.ADMIN_EMAIL}      
  ║  🔑 Password: ${process.env.ADMIN_PASSWORD}              ║
  ╚═══════════════════════════════════════════╝
  `);
});

