package com.oxoplayer.tv.data.preferences

import android.content.Context
import android.content.SharedPreferences

class PreferencesManager(context: Context) {
    
    private val prefs: SharedPreferences = context.getSharedPreferences(
        "oxo_player_prefs",
        Context.MODE_PRIVATE
    )
    
    companion object {
        private const val KEY_MAC_ADDRESS = "mac_address"
        private const val KEY_DEVICE_KEY = "device_key"
        private const val KEY_DEVICE_STATUS = "device_status"
        private const val KEY_EXPIRATION_DATE = "expiration_date"
        private const val KEY_HAS_PLAYLIST = "has_playlist"
        private const val KEY_DAYS_REMAINING = "days_remaining"
        private const val KEY_IS_ACTIVATED = "is_activated"
        private const val KEY_LAST_PLAYLIST_UPDATE = "last_playlist_update"
        private const val KEY_CURRENT_PLAYLIST_NAME = "current_playlist_name"
        private const val KEY_CURRENT_PLAYLIST_ID = "current_playlist_id"
    }
    
    var macAddress: String?
        get() = prefs.getString(KEY_MAC_ADDRESS, null)
        set(value) = prefs.edit().putString(KEY_MAC_ADDRESS, value).apply()
    
    var deviceKey: String?
        get() = prefs.getString(KEY_DEVICE_KEY, null)
        set(value) = prefs.edit().putString(KEY_DEVICE_KEY, value).apply()
    
    var deviceStatus: String?
        get() = prefs.getString(KEY_DEVICE_STATUS, null)
        set(value) = prefs.edit().putString(KEY_DEVICE_STATUS, value).apply()
    
    var expirationDate: String?
        get() = prefs.getString(KEY_EXPIRATION_DATE, null)
        set(value) = prefs.edit().putString(KEY_EXPIRATION_DATE, value).apply()
    
    var hasPlaylist: Boolean
        get() = prefs.getBoolean(KEY_HAS_PLAYLIST, false)
        set(value) = prefs.edit().putBoolean(KEY_HAS_PLAYLIST, value).apply()
    
    var daysRemaining: Int
        get() = prefs.getInt(KEY_DAYS_REMAINING, 0)
        set(value) = prefs.edit().putInt(KEY_DAYS_REMAINING, value).apply()
    
    var isActivated: Boolean
        get() = prefs.getBoolean(KEY_IS_ACTIVATED, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_ACTIVATED, value).apply()
    
    var lastPlaylistUpdate: Long
        get() = prefs.getLong(KEY_LAST_PLAYLIST_UPDATE, 0)
        set(value) = prefs.edit().putLong(KEY_LAST_PLAYLIST_UPDATE, value).apply()
    
    var currentPlaylistName: String?
        get() = prefs.getString(KEY_CURRENT_PLAYLIST_NAME, null)
        set(value) = prefs.edit().putString(KEY_CURRENT_PLAYLIST_NAME, value).apply()
    
    var currentPlaylistId: Int
        get() = prefs.getInt(KEY_CURRENT_PLAYLIST_ID, -1)
        set(value) = prefs.edit().putInt(KEY_CURRENT_PLAYLIST_ID, value).apply()
    
    fun clear() {
        prefs.edit().clear().apply()
    }
}










