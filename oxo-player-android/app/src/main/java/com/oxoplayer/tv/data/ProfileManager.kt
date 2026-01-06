package com.oxoplayer.tv.data

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.oxoplayer.tv.data.models.Profile

/**
 * Manages user profiles (like Netflix)
 * Max 4 profiles per device
 */
object ProfileManager {
    
    private const val PREFS_NAME = "oxo_profiles"
    private const val KEY_PROFILES = "profiles_list"
    private const val KEY_CURRENT_PROFILE = "current_profile_id"
    const val MAX_PROFILES = 4
    
    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    
    // Current selected profile
    var currentProfile: Profile? = null
        private set
    
    /**
     * Initialize ProfileManager with context
     * Call this in Application.onCreate()
     */
    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        
        // Load current profile if exists
        val currentId = prefs.getString(KEY_CURRENT_PROFILE, null)
        if (currentId != null) {
            currentProfile = getProfileById(currentId)
        }
    }
    
    /**
     * Get all profiles
     */
    fun getProfiles(): List<Profile> {
        val json = prefs.getString(KEY_PROFILES, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<Profile>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }
    
    /**
     * Get profile by ID
     */
    fun getProfileById(id: String): Profile? {
        return getProfiles().find { it.id == id }
    }
    
    /**
     * Create a new profile
     * Returns null if max profiles reached
     */
    fun createProfile(name: String, avatarIndex: Int = 0, isKids: Boolean = false, pin: String? = null): Profile? {
        val profiles = getProfiles().toMutableList()
        
        if (profiles.size >= MAX_PROFILES) {
            return null
        }
        
        val newProfile = Profile(
            name = name,
            avatarIndex = avatarIndex,
            isKidsProfile = isKids,
            pin = pin
        )
        
        profiles.add(newProfile)
        saveProfiles(profiles)
        
        return newProfile
    }
    
    /**
     * Update an existing profile
     */
    fun updateProfile(profile: Profile): Boolean {
        val profiles = getProfiles().toMutableList()
        val index = profiles.indexOfFirst { it.id == profile.id }
        
        if (index == -1) return false
        
        profiles[index] = profile
        saveProfiles(profiles)
        
        // Update current if it's the same profile
        if (currentProfile?.id == profile.id) {
            currentProfile = profile
        }
        
        return true
    }
    
    /**
     * Delete a profile
     */
    fun deleteProfile(profileId: String): Boolean {
        val profiles = getProfiles().toMutableList()
        val removed = profiles.removeAll { it.id == profileId }
        
        if (removed) {
            saveProfiles(profiles)
            
            // Clear current if deleted
            if (currentProfile?.id == profileId) {
                currentProfile = null
                prefs.edit().remove(KEY_CURRENT_PROFILE).apply()
            }
            
            // Also clear watch progress for this profile
            WatchProgressManager.clearAllProgressForProfile(profileId)
        }
        
        return removed
    }
    
    /**
     * Select a profile as current
     */
    fun selectProfile(profile: Profile) {
        currentProfile = profile
        prefs.edit().putString(KEY_CURRENT_PROFILE, profile.id).apply()
        
        // Initialize WatchProgressManager with this profile
        WatchProgressManager.setCurrentProfile(profile.id)
        // Initialize MyListManager with this profile
        MyListManager.setCurrentProfile(profile.id)
    }
    
    /**
     * Clear current profile selection (logout from profile)
     */
    fun clearCurrentProfile() {
        currentProfile = null
        prefs.edit().remove(KEY_CURRENT_PROFILE).apply()
    }
    
    /**
     * Check if profiles exist
     */
    fun hasProfiles(): Boolean = getProfiles().isNotEmpty()
    
    /**
     * Check if can add more profiles
     */
    fun canAddProfile(): Boolean = getProfiles().size < MAX_PROFILES
    
    /**
     * Get number of profiles
     */
    fun getProfileCount(): Int = getProfiles().size
    
    private fun saveProfiles(profiles: List<Profile>) {
        val json = gson.toJson(profiles)
        prefs.edit().putString(KEY_PROFILES, json).apply()
    }
    
    /**
     * Avatar resources - index maps to drawable resource name
     */
    val avatarNames = listOf(
        "avatar_1",  // Default - masked figure
        "avatar_2",  // Kids/cartoon
        "avatar_3",  // Mystery/red
        "avatar_4",  // Woman
        "avatar_5",  // Man with glasses
        "avatar_6",  // Superhero
        "avatar_7",  // Robot
        "avatar_8"   // Animal
    )
    
    fun getAvatarResourceName(index: Int): String {
        return avatarNames.getOrElse(index) { avatarNames[0] }
    }
}

