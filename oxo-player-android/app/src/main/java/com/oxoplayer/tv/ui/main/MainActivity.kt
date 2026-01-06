package com.oxoplayer.tv.ui.main

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import com.oxoplayer.tv.OXOApplication
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.*
import com.oxoplayer.tv.data.parser.M3UParser
import com.oxoplayer.tv.data.repository.DeviceRepository
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {
    
    private lateinit var deviceRepository: DeviceRepository
    private lateinit var preferencesManager: com.oxoplayer.tv.data.preferences.PreferencesManager
    
    // Content data
    var channels = listOf<Channel>()
    var movies = listOf<Movie>()
    var series = listOf<Series>()
    var liveCategories = listOf<Category>()
    var movieCategories = listOf<Category>()
    var seriesCategories = listOf<SeriesCategory>()
    
    companion object {
        var instance: MainActivity? = null
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        
        instance = this
        
        deviceRepository = DeviceRepository(this)
        preferencesManager = OXOApplication.getInstance().preferencesManager
        
        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.main_browse_fragment, MainFragment())
                .commit()
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        if (instance == this) {
            instance = null
        }
    }
    
    override fun onResume() {
        super.onResume()
        // Load playlist when activity is resumed
        if (channels.isEmpty() && movies.isEmpty() && series.isEmpty()) {
            loadPlaylist()
        }
    }
    
    private fun loadPlaylist() {
        android.util.Log.d("MainActivity", "loadPlaylist() called")
        
        // Use GlobalScope to prevent cancellation when activity pauses
        kotlinx.coroutines.GlobalScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            try {
                android.util.Log.d("MainActivity", "Getting playlist info...")
                
                // Get all playlists to find the active one's ID
                val allPlaylistsResult = deviceRepository.getAllPlaylists()
                allPlaylistsResult.onSuccess { playlistsResponse ->
                    val activePlaylist = playlistsResponse.playlists.find { it.isActive }
                    if (activePlaylist != null) {
                        preferencesManager.currentPlaylistId = activePlaylist.id
                        preferencesManager.currentPlaylistName = activePlaylist.name
                        android.util.Log.d("MainActivity", "Active playlist found: ${activePlaylist.name} (ID: ${activePlaylist.id})")
                    }
                }
                
                // First, get playlist info to check type
                val playlistInfoResult = deviceRepository.getPlaylist()
                
                playlistInfoResult.onSuccess { playlistInfo ->
                    android.util.Log.d("MainActivity", "Playlist type: ${playlistInfo.playlistType}")
                    
                    // Check if it's Xtream Code
                    if (playlistInfo.playlistType == "xtream" && playlistInfo.xtream != null) {
                        android.util.Log.d("MainActivity", "Using Xtream Code credentials from API")
                        
                        // Initialize Xtream with credentials from API
                        val credentials = com.oxoplayer.tv.data.models.XtreamCredentials(
                            host = playlistInfo.xtream.host,
                            username = playlistInfo.xtream.username,
                            password = playlistInfo.xtream.password
                        )
                        
                        com.oxoplayer.tv.data.api.XtreamClient.initialize(credentials)
                        com.oxoplayer.tv.data.DataManager.initXtreamCredentials(credentials, preferencesManager.currentPlaylistId)
                        
                        // Load Xtream categories
                        initializeXtreamCategories()
                        
                        // Navigate to Home
                        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                            Toast.makeText(
                                this@MainActivity,
                                "✅ Xtream Code connecté",
                                Toast.LENGTH_LONG
                            ).show()
                            
                            val homeIntent = Intent(this@MainActivity, com.oxoplayer.tv.ui.home.HomeActivity::class.java)
                            startActivity(homeIntent)
                            finish()
                        }
                        
                    } else {
                        // M3U mode - get content and parse
                        android.util.Log.d("MainActivity", "Using M3U playlist")
                        
                        val result = deviceRepository.getPlaylistContent()
                        
                        result.onSuccess { m3uContent ->
                            android.util.Log.d("MainActivity", "Playlist content received: ${m3uContent.length} bytes")
                            
                            // Parse M3U
                            val parseResult = M3UParser.parseM3U(m3uContent)
                            
                            android.util.Log.d("MainActivity", "Parse result: ${parseResult.channels.size} channels, ${parseResult.movies.size} movies, ${parseResult.series.size} series")
                            
                            // Try to extract Xtream from M3U (fallback)
                            initializeXtreamForSeries(m3uContent)
                            
                            // Update data on main thread
                            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                                channels = parseResult.channels
                                movies = parseResult.movies
                                series = parseResult.series
                                liveCategories = parseResult.liveCategories
                                movieCategories = parseResult.movieCategories
                                seriesCategories = parseResult.seriesCategories
                                
                                // Store in DataManager singleton
                                com.oxoplayer.tv.data.DataManager.setData(
                                    channels, movies, series,
                                    liveCategories, movieCategories, seriesCategories
                                )
                                
                                preferencesManager.lastPlaylistUpdate = System.currentTimeMillis()
                                
                                android.util.Log.d("MainActivity", "Refreshing fragment...")
                                android.util.Log.d("MainActivity", "Data in MainActivity: channels=${channels.size}, movies=${movies.size}, series=${series.size}")
                                
                                // Refresh fragment
                                val fragment = supportFragmentManager.findFragmentById(R.id.main_browse_fragment)
                                android.util.Log.d("MainActivity", "Fragment: $fragment")
                                
                                if (fragment is MainFragment) {
                                    android.util.Log.d("MainActivity", "Calling loadContent()")
                                    fragment.loadContent()
                                } else {
                                    android.util.Log.e("MainActivity", "Fragment is NOT MainFragment!")
                                }
                                
                                Toast.makeText(
                                    this@MainActivity,
                                    "✅ ${channels.size} chaînes, ${movies.size} films, ${series.size} séries",
                                    Toast.LENGTH_LONG
                                ).show()
                                
                                // Navigate to Home after data is loaded
                                val homeIntent = Intent(this@MainActivity, com.oxoplayer.tv.ui.home.HomeActivity::class.java)
                                startActivity(homeIntent)
                                finish()
                            }
                        }
                        
                        result.onFailure { error ->
                            android.util.Log.e("MainActivity", "Error loading playlist", error)
                            kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                                Toast.makeText(
                                    this@MainActivity,
                                    "❌ Erreur: ${error.message}",
                                    Toast.LENGTH_LONG
                                ).show()
                            }
                        }
                    }
                }
                
                playlistInfoResult.onFailure { error ->
                    android.util.Log.e("MainActivity", "Error getting playlist info", error)
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                        Toast.makeText(
                            this@MainActivity,
                            "❌ Erreur: ${error.message}",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
                
            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Exception loading playlist", e)
                kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                    Toast.makeText(
                        this@MainActivity,
                        "❌ Exception: ${e.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }
    
    /**
     * Initialize Xtream categories (for Xtream Code mode)
     */
    private suspend fun initializeXtreamCategories() {
        try {
            val xtreamRepo = com.oxoplayer.tv.data.repository.XtreamRepository()
            
            // Pre-load Live TV categories
            try {
                val liveCategoriesResult = xtreamRepo.getLiveCategories()
                liveCategoriesResult.onSuccess { categories ->
                    com.oxoplayer.tv.data.DataManager.initXtreamLiveCategories(categories)
                    android.util.Log.d("MainActivity", "Loaded ${categories.size} Xtream Live TV categories")
                }
            } catch (e: Exception) {
                android.util.Log.w("MainActivity", "Failed to load Live TV categories", e)
            }
            
            // Pre-load Movie categories
            try {
                val movieCategoriesResult = xtreamRepo.getMovieCategories()
                movieCategoriesResult.onSuccess { categories ->
                    com.oxoplayer.tv.data.DataManager.initXtreamMovieCategories(categories)
                    android.util.Log.d("MainActivity", "Loaded ${categories.size} Xtream movie categories")
                }
            } catch (e: Exception) {
                android.util.Log.w("MainActivity", "Failed to load movie categories", e)
            }
            
            // Pre-load Series categories
            try {
                val seriesCategoriesResult = xtreamRepo.getSeriesCategories()
                seriesCategoriesResult.onSuccess { categories ->
                    com.oxoplayer.tv.data.DataManager.initXtreamSeriesCategories(categories)
                    android.util.Log.d("MainActivity", "Loaded ${categories.size} Xtream series categories")
                }
            } catch (e: Exception) {
                android.util.Log.w("MainActivity", "Failed to load series categories", e)
            }
            
            android.util.Log.d("MainActivity", "Xtream initialization complete")
            
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Error initializing Xtream", e)
        }
    }
    
    fun refreshPlaylist() {
        loadPlaylist()
    }
    
    /**
     * Initialize Xtream API for all content (Live TV, Movies, Series)
     */
    private suspend fun initializeXtreamForSeries(m3uContent: String) {
        try {
            // Try to extract Xtream credentials from content
            val credentials = M3UParser.extractXtreamCredentials(m3uContent)
            
            if (credentials != null) {
                android.util.Log.d("MainActivity", "Xtream credentials extracted - Host: ${credentials.host}")
                
                // Initialize Xtream client
                com.oxoplayer.tv.data.api.XtreamClient.initialize(credentials)
                
                // Store credentials in DataManager
                com.oxoplayer.tv.data.DataManager.initXtreamCredentials(credentials, preferencesManager.currentPlaylistId)
                
                val xtreamRepo = com.oxoplayer.tv.data.repository.XtreamRepository()
                
                // Pre-load Live TV categories
                try {
                    val liveCategoriesResult = xtreamRepo.getLiveCategories()
                    liveCategoriesResult.onSuccess { categories ->
                        com.oxoplayer.tv.data.DataManager.initXtreamLiveCategories(categories)
                        android.util.Log.d("MainActivity", "Loaded ${categories.size} Xtream Live TV categories")
                    }
                } catch (e: Exception) {
                    android.util.Log.w("MainActivity", "Failed to load Live TV categories", e)
                }
                
                // Pre-load Movie categories
                try {
                    val movieCategoriesResult = xtreamRepo.getMovieCategories()
                    movieCategoriesResult.onSuccess { categories ->
                        com.oxoplayer.tv.data.DataManager.initXtreamMovieCategories(categories)
                        android.util.Log.d("MainActivity", "Loaded ${categories.size} Xtream movie categories")
                    }
                } catch (e: Exception) {
                    android.util.Log.w("MainActivity", "Failed to load movie categories", e)
                }
                
                // Pre-load Series categories
                try {
                    val seriesCategoriesResult = xtreamRepo.getSeriesCategories()
                    seriesCategoriesResult.onSuccess { categories ->
                        com.oxoplayer.tv.data.DataManager.initXtreamSeriesCategories(categories)
                        android.util.Log.d("MainActivity", "Loaded ${categories.size} Xtream series categories")
                    }
                } catch (e: Exception) {
                    android.util.Log.w("MainActivity", "Failed to load series categories", e)
                }
                
                android.util.Log.d("MainActivity", "Xtream initialization complete - isXtreamEnabled: ${com.oxoplayer.tv.data.DataManager.isXtreamEnabled}")
                
            } else {
                android.util.Log.d("MainActivity", "No Xtream credentials found, using M3U parsing")
            }
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Error initializing Xtream", e)
        }
    }
}

