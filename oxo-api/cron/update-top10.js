#!/usr/bin/env node
/**
 * CRON Job: Update Top 10 Content
 * 
 * This script fetches trending movies/series from TMDB,
 * matches them with each Xtream host's catalog,
 * and caches the Top 10 results in the database.
 * 
 * Run this script at 4:00 AM daily:
 * 0 4 * * * node /path/to/update-top10.js
 * 
 * Or manually: node cron/update-top10.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { db, usePostgres } = require('../src/database');
const https = require('https');
const http = require('http');

// TMDB API Configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY || '5b6e64dafb1dbdf34e8907bc1a0417d0';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Make HTTP/HTTPS request
 */
function fetchJson(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response from ${url}`));
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * Get trending movies from TMDB
 */
async function getTmdbTrendingMovies() {
  console.log('📥 Fetching TMDB trending movies...');
  
  const allMovies = [];
  const seenIds = new Set();
  
  try {
    // Get popular movies (2 pages)
    for (let page = 1; page <= 2; page++) {
      const url = `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`;
      const response = await fetchJson(url);
      
      if (response.results) {
        for (const movie of response.results) {
          if (!seenIds.has(movie.id)) {
            seenIds.add(movie.id);
            allMovies.push({
              id: movie.id,
              title: movie.title,
              originalTitle: movie.original_title,
              posterPath: movie.poster_path,
              releaseDate: movie.release_date,
              year: movie.release_date ? movie.release_date.substring(0, 4) : null
            });
          }
        }
      }
    }
    
    console.log(`✅ Got ${allMovies.length} unique movies from TMDB`);
    return allMovies;
  } catch (error) {
    console.error('❌ Error fetching TMDB movies:', error.message);
    return [];
  }
}

/**
 * Get trending series from TMDB
 */
async function getTmdbTrendingSeries() {
  console.log('📥 Fetching TMDB trending series...');
  
  const allSeries = [];
  const seenIds = new Set();
  
  try {
    // Get popular series (2 pages)
    for (let page = 1; page <= 2; page++) {
      const url = `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`;
      const response = await fetchJson(url);
      
      if (response.results) {
        for (const series of response.results) {
          if (!seenIds.has(series.id)) {
            seenIds.add(series.id);
            allSeries.push({
              id: series.id,
              title: series.name,
              originalTitle: series.original_name,
              posterPath: series.poster_path,
              firstAirDate: series.first_air_date,
              year: series.first_air_date ? series.first_air_date.substring(0, 4) : null
            });
          }
        }
      }
    }
    
    console.log(`✅ Got ${allSeries.length} unique series from TMDB`);
    return allSeries;
  } catch (error) {
    console.error('❌ Error fetching TMDB series:', error.message);
    return [];
  }
}

/**
 * Get Xtream catalog for a host
 */
async function getXtreamCatalog(host, username, password) {
  const baseUrl = host.startsWith('http') ? host : `http://${host}`;
  
  console.log(`📥 Fetching Xtream catalog from ${host}...`);
  
  const catalog = {
    movies: [],
    series: []
  };
  
  try {
    // Get VOD categories first
    const vodCategoriesUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_vod_categories`;
    const vodCategories = await fetchJson(vodCategoriesUrl);
    
    if (Array.isArray(vodCategories)) {
      // Get movies for each category (limit to first 10 categories to avoid timeout)
      const categoriesToFetch = vodCategories.slice(0, 10);
      
      for (const category of categoriesToFetch) {
        try {
          const moviesUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_vod_streams&category_id=${category.category_id}`;
          const movies = await fetchJson(moviesUrl);
          
          if (Array.isArray(movies)) {
            catalog.movies.push(...movies);
          }
        } catch (e) {
          // Skip category on error
        }
      }
    }
    
    // Get series categories
    const seriesCategoriesUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_series_categories`;
    const seriesCategories = await fetchJson(seriesCategoriesUrl);
    
    if (Array.isArray(seriesCategories)) {
      // Get series for each category (limit to first 10 categories)
      const categoriesToFetch = seriesCategories.slice(0, 10);
      
      for (const category of categoriesToFetch) {
        try {
          const seriesUrl = `${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_series&category_id=${category.category_id}`;
          const series = await fetchJson(seriesUrl);
          
          if (Array.isArray(series)) {
            catalog.series.push(...series);
          }
        } catch (e) {
          // Skip category on error
        }
      }
    }
    
    console.log(`✅ Got ${catalog.movies.length} movies and ${catalog.series.length} series from ${host}`);
    return catalog;
    
  } catch (error) {
    console.error(`❌ Error fetching Xtream catalog from ${host}:`, error.message);
    return catalog;
  }
}

/**
 * Normalize title for matching
 */
function normalizeTitle(title) {
  if (!title) return '';
  
  return title
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/\s*\(\d{4}\)\s*$/, '') // Remove year in parentheses
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
    .trim();
}

/**
 * Extract year from title
 */
function extractYear(title) {
  const match = title.match(/\((\d{4})\)/);
  return match ? match[1] : null;
}

/**
 * Match TMDB movies with Xtream catalog
 */
function matchMovies(tmdbMovies, xtreamMovies) {
  console.log('🔍 Matching movies...');
  
  // Build index by normalized title + year
  const movieIndex = new Map();
  const movieIndexByTitle = new Map();
  
  for (const movie of xtreamMovies) {
    if (!movie.name) continue;
    
    const normalizedTitle = normalizeTitle(movie.name);
    const year = extractYear(movie.name);
    
    if (normalizedTitle.length >= 3) {
      if (year) {
        const key = `${normalizedTitle}_${year}`;
        if (!movieIndex.has(key)) {
          movieIndex.set(key, movie);
        }
      }
      
      if (!movieIndexByTitle.has(normalizedTitle)) {
        movieIndexByTitle.set(normalizedTitle, []);
      }
      movieIndexByTitle.get(normalizedTitle).push(movie);
    }
  }
  
  const results = [];
  let rank = 1;
  
  for (const tmdb of tmdbMovies) {
    if (rank > 10) break;
    
    const normalizedTmdb = normalizeTitle(tmdb.title);
    const normalizedOriginal = normalizeTitle(tmdb.originalTitle);
    
    // Try exact match with year
    let match = null;
    if (tmdb.year) {
      match = movieIndex.get(`${normalizedTmdb}_${tmdb.year}`) ||
              movieIndex.get(`${normalizedOriginal}_${tmdb.year}`);
    }
    
    // Fallback to title only
    if (!match) {
      const candidates = movieIndexByTitle.get(normalizedTmdb) ||
                         movieIndexByTitle.get(normalizedOriginal);
      if (candidates && candidates.length > 0) {
        match = candidates[0];
      }
    }
    
    if (match) {
      results.push({
        rank: rank++,
        title: tmdb.title + (tmdb.year ? ` (${tmdb.year})` : ''),
        posterUrl: tmdb.posterPath ? `https://image.tmdb.org/t/p/w500${tmdb.posterPath}` : null,
        xtreamId: match.stream_id,
        streamIcon: match.stream_icon,
        cover: null,
        containerExtension: match.container_extension,
        badge: rank <= 3 ? 'Tendance' : null,
        tmdbId: tmdb.id
      });
    }
  }
  
  console.log(`✅ Matched ${results.length} movies`);
  return results;
}

/**
 * Match TMDB series with Xtream catalog
 */
function matchSeries(tmdbSeries, xtreamSeries) {
  console.log('🔍 Matching series...');
  
  // Build index by normalized title + year
  const seriesIndex = new Map();
  const seriesIndexByTitle = new Map();
  
  for (const series of xtreamSeries) {
    if (!series.name) continue;
    
    const normalizedTitle = normalizeTitle(series.name);
    const year = extractYear(series.name);
    
    if (normalizedTitle.length >= 3) {
      if (year) {
        const key = `${normalizedTitle}_${year}`;
        if (!seriesIndex.has(key)) {
          seriesIndex.set(key, series);
        }
      }
      
      if (!seriesIndexByTitle.has(normalizedTitle)) {
        seriesIndexByTitle.set(normalizedTitle, []);
      }
      seriesIndexByTitle.get(normalizedTitle).push(series);
    }
  }
  
  const results = [];
  let rank = 1;
  
  for (const tmdb of tmdbSeries) {
    if (rank > 10) break;
    
    const normalizedTmdb = normalizeTitle(tmdb.title);
    const normalizedOriginal = normalizeTitle(tmdb.originalTitle);
    
    // Try exact match with year
    let match = null;
    if (tmdb.year) {
      match = seriesIndex.get(`${normalizedTmdb}_${tmdb.year}`) ||
              seriesIndex.get(`${normalizedOriginal}_${tmdb.year}`);
    }
    
    // Fallback to title only
    if (!match) {
      const candidates = seriesIndexByTitle.get(normalizedTmdb) ||
                         seriesIndexByTitle.get(normalizedOriginal);
      if (candidates && candidates.length > 0) {
        match = candidates[0];
      }
    }
    
    if (match) {
      results.push({
        rank: rank++,
        title: tmdb.title + (tmdb.year ? ` (${tmdb.year})` : ''),
        posterUrl: tmdb.posterPath ? `https://image.tmdb.org/t/p/w500${tmdb.posterPath}` : null,
        xtreamId: match.series_id,
        streamIcon: null,
        cover: match.cover,
        containerExtension: null,
        badge: rank <= 3 ? 'Tendance' : null,
        tmdbId: tmdb.id
      });
    }
  }
  
  console.log(`✅ Matched ${results.length} series`);
  return results;
}

/**
 * Save Top 10 cache for a host
 */
async function saveTop10Cache(hostId, movies, series) {
  console.log(`💾 Saving Top 10 cache for host ${hostId}...`);
  
  try {
    // Delete existing cache
    await db.prepare('DELETE FROM top10_cache WHERE host_id = ?').run(hostId);
    
    // Insert movies
    for (const movie of movies) {
      await db.prepare(`
        INSERT INTO top10_cache (host_id, type, rank, title, poster_url, xtream_id, stream_icon, cover, container_extension, badge, tmdb_id, updated_at)
        VALUES (?, 'movies', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(hostId, movie.rank, movie.title, movie.posterUrl, movie.xtreamId, movie.streamIcon, movie.cover, movie.containerExtension, movie.badge, movie.tmdbId);
    }
    
    // Insert series
    for (const s of series) {
      await db.prepare(`
        INSERT INTO top10_cache (host_id, type, rank, title, poster_url, xtream_id, stream_icon, cover, container_extension, badge, tmdb_id, updated_at)
        VALUES (?, 'series', ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(hostId, s.rank, s.title, s.posterUrl, s.xtreamId, s.streamIcon, s.cover, s.containerExtension, s.badge, s.tmdbId);
    }
    
    // Update host last_top10_update
    await db.prepare('UPDATE xtream_hosts SET last_top10_update = CURRENT_TIMESTAMP WHERE id = ?').run(hostId);
    
    console.log(`✅ Saved ${movies.length} movies and ${series.length} series for host ${hostId}`);
  } catch (error) {
    console.error(`❌ Error saving Top 10 cache for host ${hostId}:`, error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🎬 OXO Player - Top 10 Update CRON Job');
  console.log('  📅 ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════');
  
  try {
    // Initialize database
    await db.init ? await db.init() : null;
    
    // Get all active hosts with test credentials
    const isActiveTrue = usePostgres ? 'TRUE' : '1';
    const hosts = await db.prepare(`
      SELECT id, host, name, test_username, test_password 
      FROM xtream_hosts 
      WHERE is_active = ${isActiveTrue} 
        AND test_username IS NOT NULL 
        AND test_password IS NOT NULL
    `).all();
    
    console.log(`\n📋 Found ${hosts.length} active hosts with credentials\n`);
    
    if (hosts.length === 0) {
      console.log('⚠️ No hosts to process. Add hosts with test credentials in admin panel.');
      return;
    }
    
    // Get TMDB trending content (same for all hosts)
    const tmdbMovies = await getTmdbTrendingMovies();
    const tmdbSeries = await getTmdbTrendingSeries();
    
    if (tmdbMovies.length === 0 && tmdbSeries.length === 0) {
      console.log('⚠️ Could not fetch TMDB data. Aborting.');
      return;
    }
    
    // Process each host
    for (const host of hosts) {
      console.log(`\n───────────────────────────────────────────────────────`);
      console.log(`🏠 Processing host: ${host.name} (${host.host})`);
      console.log(`───────────────────────────────────────────────────────`);
      
      try {
        // Get Xtream catalog
        const catalog = await getXtreamCatalog(host.host, host.test_username, host.test_password);
        
        if (catalog.movies.length === 0 && catalog.series.length === 0) {
          console.log(`⚠️ Empty catalog for ${host.host}. Skipping.`);
          continue;
        }
        
        // Match with TMDB
        const matchedMovies = matchMovies(tmdbMovies, catalog.movies);
        const matchedSeries = matchSeries(tmdbSeries, catalog.series);
        
        // Save to cache
        await saveTop10Cache(host.id, matchedMovies, matchedSeries);
        
      } catch (error) {
        console.error(`❌ Error processing ${host.host}:`, error.message);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ Top 10 Update Complete!');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main };

