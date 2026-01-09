package com.oxoplayer.tv.data

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.oxoplayer.tv.data.models.SeriesPlaybackConfig

/**
 * Series Configuration Manager
 * Manages customizable playback settings for series (intro skip, next episode timing)
 */
object SeriesConfigManager {
    
    private const val PREFS_NAME = "series_playback_configs"
    private const val KEY_CONFIGS = "configs"
    
    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    
    // Default values
    const val DEFAULT_SKIP_INTRO_SHOW_AT_MS = 10000L // 10 seconds
    const val DEFAULT_SKIP_INTRO_JUMP_TO_MS = 120000L // 2 minutes
    const val DEFAULT_NEXT_EPISODE_THRESHOLD_MS = 60000L // 1 minute
    
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
    
    /**
     * Save a configuration for a series (and optionally a specific season)
     */
    fun saveConfig(config: SeriesPlaybackConfig) {
        val configs = getAllConfigs().toMutableList()
        
        // Remove existing config for same series/season combination
        configs.removeAll { 
            it.seriesId == config.seriesId && 
            it.seasonNumber == config.seasonNumber 
        }
        
        // If applyToAllSeasons is true, remove all season-specific configs for this series
        if (config.applyToAllSeasons) {
            configs.removeAll { it.seriesId == config.seriesId }
        }
        
        configs.add(config)
        saveAllConfigs(configs)
        
        android.util.Log.d("SeriesConfigManager", "Saved config for series ${config.seriesId}, season ${config.seasonNumber}, applyToAll: ${config.applyToAllSeasons}")
    }
    
    /**
     * Get configuration for a specific series and season
     * Returns default values if no custom configuration exists
     */
    fun getConfig(seriesId: String, seasonNumber: Int): SeriesPlaybackConfig {
        val configs = getAllConfigs()
        
        // First, try to find season-specific config
        val seasonConfig = configs.find { 
            it.seriesId == seriesId && 
            it.seasonNumber == seasonNumber 
        }
        if (seasonConfig != null) {
            android.util.Log.d("SeriesConfigManager", "Found season-specific config for $seriesId season $seasonNumber")
            return seasonConfig
        }
        
        // Second, try to find series-wide config (applyToAllSeasons = true)
        val seriesConfig = configs.find { 
            it.seriesId == seriesId && 
            it.applyToAllSeasons 
        }
        if (seriesConfig != null) {
            android.util.Log.d("SeriesConfigManager", "Found series-wide config for $seriesId")
            return seriesConfig.copy(seasonNumber = seasonNumber)
        }
        
        // Return default config
        android.util.Log.d("SeriesConfigManager", "Using default config for $seriesId season $seasonNumber")
        return SeriesPlaybackConfig(
            seriesId = seriesId,
            seasonNumber = seasonNumber,
            skipIntroShowAtMs = DEFAULT_SKIP_INTRO_SHOW_AT_MS,
            skipIntroJumpToMs = DEFAULT_SKIP_INTRO_JUMP_TO_MS,
            nextEpisodeThresholdMs = DEFAULT_NEXT_EPISODE_THRESHOLD_MS,
            applyToAllSeasons = false
        )
    }
    
    /**
     * Check if a custom configuration exists for a series (any season)
     */
    fun hasCustomConfig(seriesId: String): Boolean {
        return getAllConfigs().any { it.seriesId == seriesId }
    }
    
    /**
     * Delete configuration for a specific series/season
     */
    fun deleteConfig(seriesId: String, seasonNumber: Int?) {
        val configs = getAllConfigs().toMutableList()
        
        if (seasonNumber == null) {
            // Delete all configs for this series
            configs.removeAll { it.seriesId == seriesId }
        } else {
            // Delete specific season config
            configs.removeAll { 
                it.seriesId == seriesId && 
                it.seasonNumber == seasonNumber 
            }
        }
        
        saveAllConfigs(configs)
    }
    
    /**
     * Get all configurations
     */
    private fun getAllConfigs(): List<SeriesPlaybackConfig> {
        val json = prefs.getString(KEY_CONFIGS, null) ?: return emptyList()
        
        return try {
            val type = object : TypeToken<List<SeriesPlaybackConfig>>() {}.type
            gson.fromJson(json, type)
        } catch (e: Exception) {
            android.util.Log.e("SeriesConfigManager", "Error parsing configs", e)
            emptyList()
        }
    }
    
    /**
     * Save all configurations
     */
    private fun saveAllConfigs(configs: List<SeriesPlaybackConfig>) {
        val json = gson.toJson(configs)
        prefs.edit().putString(KEY_CONFIGS, json).apply()
    }
    
    /**
     * Convert milliseconds to minutes and seconds
     */
    fun msToMinutesSeconds(ms: Long): Pair<Int, Int> {
        val totalSeconds = (ms / 1000).toInt()
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return Pair(minutes, seconds)
    }
    
    /**
     * Convert minutes and seconds to milliseconds
     */
    fun minutesSecondsToMs(minutes: Int, seconds: Int): Long {
        return ((minutes * 60) + seconds) * 1000L
    }
}





