/**
 * Top 10 Routes - Public API for fetching pre-calculated Top 10 content
 * The Top 10 is calculated server-side and cached per Xtream host
 */

const express = require('express');
const { db } = require('../database');

const router = express.Router();

/**
 * Get Top 10 for a specific Xtream host
 * GET /api/top10?host=iptv-gold.com:8080
 * 
 * This is a PUBLIC endpoint (no auth required) - used by Android app
 */
router.get('/', async (req, res) => {
  try {
    const { host } = req.query;

    if (!host) {
      return res.status(400).json({ 
        error: 'Host parameter required',
        message: 'Please provide the Xtream host (e.g., ?host=iptv-gold.com:8080)'
      });
    }

    // Normalize host (remove http://, https://, trailing slashes, and standard ports)
    let normalizedHost = host.trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/:8080$/, '')  // Remove standard IPTV port
      .replace(/:80$/, '')    // Remove standard HTTP port
      .toLowerCase();
    
    // Also create version without any port for flexible matching
    const hostWithoutPort = normalizedHost.replace(/:\d+$/, '');

    // Find the host in database (try with port first, then without)
    let xtreamHost = await db.prepare(
      'SELECT id, host, name, last_top10_update FROM xtream_hosts WHERE LOWER(host) = ? AND is_active = TRUE'
    ).get(normalizedHost);
    
    // If not found, try without port
    if (!xtreamHost && hostWithoutPort !== normalizedHost) {
      xtreamHost = await db.prepare(
        'SELECT id, host, name, last_top10_update FROM xtream_hosts WHERE LOWER(host) = ? AND is_active = TRUE'
      ).get(hostWithoutPort);
    }

    if (!xtreamHost) {
      // Host not found - return empty Top 10 (app will fallback to client-side calculation)
      return res.json({
        host: normalizedHost,
        found: false,
        message: 'Host not registered for Top 10 service',
        movies: [],
        series: [],
        last_update: null
      });
    }

    // Get cached Top 10 movies for this host
    const movies = await db.prepare(`
      SELECT rank, title, poster_url, xtream_id, stream_icon, cover, 
             container_extension, badge, tmdb_id
      FROM top10_cache 
      WHERE host_id = ? AND type = 'movies'
      ORDER BY rank ASC
      LIMIT 10
    `).all(xtreamHost.id);

    // Get cached Top 10 series for this host
    const series = await db.prepare(`
      SELECT rank, title, poster_url, xtream_id, stream_icon, cover, 
             container_extension, badge, tmdb_id
      FROM top10_cache 
      WHERE host_id = ? AND type = 'series'
      ORDER BY rank ASC
      LIMIT 10
    `).all(xtreamHost.id);

    // Format response
    const formattedMovies = movies.map(m => ({
      rank: m.rank,
      title: m.title,
      posterUrl: m.poster_url,
      xtreamId: m.xtream_id,
      isMovie: true,
      badge: m.badge,
      streamIcon: m.stream_icon,
      cover: m.cover,
      containerExtension: m.container_extension
    }));

    const formattedSeries = series.map(s => ({
      rank: s.rank,
      title: s.title,
      posterUrl: s.poster_url,
      xtreamId: s.xtream_id,
      isMovie: false,
      badge: s.badge,
      streamIcon: s.stream_icon,
      cover: s.cover,
      containerExtension: s.container_extension
    }));

    res.json({
      host: xtreamHost.host,
      name: xtreamHost.name,
      found: true,
      movies: formattedMovies,
      series: formattedSeries,
      last_update: xtreamHost.last_top10_update
    });

  } catch (error) {
    console.error('Error fetching Top 10:', error);
    res.status(500).json({ error: 'Failed to fetch Top 10 content' });
  }
});

/**
 * Register a new Xtream host (auto-detection)
 * POST /api/top10/register-host
 * 
 * Called automatically when a playlist is added via Portal or Reseller panel
 * This is an internal endpoint
 */
router.post('/register-host', async (req, res) => {
  try {
    const { host, username, password } = req.body;

    if (!host) {
      return res.status(400).json({ error: 'Host is required' });
    }

    // Normalize host
    let normalizedHost = host.trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();

    // Check if host already exists
    const existingHost = await db.prepare(
      'SELECT id FROM xtream_hosts WHERE LOWER(host) = ?'
    ).get(normalizedHost);

    if (existingHost) {
      return res.json({ 
        success: true, 
        message: 'Host already registered',
        host_id: existingHost.id
      });
    }

    // Auto-generate a name from the host
    const autoName = normalizedHost.split('.')[0].toUpperCase();

    // Insert new host (will be processed by CRON job)
    const result = await db.prepare(`
      INSERT INTO xtream_hosts (host, name, test_username, test_password, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(normalizedHost, autoName, username || null, password || null, true);

    console.log(`🆕 New Xtream host auto-registered: ${normalizedHost}`);

    res.json({
      success: true,
      message: 'Host registered for Top 10 service',
      host_id: result.lastInsertRowid
    });

  } catch (error) {
    console.error('Error registering host:', error);
    res.status(500).json({ error: 'Failed to register host' });
  }
});

/**
 * Get list of all registered hosts (for debugging/monitoring)
 * GET /api/top10/hosts
 */
router.get('/hosts', async (req, res) => {
  try {
    const hosts = await db.prepare(`
      SELECT h.id, h.host, h.name, h.is_active, h.last_top10_update, h.created_at,
             (SELECT COUNT(*) FROM top10_cache WHERE host_id = h.id AND type = 'movies') as movies_count,
             (SELECT COUNT(*) FROM top10_cache WHERE host_id = h.id AND type = 'series') as series_count
      FROM xtream_hosts h
      ORDER BY h.created_at DESC
    `).all();

    res.json(hosts);
  } catch (error) {
    console.error('Error fetching hosts:', error);
    res.status(500).json({ error: 'Failed to fetch hosts' });
  }
});

module.exports = router;

