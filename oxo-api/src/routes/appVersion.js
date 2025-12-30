/**
 * App Version Routes - OTA Update System
 * 
 * Endpoints:
 * - GET /check?versionCode=X : Check for updates (Android app)
 * - GET / : List all versions (Admin panel)
 * - POST / : Create new version (Admin panel)
 * - DELETE /:id : Delete version (Admin panel)
 */

const express = require('express');
const { db, usePostgres } = require('../database');
const { verifyToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Check for updates - Called by Android app
 * Public endpoint (no auth required)
 * 
 * Query params:
 * - versionCode: Current app version code (integer)
 * 
 * Returns:
 * - updateAvailable: boolean
 * - latestVersion: version info if update available
 * - isMandatory: true if user MUST update
 */
router.get('/check', async (req, res) => {
  try {
    const { versionCode } = req.query;

    if (!versionCode) {
      return res.status(400).json({ error: 'versionCode parameter required' });
    }

    const currentVersion = parseInt(versionCode, 10);

    if (isNaN(currentVersion)) {
      return res.status(400).json({ error: 'Invalid versionCode' });
    }

    // Get latest version
    const latestVersion = await db.prepare(`
      SELECT * FROM app_versions 
      ORDER BY version_code DESC 
      LIMIT 1
    `).get();

    if (!latestVersion) {
      return res.json({
        updateAvailable: false,
        message: 'No versions published yet'
      });
    }

    // Check if update is available
    const updateAvailable = latestVersion.version_code > currentVersion;

    if (!updateAvailable) {
      return res.json({
        updateAvailable: false,
        currentVersion: currentVersion,
        latestVersionCode: latestVersion.version_code,
        message: 'App is up to date'
      });
    }

    // Check if update is mandatory
    // Mandatory if: is_mandatory flag is true OR current version < min_supported_version
    const isMandatory = !!(
      latestVersion.is_mandatory || 
      (latestVersion.min_supported_version && currentVersion < latestVersion.min_supported_version)
    );

    res.json({
      updateAvailable: true,
      isMandatory,
      currentVersion: currentVersion,
      latestVersion: {
        versionCode: latestVersion.version_code,
        versionName: latestVersion.version_name,
        downloadUrl: latestVersion.download_url,
        changelog: latestVersion.changelog || '',
        minSupportedVersion: latestVersion.min_supported_version
      }
    });

  } catch (error) {
    console.error('Error checking for updates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * List all versions - Admin panel
 * Requires admin authentication
 */
router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const versions = await db.prepare(`
      SELECT 
        id,
        version_code as "versionCode",
        version_name as "versionName",
        download_url as "downloadUrl",
        changelog,
        is_mandatory as "isMandatory",
        min_supported_version as "minSupportedVersion",
        created_at as "createdAt"
      FROM app_versions 
      ORDER BY version_code DESC
    `).all();

    // Convert is_mandatory to boolean for SQLite
    const formattedVersions = versions.map(v => ({
      ...v,
      isMandatory: usePostgres ? v.isMandatory : !!v.isMandatory
    }));

    res.json({ versions: formattedVersions });

  } catch (error) {
    console.error('Error listing versions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create new version - Admin panel
 * Requires admin authentication
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { versionCode, versionName, downloadUrl, changelog, isMandatory, minSupportedVersion } = req.body;

    // Validation
    if (!versionCode || !versionName || !downloadUrl) {
      return res.status(400).json({ 
        error: 'versionCode, versionName and downloadUrl are required' 
      });
    }

    if (!downloadUrl.startsWith('https://')) {
      return res.status(400).json({ 
        error: 'downloadUrl must start with https://' 
      });
    }

    // Check if version code already exists
    const existing = await db.prepare(
      'SELECT id FROM app_versions WHERE version_code = ?'
    ).get(versionCode);

    if (existing) {
      return res.status(400).json({ 
        error: `Version code ${versionCode} already exists` 
      });
    }

    // Insert new version
    const mandatoryValue = usePostgres ? !!isMandatory : (isMandatory ? 1 : 0);

    const result = await db.prepare(`
      INSERT INTO app_versions (version_code, version_name, download_url, changelog, is_mandatory, min_supported_version)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      versionCode,
      versionName,
      downloadUrl,
      changelog || null,
      mandatoryValue,
      minSupportedVersion || null
    );

    console.log(`✅ New app version created: v${versionName} (code: ${versionCode})`);

    res.status(201).json({
      success: true,
      message: `Version ${versionName} created successfully`,
      id: result.lastInsertRowid
    });

  } catch (error) {
    console.error('Error creating version:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete version - Admin panel
 * Requires admin authentication
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if version exists
    const version = await db.prepare(
      'SELECT * FROM app_versions WHERE id = ?'
    ).get(id);

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Delete version
    await db.prepare('DELETE FROM app_versions WHERE id = ?').run(id);

    console.log(`🗑️ App version deleted: v${version.version_name} (id: ${id})`);

    res.json({
      success: true,
      message: `Version ${version.version_name} deleted`
    });

  } catch (error) {
    console.error('Error deleting version:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

