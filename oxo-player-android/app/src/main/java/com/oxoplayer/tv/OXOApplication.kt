package com.oxoplayer.tv

import android.app.Application
import android.util.Log
import com.google.firebase.FirebaseApp
import com.oxoplayer.tv.data.api.RetrofitClient
import com.oxoplayer.tv.data.auth.FirebaseAuthHelper
import com.oxoplayer.tv.data.preferences.PreferencesManager
import com.oxoplayer.tv.data.WatchProgressManager
import com.oxoplayer.tv.data.ProfileManager
import com.oxoplayer.tv.data.MyListManager
import com.oxoplayer.tv.data.SeriesConfigManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class OXOApplication : Application() {
    
    private val TAG = "OXOApplication"
    
    lateinit var preferencesManager: PreferencesManager
        private set
    
    override fun onCreate() {
        super.onCreate()
        instance = this
        preferencesManager = PreferencesManager(this)
        
        // Initialize Firebase
        FirebaseApp.initializeApp(this)
        Log.d(TAG, "Firebase initialized")
        
        // Initialize RetrofitClient with context (for app signature)
        RetrofitClient.init(this)
        
        // Initialize Firebase Auth in background (anonymous sign-in)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                FirebaseAuthHelper.ensureAuthenticated()
                Log.d(TAG, "Firebase Auth ready")
            } catch (e: Exception) {
                Log.e(TAG, "Firebase Auth failed", e)
            }
        }
        
        // Initialize profile manager
        ProfileManager.init(this)
        
        // Initialize watch progress manager for resume playback feature
        WatchProgressManager.init(this)
        
        // Initialize My List manager (Netflix-style watchlist)
        MyListManager.init(this)
        
        // Initialize series configuration manager
        SeriesConfigManager.init(this)
    }
    
    companion object {
        private lateinit var instance: OXOApplication
        
        fun getInstance(): OXOApplication = instance
    }
}




