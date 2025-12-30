const express = require('express');
const router = express.Router();
const { db, usePostgres } = require('../database');
const { verifyToken, isAdmin } = require('../middleware/auth');

// ============================================
// PUBLIC ENDPOINT - Get latest app version
// ============================================
router.get('/latest', async (req, res) => {
  try {
    const version = await db.prepare(`
      SELECT version_code, version_name, download_url, changelog, is_mandatory, min_supported_version, created_at
      FROM app_versions
      ORDER BY version_code DESC
      LIMIT 1
    `).get();

    if (!version) {
      return res.json({
        success: true,
        hasUpdate: false,
        message: 'No version available'
      });
    }

    res.json({
      success: true,
      hasUpdate: true,
      version: {
        versionCode: version.version_code,
        versionName: version.version_name,
        downloadUrl: version.download_url,
        changelog: version.changelog,
        isMandatory: version.is_mandatory === 1 || version.is_mandatory === true,
        minSupportedVersion: version.min_supported_version,
        releaseDate: version.created_at
      }
    });
  } catch (err) {
    console.error('Error fetching app version:', err);
    res.status(500).json({ error: 'Failed to fetch app version' });
  }
});

// ============================================
// PUBLIC ENDPOINT - Check for update
// ============================================
router.get('/check', async (req, res) => {
  try {
    const { currentVersion } = req.query;

    if (!currentVersion) {
      return res.status(400).json({ error: 'currentVersion parameter required' });
    }

    const currentVersionCode = parseInt(currentVersion, 10);

    const latestVersion = await db.prepare(`
      SELECT version_code, version_name, download_url, changelog, is_mandatory, min_supported_version, created_at
      FROM app_versions
      ORDER BY version_code DESC
      LIMIT 1
    `).get();

    if (!latestVersion) {
      return res.json({
        success: true,
        hasUpdate: false,
        message: 'No version available'
      });
    }

    const hasUpdate = latestVersion.version_code > currentVersionCode;
    const isMandatory = hasUpdate && (
      (latestVersion.is_mandatory === 1 || latestVersion.is_mandatory === true) ||
      (latestVersion.min_supported_version && currentVersionCode < latestVersion.min_supported_version)
    );

    res.json({
      success: true,
      hasUpdate,
      isMandatory,
      currentVersionCode,
      latestVersion: hasUpdate ? {
        versionCode: latestVersion.version_code,
        versionName: latestVersion.version_name,
        downloadUrl: latestVersion.download_url,
        changelog: latestVersion.changelog,
        isMandatory: latestVersion.is_mandatory === 1 || latestVersion.is_mandatory === true,
        minSupportedVersion: latestVersion.min_supported_version,
        releaseDate: latestVersion.created_at
      } : null
    });
  } catch (err) {
    console.error('Error checking app version:', err);
    res.status(500).json({ error: 'Failed to check app version' });
  }
});

// ============================================
// ADMIN ENDPOINT - Create new version
// ============================================
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { versionCode, versionName, downloadUrl, changelog, isMandatory, minSupportedVersion } = req.body;

    if (!versionCode || !versionName || !downloadUrl) {
      return res.status(400).json({ error: 'versionCode, versionName and downloadUrl are required' });
    }

    // Check if version already exists
    const existing = await db.prepare('SELECT id FROM app_versions WHERE version_code = ?').get(versionCode);
    if (existing) {
      return res.status(400).json({ error: 'Version code already exists' });
    }

    await db.prepare(`
      INSERT INTO app_versions (version_code, version_name, download_url, changelog, is_mandatory, min_supported_version)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      versionCode,
      versionName,
      downloadUrl,
      changelog || '',
      isMandatory ? 1 : 0,
      minSupportedVersion || null
    );

    res.json({
      success: true,
      message: 'Version created successfully'
    });
  } catch (err) {
    console.error('Error creating app version:', err);
    res.status(500).json({ error: 'Failed to create app version' });
  }
});

// ============================================
// ADMIN ENDPOINT - Get all versions
// ============================================
router.get('/all', verifyToken, isAdmin, async (req, res) => {
  try {
    const versions = await db.prepare(`
      SELECT id, version_code, version_name, download_url, changelog, is_mandatory, min_supported_version, created_at
      FROM app_versions
      ORDER BY version_code DESC
    `).all();

    res.json({
      success: true,
      versions: versions.map(v => ({
        id: v.id,
        versionCode: v.version_code,
        versionName: v.version_name,
        downloadUrl: v.download_url,
        changelog: v.changelog,
        isMandatory: v.is_mandatory === 1 || v.is_mandatory === true,
        minSupportedVersion: v.min_supported_version,
        createdAt: v.created_at
      }))
    });
  } catch (err) {
    console.error('Error fetching all versions:', err);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// ============================================
// ADMIN ENDPOINT - Delete version
// ============================================
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await db.prepare('DELETE FROM app_versions WHERE id = ?').run(id);

    res.json({
      success: true,
      message: 'Version deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting app version:', err);
    res.status(500).json({ error: 'Failed to delete app version' });
  }
});

module.exports = router;

