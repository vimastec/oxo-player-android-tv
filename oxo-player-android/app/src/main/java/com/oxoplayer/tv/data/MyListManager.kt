package com.oxoplayer.tv.data

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Manager to save and retrieve user's "My List" (watchlist)
 * Similar to Netflix's "My List" feature
 * 
 * PROFILE SUPPORT: Each profile has its own separate list
 */
object MyListManager {
    
    private const val PREFS_NAME = "oxo_my_list"
    private const val KEY_MY_LIST = "my_list"
    
    private var prefs: SharedPreferences? = null
    private val gson = Gson()
    
    // Current profile ID (null = default/legacy)
    private var currentProfileId: String? = null
    
    // Current playlist ID (to separate MyList per playlist)
    private var currentPlaylistId: Int? = null
    
    // In-memory cache
    private var myListCache: MutableList<MyListItem> = mutableListOf()
    
    /**
     * Data class for My List items
     */
    data class MyListItem(
        val id: String,              // Unique ID (stream_id or series_id)
        val title: String,
        val cover: String?,          // Cover/poster image URL
        val type: String,            // "MOVIE" or "SERIES"
        val addedAt: Long = System.currentTimeMillis(),
        // Movie-specific
        val streamId: Int? = null,
        val containerExtension: String? = null,
        // Series-specific
        val seriesId: Int? = null,
        val rating: String? = null,
        val plot: String? = null
    )
    
    /**
     * Initialize the manager with context
     * Should be called once at app startup
     */
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        loadFromPrefs()
    }
    
    /**
     * Set current profile - reloads data for this profile
     */
    fun setCurrentProfile(profileId: String?) {
        if (currentProfileId != profileId) {
            currentProfileId = profileId
            loadFromPrefs()
            android.util.Log.d("MyListManager", "Switched to profile: $profileId, playlist: $currentPlaylistId")
        }
    }
    
    /**
     * Set current playlist - reloads data for this playlist
     * MyList is now tied to both profile AND playlist
     */
    fun setCurrentPlaylist(playlistId: Int?) {
        if (currentPlaylistId != playlistId) {
            currentPlaylistId = playlistId
            loadFromPrefs()
            android.util.Log.d("MyListManager", "Switched to playlist: $playlistId, profile: $currentProfileId")
        }
    }
    
    /**
     * Get the current profile ID
     */
    fun getCurrentProfileId(): String? = currentProfileId
    
    /**
     * Get the current playlist ID
     */
    fun getCurrentPlaylistId(): Int? = currentPlaylistId
    
    /**
     * Clear all items for a specific profile (used when deleting profile)
     */
    fun clearAllForProfile(profileId: String) {
        val key = getProfileKey(KEY_MY_LIST, profileId)
        prefs?.edit()?.remove(key)?.apply()
        
        if (currentProfileId == profileId) {
            myListCache.clear()
        }
        
        android.util.Log.d("MyListManager", "Cleared My List for profile: $profileId")
    }
    
    /**
     * Generate profile and playlist-specific key
     * Format: {profileId}_{playlistId}_{baseKey} or {profileId}_{baseKey} or {baseKey}
     */
    private fun getProfileKey(baseKey: String, profileId: String? = currentProfileId): String {
        val playlistPart = currentPlaylistId?.let { "playlist${it}_" } ?: ""
        val profilePart = profileId?.let { "${it}_" } ?: ""
        return "$profilePart$playlistPart$baseKey"
    }
    
    /**
     * Add a movie to My List
     */
    fun addMovie(
        streamId: Int,
        title: String,
        cover: String?,
        containerExtension: String? = null,
        plot: String? = null
    ) {
        val id = "movie_$streamId"
        
        // Check if already exists
        if (myListCache.any { it.id == id }) {
            android.util.Log.d("MyListManager", "Movie already in list: $title")
            return
        }
        
        val item = MyListItem(
            id = id,
            title = title,
            cover = cover,
            type = "MOVIE",
            streamId = streamId,
            containerExtension = containerExtension,
            plot = plot
        )
        
        myListCache.add(0, item) // Add to beginning
        saveToPrefs()
        
        android.util.Log.d("MyListManager", "Added movie to My List: $title")
    }
    
    /**
     * Add a series to My List
     */
    fun addSeries(
        seriesId: Int,
        title: String,
        cover: String?,
        rating: String? = null,
        plot: String? = null
    ) {
        val id = "series_$seriesId"
        
        // Check if already exists
        if (myListCache.any { it.id == id }) {
            android.util.Log.d("MyListManager", "Series already in list: $title")
            return
        }
        
        val item = MyListItem(
            id = id,
            title = title,
            cover = cover,
            type = "SERIES",
            seriesId = seriesId,
            rating = rating,
            plot = plot
        )
        
        myListCache.add(0, item) // Add to beginning
        saveToPrefs()
        
        android.util.Log.d("MyListManager", "Added series to My List: $title")
    }
    
    /**
     * Remove an item from My List
     */
    fun remove(id: String) {
        myListCache.removeAll { it.id == id }
        saveToPrefs()
        android.util.Log.d("MyListManager", "Removed from My List: $id")
    }
    
    /**
     * Remove a movie from My List
     */
    fun removeMovie(streamId: Int) {
        remove("movie_$streamId")
    }
    
    /**
     * Remove a series from My List
     */
    fun removeSeries(seriesId: Int) {
        remove("series_$seriesId")
    }
    
    /**
     * Toggle item in My List (add if not present, remove if present)
     * Returns true if item is now in list, false if removed
     */
    fun toggleMovie(streamId: Int, title: String, cover: String?, containerExtension: String? = null): Boolean {
        val id = "movie_$streamId"
        return if (isInList(id)) {
            remove(id)
            false
        } else {
            addMovie(streamId, title, cover, containerExtension)
            true
        }
    }
    
    /**
     * Toggle series in My List
     * Returns true if item is now in list, false if removed
     */
    fun toggleSeries(seriesId: Int, title: String, cover: String?, rating: String? = null): Boolean {
        val id = "series_$seriesId"
        return if (isInList(id)) {
            remove(id)
            false
        } else {
            addSeries(seriesId, title, cover, rating)
            true
        }
    }
    
    /**
     * Check if an item is in My List
     */
    fun isInList(id: String): Boolean {
        return myListCache.any { it.id == id }
    }
    
    /**
     * Check if a movie is in My List
     */
    fun isMovieInList(streamId: Int): Boolean {
        return isInList("movie_$streamId")
    }
    
    /**
     * Check if a series is in My List
     */
    fun isSeriesInList(seriesId: Int): Boolean {
        return isInList("series_$seriesId")
    }
    
    /**
     * Get all items in My List
     */
    fun getAll(): List<MyListItem> {
        return myListCache.toList()
    }
    
    /**
     * Get all movies in My List
     */
    fun getMovies(limit: Int = 20): List<MyListItem> {
        return myListCache
            .filter { it.type == "MOVIE" }
            .take(limit)
    }
    
    /**
     * Get all series in My List
     */
    fun getSeries(limit: Int = 20): List<MyListItem> {
        return myListCache
            .filter { it.type == "SERIES" }
            .take(limit)
    }
    
    /**
     * Get recent items (movies and series mixed)
     */
    fun getRecent(limit: Int = 10): List<MyListItem> {
        return myListCache
            .sortedByDescending { it.addedAt }
            .take(limit)
    }
    
    /**
     * Get count of items in My List
     */
    fun getCount(): Int = myListCache.size
    
    /**
     * Check if My List is empty
     */
    fun isEmpty(): Boolean = myListCache.isEmpty()
    
    /**
     * Clear all items from My List
     */
    fun clearAll() {
        myListCache.clear()
        saveToPrefs()
    }
    
    // ==================== Private Methods ====================
    
    private fun loadFromPrefs() {
        val key = getProfileKey(KEY_MY_LIST)
        val json = prefs?.getString(key, null)
        myListCache = if (json != null) {
            try {
                val type = object : TypeToken<MutableList<MyListItem>>() {}.type
                gson.fromJson(json, type) ?: mutableListOf()
            } catch (e: Exception) {
                android.util.Log.e("MyListManager", "Error loading My List", e)
                mutableListOf()
            }
        } else {
            mutableListOf()
        }
        android.util.Log.d("MyListManager", "Loaded ${myListCache.size} items in My List for profile: $currentProfileId")
    }
    
    private fun saveToPrefs() {
        try {
            val key = getProfileKey(KEY_MY_LIST)
            val json = gson.toJson(myListCache)
            prefs?.edit()?.putString(key, json)?.apply()
        } catch (e: Exception) {
            android.util.Log.e("MyListManager", "Error saving My List", e)
        }
    }
}

