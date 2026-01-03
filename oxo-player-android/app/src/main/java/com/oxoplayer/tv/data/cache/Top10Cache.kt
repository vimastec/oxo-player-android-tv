package com.oxoplayer.tv.data.cache

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.oxoplayer.tv.data.models.XtreamMovie
import com.oxoplayer.tv.data.models.XtreamSeries

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
 * Persistent cache for Top 10 data to speed up loading
 */
object Top10Cache {
    private const val PREFS_NAME = "top10_cache"
    private const val KEY_MOVIES = "cached_movies"
    private const val KEY_SERIES = "cached_series"
    private const val KEY_TOP10_MOVIES = "top10_movies_result"
    private const val KEY_TOP10_SERIES = "top10_series_result"
    private const val KEY_LAST_UPDATE = "last_update"
    private const val KEY_TOP10_LAST_UPDATE = "top10_last_update"
    private const val CACHE_DURATION_MS = 6 * 60 * 60 * 1000L // 6 hours
    private const val TOP10_CACHE_DURATION_MS = 1 * 60 * 60 * 1000L // 1 hour for Top 10 results
    
    private val gson = Gson()
    private var prefs: SharedPreferences? = null
    
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    
    /**
     * Check if Xtream data cache is valid (not expired)
     */
    fun isCacheValid(): Boolean {
        val lastUpdate = prefs?.getLong(KEY_LAST_UPDATE, 0L) ?: 0L
        val isValid = System.currentTimeMillis() - lastUpdate < CACHE_DURATION_MS
        android.util.Log.d("Top10Cache", "Xtream cache valid: $isValid (age: ${(System.currentTimeMillis() - lastUpdate) / 1000 / 60} minutes)")
        return isValid
    }
    
    /**
     * Check if Top 10 results cache is valid
     */
    fun isTop10CacheValid(): Boolean {
        val lastUpdate = prefs?.getLong(KEY_TOP10_LAST_UPDATE, 0L) ?: 0L
        val isValid = System.currentTimeMillis() - lastUpdate < TOP10_CACHE_DURATION_MS
        android.util.Log.d("Top10Cache", "Top10 results cache valid: $isValid (age: ${(System.currentTimeMillis() - lastUpdate) / 1000 / 60} minutes)")
        return isValid
    }
    
    /**
     * Save Top 10 movies results (final matched list)
     */
    fun saveTop10Movies(items: List<CachedTop10Item>) {
        try {
            val json = gson.toJson(items)
            prefs?.edit()?.apply {
                putString(KEY_TOP10_MOVIES, json)
                putLong(KEY_TOP10_LAST_UPDATE, System.currentTimeMillis())
                apply()
            }
            android.util.Log.d("Top10Cache", "💾 Saved ${items.size} Top 10 movies results")
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
     * Save Top 10 series results (final matched list)
     */
    fun saveTop10Series(items: List<CachedTop10Item>) {
        try {
            val json = gson.toJson(items)
            prefs?.edit()?.apply {
                putString(KEY_TOP10_SERIES, json)
                apply()
            }
            android.util.Log.d("Top10Cache", "💾 Saved ${items.size} Top 10 series results")
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
     * Save all movies to cache
     */
    fun saveMovies(movies: List<XtreamMovie>) {
        try {
            val json = gson.toJson(movies)
            prefs?.edit()?.apply {
                putString(KEY_MOVIES, json)
                putLong(KEY_LAST_UPDATE, System.currentTimeMillis())
                apply()
            }
            android.util.Log.d("Top10Cache", "Saved ${movies.size} movies to cache")
        } catch (e: Exception) {
            android.util.Log.e("Top10Cache", "Error saving movies to cache", e)
        }
    }
    
    /**
     * Load movies from cache
     */
    fun loadMovies(): List<XtreamMovie>? {
        return try {
            val json = prefs?.getString(KEY_MOVIES, null)
            if (json != null) {
                val type = object : TypeToken<List<XtreamMovie>>() {}.type
                val movies: List<XtreamMovie> = gson.fromJson(json, type)
                android.util.Log.d("Top10Cache", "Loaded ${movies.size} movies from cache")
                movies
            } else {
                null
            }
        } catch (e: Exception) {
            android.util.Log.e("Top10Cache", "Error loading movies from cache", e)
            null
        }
    }
    
    /**
     * Save all series to cache
     */
    fun saveSeries(series: List<XtreamSeries>) {
        try {
            val json = gson.toJson(series)
            prefs?.edit()?.apply {
                putString(KEY_SERIES, json)
                apply()
            }
            android.util.Log.d("Top10Cache", "Saved ${series.size} series to cache")
        } catch (e: Exception) {
            android.util.Log.e("Top10Cache", "Error saving series to cache", e)
        }
    }
    
    /**
     * Load series from cache
     */
    fun loadSeries(): List<XtreamSeries>? {
        return try {
            val json = prefs?.getString(KEY_SERIES, null)
            if (json != null) {
                val type = object : TypeToken<List<XtreamSeries>>() {}.type
                val series: List<XtreamSeries> = gson.fromJson(json, type)
                android.util.Log.d("Top10Cache", "Loaded ${series.size} series from cache")
                series
            } else {
                null
            }
        } catch (e: Exception) {
            android.util.Log.e("Top10Cache", "Error loading series from cache", e)
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