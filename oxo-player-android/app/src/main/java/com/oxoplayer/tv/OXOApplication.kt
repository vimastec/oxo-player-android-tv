package com.oxoplayer.tv

import android.app.Application
import com.oxoplayer.tv.data.preferences.PreferencesManager
import com.oxoplayer.tv.data.WatchProgressManager
import com.oxoplayer.tv.data.ProfileManager

class OXOApplication : Application() {
    
    lateinit var preferencesManager: PreferencesManager
        private set
    
    override fun onCreate() {
        super.onCreate()
        instance = this
        preferencesManager = PreferencesManager(this)
        
        // Initialize profile manager
        ProfileManager.init(this)
        
        // Initialize watch progress manager for resume playback feature
        WatchProgressManager.init(this)
    }
    
    companion object {
        private lateinit var instance: OXOApplication
        
        fun getInstance(): OXOApplication = instance
    }
}





