package com.oxoplayer.tv.data.cache

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Data class for cached Top 10 items (final results)
 * Contains all data needed for navigation without needing to load Xtream data
 */
data class CachedTop10Item(
    val rank: Int,
    val title: String,
    val posterUrl: String?,
    val xtreamId: Int,
    val isMovie: Boolean,
    val badge: String?,
    // Extra data for direct navigation (no need to search in Xtream cache)
    val streamIcon: String? = null,      // For movies
    val cover: String? = null,           // For series
    val containerExtension: String? = null // For movies (mp4, mkv, etc.)
)

/**
 * Persistent cache for Top 10 results only (not full Xtream data)
 * This avoids OutOfMemoryError when trying to cache thousands of movies/series
 */
object Top10Cache {
    private const val PREFS_NAME = "top10_cache"
    private const val KEY_TOP10_MOVIES = "top10_movies_result"
    private const val KEY_TOP10_SERIES = "top10_series_result"
    private const val KEY_TOP10_LAST_UPDATE = "top10_last_update"
    private const val TOP10_CACHE_DURATION_MS = 24 * 60 * 60 * 1000L // 24 hours
    
    private val gson = Gson()
    private var prefs: SharedPreferences? = null
    
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    
    /**
     * Check if Top 10 results cache is valid
     */
    fun isTop10CacheValid(): Boolean {
        val lastUpdate = prefs?.getLong(KEY_TOP10_LAST_UPDATE, 0L) ?: 0L
        val isValid = System.currentTimeMillis() - lastUpdate < TOP10_CACHE_DURATION_MS
        android.util.Log.d("Top10Cache", "Top10 cache valid: $isValid (age: ${(System.currentTimeMillis() - lastUpdate) / 1000 / 60} minutes)")
        return isValid
    }
    
    /**
     * Save Top 10 movies results (max 10 items - safe for memory)
     */
    fun saveTop10Movies(items: List<CachedTop10Item>) {
        try {
            val json = gson.toJson(items.take(10))
            prefs?.edit()?.apply {
                putString(KEY_TOP10_MOVIES, json)
                putLong(KEY_TOP10_LAST_UPDATE, System.currentTimeMillis())
                apply()
            }
            android.util.Log.d("Top10Cache", "💾 Saved ${items.size} Top 10 movies")
        } catch (e: Exception) {
            android.util.Log.e("Top10Cache", "Error saving Top 10 movies", e)
        }
    }
    
    /**
     * Load Top 10 movies results
     */
    fun loadTop10Movies(): List<CachedTop10Item>? {
        return try {
            val json = prefs?.getString(KEY_TOP10_MOVIES, null)
            if (json != null) {
                val type = object : TypeToken<List<CachedTop10Item>>() {}.type
                val items: List<CachedTop10Item> = gson.fromJson(json, type)
                android.util.Log.d("Top10Cache", "✅ Loaded ${items.size} Top 10 movies from cache")
                items
            } else null
        } catch (e: Exception) {
            android.util.Log.e("Top10Cache", "Error loading Top 10 movies", e)
            null
        }
    }
    
    /**
     * Save Top 10 series results (max 10 items - safe for memory)
     */
    fun saveTop10Series(items: List<CachedTop10Item>) {
        try {
            val json = gson.toJson(items.take(10))
            prefs?.edit()?.apply {
                putString(KEY_TOP10_SERIES, json)
                apply()
            }
            android.util.Log.d("Top10Cache", "💾 Saved ${items.size} Top 10 series")
        } catch (e: Exception) {
            android.util.Log.e("Top10Cache", "Error saving Top 10 series", e)
        }
    }
    
    /**
     * Load Top 10 series results
     */
    fun loadTop10Series(): List<CachedTop10Item>? {
        return try {
            val json = prefs?.getString(KEY_TOP10_SERIES, null)
            if (json != null) {
                val type = object : TypeToken<List<CachedTop10Item>>() {}.type
                val items: List<CachedTop10Item> = gson.fromJson(json, type)
                android.util.Log.d("Top10Cache", "✅ Loaded ${items.size} Top 10 series from cache")
                items
            } else null
        } catch (e: Exception) {
            android.util.Log.e("Top10Cache", "Error loading Top 10 series", e)
            null
        }
    }
    
    /**
     * Clear cache
     */
    fun clearCache() {
        prefs?.edit()?.clear()?.apply()
        android.util.Log.d("Top10Cache", "Cache cleared")
    }
}