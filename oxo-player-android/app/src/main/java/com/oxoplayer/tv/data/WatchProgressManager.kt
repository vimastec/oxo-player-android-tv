package com.oxoplayer.tv.data

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Manager to save and retrieve watch progress for movies and series
 * Also tracks recently watched live TV channels
 * Allows users to resume playback from where they left off
 * 
 * PROFILE SUPPORT: Each profile has its own separate watch progress
 */
object WatchProgressManager {
    
    private const val PREFS_NAME = "oxo_watch_progress"
    private const val KEY_PROGRESS_MAP = "progress_map"
    private const val KEY_RECENT_CHANNELS = "recent_channels"
    
    // Minimum progress to save (10 seconds)
    private const val MIN_PROGRESS_TO_SAVE_MS = 10_000L
    
    // Consider video "finished" if less than 5 minutes remaining or 95% watched
    private const val FINISHED_THRESHOLD_MS = 5 * 60 * 1000L // 5 minutes
    private const val FINISHED_THRESHOLD_PERCENT = 0.95f
    
    // Maximum number of recent channels to keep
    private const val MAX_RECENT_CHANNELS = 10
    
    private var prefs: SharedPreferences? = null
    private val gson = Gson()
    
    // Current profile ID (null = default/legacy)
    private var currentProfileId: String? = null
    
    // In-memory cache
    private var progressCache: MutableMap<String, WatchProgress> = mutableMapOf()
    private var recentChannelsCache: MutableList<RecentChannel> = mutableListOf()
    
    data class WatchProgress(
        val url: String,
        val title: String,
        val positionMs: Long,
        val durationMs: Long,
        val lastWatched: Long = System.currentTimeMillis(),
        val type: String, // "MOVIE" or "SERIES" or "LIVE"
        val cover: String? = null, // Optional cover image URL
        // Series-specific metadata (null for movies/live)
        val seriesId: String? = null,
        val seriesName: String? = null,
        val seasonNumber: Int? = null,
        val episodeId: String? = null,
        val seasonsJson: String? = null // JSON string of all seasons for episode navigation
    ) {
        val progressPercent: Float
            get() = if (durationMs > 0) positionMs.toFloat() / durationMs else 0f
            
        val isFinished: Boolean
            get() = progressPercent >= FINISHED_THRESHOLD_PERCENT || 
                   (durationMs - positionMs) < FINISHED_THRESHOLD_MS
    }
    
    /**
     * Data class for recently watched live TV channels
     */
    data class RecentChannel(
        val url: String,
        val name: String,
        val logo: String?,
        val category: String?,
        val lastWatched: Long = System.currentTimeMillis()
    )
    
    /**
     * Initialize the manager with context
     * Should be called once at app startup
     */
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        loadFromPrefs()
        loadRecentChannelsFromPrefs()
    }
    
    /**
     * Set current profile - reloads data for this profile
     */
    fun setCurrentProfile(profileId: String?) {
        if (currentProfileId != profileId) {
            currentProfileId = profileId
            // Reload data for the new profile
            loadFromPrefs()
            loadRecentChannelsFromPrefs()
            android.util.Log.d("WatchProgress", "Switched to profile: $profileId")
        }
    }
    
    /**
     * Get the current profile ID
     */
    fun getCurrentProfileId(): String? = currentProfileId
    
    /**
     * Clear all progress for a specific profile (used when deleting profile)
     */
    fun clearAllProgressForProfile(profileId: String) {
        val progressKey = getProfileKey(KEY_PROGRESS_MAP, profileId)
        val channelsKey = getProfileKey(KEY_RECENT_CHANNELS, profileId)
        
        prefs?.edit()
            ?.remove(progressKey)
            ?.remove(channelsKey)
            ?.apply()
        
        // If this is the current profile, clear cache too
        if (currentProfileId == profileId) {
            progressCache.clear()
            recentChannelsCache.clear()
        }
        
        android.util.Log.d("WatchProgress", "Cleared all data for profile: $profileId")
    }
    
    /**
     * Generate profile-specific key
     */
    private fun getProfileKey(baseKey: String, profileId: String? = currentProfileId): String {
        return if (profileId != null) {
            "${profileId}_$baseKey"
        } else {
            baseKey // Legacy/default key
        }
    }
    
    /**
     * Save watch progress for a video
     * @param url The stream URL (used as unique identifier)
     * @param title The video title
     * @param positionMs Current playback position in milliseconds
     * @param durationMs Total video duration in milliseconds
     * @param type "MOVIE" or "SERIES"
     * @param cover Optional cover image URL
     */
    fun saveProgress(
        url: String,
        title: String,
        positionMs: Long,
        durationMs: Long,
        type: String,
        cover: String? = null,
        seriesId: String? = null,
        seriesName: String? = null,
        seasonNumber: Int? = null,
        episodeId: String? = null,
        seasonsJson: String? = null
    ) {
        // Don't save if position is too early
        if (positionMs < MIN_PROGRESS_TO_SAVE_MS) {
            android.util.Log.d("WatchProgress", "Position too early, not saving: $positionMs ms")
            return
        }
        
        val progress = WatchProgress(
            url = url,
            title = title,
            positionMs = positionMs,
            durationMs = durationMs,
            type = type,
            cover = cover,
            seriesId = seriesId,
            seriesName = seriesName,
            seasonNumber = seasonNumber,
            episodeId = episodeId,
            seasonsJson = seasonsJson
        )
        
        // If video is finished, remove progress instead of saving
        if (progress.isFinished) {
            android.util.Log.d("WatchProgress", "Video finished, removing progress for: $title")
            removeProgress(url)
            return
        }
        
        progressCache[url] = progress
        saveToPrefs()
        
        android.util.Log.d("WatchProgress", "Saved progress for '$title': ${formatTime(positionMs)} / ${formatTime(durationMs)} (${(progress.progressPercent * 100).toInt()}%)")
    }
    
    /**
     * Get saved progress for a video
     * @param url The stream URL
     * @return WatchProgress or null if no progress saved
     */
    fun getProgress(url: String): WatchProgress? {
        return progressCache[url]
    }
    
    /**
     * Check if there's saved progress for a video
     */
    fun hasProgress(url: String): Boolean {
        val progress = progressCache[url]
        return progress != null && !progress.isFinished
    }
    
    /**
     * Get the resume position for a video
     * @param url The stream URL
     * @return Position in milliseconds, or 0 if no saved progress
     */
    fun getResumePosition(url: String): Long {
        val progress = progressCache[url]
        return if (progress != null && !progress.isFinished) {
            // Go back 5 seconds from saved position for context
            maxOf(0L, progress.positionMs - 5000L)
        } else {
            0L
        }
    }
    
    /**
     * Remove progress for a video (e.g., when finished watching)
     */
    fun removeProgress(url: String) {
        progressCache.remove(url)
        saveToPrefs()
    }
    
    /**
     * Get all saved progress entries
     * Useful for displaying "Continue Watching" section
     */
    fun getAllProgress(): List<WatchProgress> {
        return progressCache.values
            .filter { !it.isFinished }
            .sortedByDescending { it.lastWatched }
    }
    
    /**
     * Clear all saved progress
     */
    fun clearAll() {
        progressCache.clear()
        recentChannelsCache.clear()
        saveToPrefs()
        saveRecentChannelsToPrefs()
    }
    
    // ==================== Recent Channels Methods ====================
    
    /**
     * Add a channel to recent watch history
     */
    fun addRecentChannel(url: String, name: String, logo: String?, category: String?) {
        // Remove if already exists to avoid duplicates
        recentChannelsCache.removeAll { it.url == url }
        
        // Add to the beginning of the list
        recentChannelsCache.add(0, RecentChannel(
            url = url,
            name = name,
            logo = logo,
            category = category
        ))
        
        // Keep only the last MAX_RECENT_CHANNELS
        if (recentChannelsCache.size > MAX_RECENT_CHANNELS) {
            recentChannelsCache = recentChannelsCache.take(MAX_RECENT_CHANNELS).toMutableList()
        }
        
        saveRecentChannelsToPrefs()
        android.util.Log.d("WatchProgress", "Added recent channel: $name (total: ${recentChannelsCache.size})")
    }
    
    /**
     * Get all recently watched channels
     * @param limit Maximum number of channels to return
     */
    fun getRecentChannels(limit: Int = 5): List<RecentChannel> {
        return recentChannelsCache.take(limit)
    }
    
    /**
     * Get recently watched movies (in progress)
     * @param limit Maximum number of movies to return
     */
    fun getRecentMovies(limit: Int = 5): List<WatchProgress> {
        return progressCache.values
            .filter { it.type == "MOVIE" && !it.isFinished }
            .sortedByDescending { it.lastWatched }
            .take(limit)
    }
    
    /**
     * Get recently watched series (in progress)
     * @param limit Maximum number of series to return
     */
    fun getRecentSeries(limit: Int = 5): List<WatchProgress> {
        return progressCache.values
            .filter { it.type == "SERIES" && !it.isFinished }
            .sortedByDescending { it.lastWatched }
            .take(limit)
    }
    
    /**
     * Check if there's any "continue watching" content
     */
    fun hasContinueWatchingContent(): Boolean {
        return progressCache.values.any { !it.isFinished } || recentChannelsCache.isNotEmpty()
    }
    
    // ==================== Private Methods ====================
    
    private fun loadFromPrefs() {
        val key = getProfileKey(KEY_PROGRESS_MAP)
        val json = prefs?.getString(key, null)
        progressCache = if (json != null) {
            try {
                val type = object : TypeToken<MutableMap<String, WatchProgress>>() {}.type
                gson.fromJson(json, type) ?: mutableMapOf()
            } catch (e: Exception) {
                android.util.Log.e("WatchProgress", "Error loading progress", e)
                mutableMapOf()
            }
        } else {
            mutableMapOf()
        }
        android.util.Log.d("WatchProgress", "Loaded ${progressCache.size} saved progress entries for profile: $currentProfileId")
    }
    
    private fun saveToPrefs() {
        try {
            val key = getProfileKey(KEY_PROGRESS_MAP)
            val json = gson.toJson(progressCache)
            prefs?.edit()?.putString(key, json)?.apply()
        } catch (e: Exception) {
            android.util.Log.e("WatchProgress", "Error saving progress", e)
        }
    }
    
    private fun loadRecentChannelsFromPrefs() {
        val key = getProfileKey(KEY_RECENT_CHANNELS)
        val json = prefs?.getString(key, null)
        recentChannelsCache = if (json != null) {
            try {
                val type = object : TypeToken<MutableList<RecentChannel>>() {}.type
                gson.fromJson(json, type) ?: mutableListOf()
            } catch (e: Exception) {
                android.util.Log.e("WatchProgress", "Error loading recent channels", e)
                mutableListOf()
            }
        } else {
            mutableListOf()
        }
        android.util.Log.d("WatchProgress", "Loaded ${recentChannelsCache.size} recent channels for profile: $currentProfileId")
    }
    
    private fun saveRecentChannelsToPrefs() {
        try {
            val key = getProfileKey(KEY_RECENT_CHANNELS)
            val json = gson.toJson(recentChannelsCache)
            prefs?.edit()?.putString(key, json)?.apply()
        } catch (e: Exception) {
            android.util.Log.e("WatchProgress", "Error saving recent channels", e)
        }
    }
    
    /**
     * Format time in milliseconds to readable string (e.g., "1h 32min")
     */
    fun formatTime(ms: Long): String {
        val totalSeconds = ms / 1000
        val hours = totalSeconds / 3600
        val minutes = (totalSeconds % 3600) / 60
        val seconds = totalSeconds % 60
        
        return when {
            hours > 0 -> "${hours}h ${minutes}min"
            minutes > 0 -> "${minutes}min ${seconds}s"
            else -> "${seconds}s"
        }
    }
}

