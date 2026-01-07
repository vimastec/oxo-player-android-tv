package com.oxoplayer.tv.ui.home

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions
import com.oxoplayer.tv.data.api.TmdbClient
import com.oxoplayer.tv.data.cache.Top10Cache
import com.oxoplayer.tv.data.cache.CachedTop10Item
import com.oxoplayer.tv.data.DataManager
import com.oxoplayer.tv.OXOApplication
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.Channel
import com.oxoplayer.tv.data.models.Movie
import com.oxoplayer.tv.data.models.Series
import com.oxoplayer.tv.data.models.XtreamLiveStream
import com.oxoplayer.tv.data.models.XtreamMovie
import com.oxoplayer.tv.data.models.XtreamMovieInfo
import com.oxoplayer.tv.data.models.XtreamSeries
import com.oxoplayer.tv.data.repository.XtreamRepository
import com.oxoplayer.tv.ui.livetv.LiveTVActivity
import com.oxoplayer.tv.ui.movies.MoviesActivity
import com.oxoplayer.tv.ui.movies.MovieDetailActivity
import com.oxoplayer.tv.ui.player.PlayerActivity
import com.oxoplayer.tv.ui.series.SeriesActivity
import com.oxoplayer.tv.ui.series.SeriesDetailActivity
import com.oxoplayer.tv.ui.settings.SettingsActivity
import com.oxoplayer.tv.ui.profile.ProfileSelectionActivity
import com.oxoplayer.tv.data.WatchProgressManager
import com.oxoplayer.tv.data.ProfileManager
import com.oxoplayer.tv.data.MyListManager
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.atomic.AtomicInteger

/**
 * Netflix-Style Home Activity
 * Modern UI with horizontal scrolling content rows
 * Uses Xtream API for proper data when available
 */
class HomeActivity : AppCompatActivity() {
    
    private val TAG = "HomeActivity"
    
    private lateinit var liveChannelsRecycler: RecyclerView
    private lateinit var moviesRecycler: RecyclerView
    private lateinit var seriesRecycler: RecyclerView
    
    // Hero Banner - Featured Movie
    private lateinit var heroBackground: ImageView
    private lateinit var heroTitle: TextView
    private lateinit var heroDescription: TextView
    private lateinit var heroInfoLayout: LinearLayout
    private lateinit var heroYear: TextView
    private lateinit var heroRating: TextView
    private lateinit var heroCategory: TextView
    private lateinit var btnHeroPlay: Button
    private lateinit var btnHeroInfo: Button
    private var featuredMovie: XtreamMovie? = null
    
    // Hero Trailer Button
    private lateinit var btnHeroTrailer: Button
    private var youtubeTrailerKey: String? = null
    
    // Hero Video Preview (auto-play extract)
    private lateinit var heroVideoPlayer: PlayerView
    private var heroExoPlayer: ExoPlayer? = null
    private var heroPreviewHandler: Handler? = null
    private var heroPreviewRunnable: Runnable? = null
    private var isHeroPreviewPlaying = false
    private val HERO_PREVIEW_DELAY = 5000L // 5 seconds before preview starts (longer for TV Box)
    private val HERO_PREVIEW_START_POSITION = 15 * 60 * 1000L // Start at 15 minutes
    private val HERO_PREVIEW_DURATION = 45 * 1000L // Play for 45 seconds (shorter for TV Box performance)
    
    // Category selector buttons
    private lateinit var btnLiveCategorySelector: android.widget.Button
    private lateinit var btnMovieCategorySelector: android.widget.Button
    private lateinit var btnSeriesCategorySelector: android.widget.Button
    
    // Selected category IDs
    private var selectedLiveCategoryId: String? = null
    private var selectedMovieCategoryId: String? = null
    private var selectedSeriesCategoryId: String? = null
    
    // Loading UI
    private lateinit var loadingOverlay: FrameLayout
    private lateinit var loadingText: TextView
    private lateinit var loadingSubText: TextView
    private var loadingCounter = AtomicInteger(0)
    private var isFirstLoad = true
    
    // Continue watching sections
    private lateinit var continueMoviesSection: View
    private lateinit var continueMoviesRecycler: RecyclerView
    private lateinit var continueSeriesSection: View
    private lateinit var continueSeriesRecycler: RecyclerView
    private lateinit var recentChannelsSection: View
    private lateinit var recentChannelsRecycler: RecyclerView
    
    
    // Top 10 / Popular sections (Netflix style)
    private lateinit var top10MoviesSection: View
    private lateinit var top10MoviesRecycler: RecyclerView
    private lateinit var top10MoviesTitle: TextView
    private lateinit var top10SeriesSection: View
    private lateinit var top10SeriesRecycler: RecyclerView
    private lateinit var top10SeriesTitle: TextView
    private lateinit var top10MoviesAdapter: Top10Adapter
    private lateinit var top10SeriesAdapter: Top10Adapter
    
    private val xtreamRepository = XtreamRepository()
    private var isXtreamMode = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_home)
        
        isXtreamMode = DataManager.isXtreamEnabled
        
        // Setup loading overlay
        loadingOverlay = findViewById(R.id.loadingOverlay)
        loadingText = findViewById(R.id.loadingText)
        loadingSubText = findViewById(R.id.loadingSubText)
        
        // Hide loading if we have cached data
        val hasCache = DataManager.allXtreamLiveStreams.isNotEmpty() || 
                       DataManager.xtreamMovieCategories.isNotEmpty() ||
                       DataManager.xtreamSeriesCategories.isNotEmpty()
        if (hasCache) {
            hideLoading()
            isFirstLoad = false
        }
        
        setupStatusBar()
        setupNavigation()
        setupHeroBanner()
        setupContinueWatching()
        setupTop10Sections()
        setupContentRows()
        
        // Load Top 10 separately with delay to ensure Xtream data is loaded
        Handler(Looper.getMainLooper()).postDelayed({
            android.util.Log.d(TAG, "🔥 Calling loadTop10Content() after 10s delay")
            loadTop10Content()
        }, 10000) // 10 seconds delay
    }
    
    private fun showLoading(text: String = "Chargement du contenu...", subText: String = "Live TV, Films et Séries") {
        loadingText.text = text
        loadingSubText.text = subText
        loadingOverlay.visibility = View.VISIBLE
    }
    
    private fun hideLoading() {
        loadingOverlay.animate()
            .alpha(0f)
            .setDuration(300)
            .withEndAction {
                loadingOverlay.visibility = View.GONE
                loadingOverlay.alpha = 1f
            }
            .start()
    }
    
    private fun onSectionLoaded() {
        val count = loadingCounter.incrementAndGet()
        android.util.Log.d(TAG, "Section loaded: $count/3")
        
        // Hide loading after first section is loaded (for faster perceived performance)
        if (count >= 1 && isFirstLoad) {
            isFirstLoad = false
            runOnUiThread { hideLoading() }
        }
    }
    
    override fun onResume() {
        super.onResume()
        // Refresh continue watching sections when returning to home
        refreshContinueWatching()
        // Restart preview timer if on hero
        startHeroPreviewTimer()
    }
    
    override fun onPause() {
        super.onPause()
        // Stop preview when leaving the activity
        stopHeroPreview()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Clean up player resources
        stopHeroPreview()
        heroExoPlayer?.release()
        heroExoPlayer = null
        heroPreviewHandler?.removeCallbacksAndMessages(null)
        heroPreviewHandler = null
    }
    
    private fun setupStatusBar() {
        val dateText = findViewById<TextView>(R.id.dateText)
        val statusText = findViewById<TextView>(R.id.statusText)
        
        // Current date
        val sdf = SimpleDateFormat("dd MMMM yyyy", Locale.getDefault())
        dateText.text = sdf.format(Date())
        
        // Device status
        val prefs = OXOApplication.getInstance().preferencesManager
        val daysRemaining = prefs.daysRemaining
        statusText.text = if (prefs.isActivated) {
            "✅ Playlist expire dans: $daysRemaining jour(s)"
        } else {
            "⏱️ Période d'essai: $daysRemaining jour(s)"
        }
        
        // Set version dynamically from BuildConfig
        val versionText = findViewById<TextView>(R.id.versionText)
        versionText.text = "v${com.oxoplayer.tv.BuildConfig.VERSION_NAME}"
    }
    
    private fun setupNavigation() {
        // Navigation items
        val navHome = findViewById<TextView>(R.id.navHome)
        val navLiveTV = findViewById<TextView>(R.id.navLiveTV)
        val navMovies = findViewById<TextView>(R.id.navMovies)
        val navSeries = findViewById<TextView>(R.id.navSeries)
        val navMyList = findViewById<TextView>(R.id.navMyList)
        
        navHome.setOnClickListener {
            // Already on home, do nothing or scroll to top
        }
        
        navLiveTV.setOnClickListener {
            startActivity(Intent(this, LiveTVActivity::class.java))
        }
        
        navMovies.setOnClickListener {
            startActivity(Intent(this, MoviesActivity::class.java))
        }
        
        navSeries.setOnClickListener {
            startActivity(Intent(this, SeriesActivity::class.java))
        }
        
        navMyList.setOnClickListener {
            startActivity(Intent(this, com.oxoplayer.tv.ui.mylist.MyListActivity::class.java))
        }
        
        // Top right buttons
        val btnSearch = findViewById<ImageView>(R.id.btnSearch)
        val btnSettings = findViewById<ImageView>(R.id.btnSettings)
        val profileSection = findViewById<View>(R.id.profileSection)
        val profileName = findViewById<TextView>(R.id.profileName)
        val profileAvatar = findViewById<ImageView>(R.id.profileAvatar)
        
        btnSearch.setOnClickListener {
            Toast.makeText(this, "🔍 Recherche: bientôt disponible", Toast.LENGTH_SHORT).show()
        }
        
        btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        
        profileSection.setOnClickListener {
            // Go to profile selection
            ProfileManager.clearCurrentProfile()
            startActivity(Intent(this, ProfileSelectionActivity::class.java))
            finish()
        }
        
        // Load and display current profile
        val avatarResources = listOf(
            R.drawable.avatar_1,
            R.drawable.avatar_2,
            R.drawable.avatar_3,
            R.drawable.avatar_4,
            R.drawable.avatar_5,
            R.drawable.avatar_6,
            R.drawable.avatar_7,
            R.drawable.avatar_8
        )
        
        val currentProfile = ProfileManager.currentProfile
        if (currentProfile != null) {
            profileName.text = currentProfile.name
            val avatarRes = avatarResources.getOrElse(currentProfile.avatarIndex) { avatarResources[0] }
            profileAvatar.setImageResource(avatarRes)
            android.util.Log.d(TAG, "Current profile: ${currentProfile.name}, avatar index: ${currentProfile.avatarIndex}")
        } else {
            profileName.text = "Profil"
            profileAvatar.setImageResource(R.drawable.ic_home_account)
        }
        
        // Focus animations for navigation items
        val navItems = listOf(navHome, navLiveTV, navMovies, navSeries, navMyList, btnSearch, btnSettings, profileSection)
        navItems.forEach { view ->
            view.setOnFocusChangeListener { v, hasFocus ->
                if (v is TextView) {
                    v.setTextColor(if (hasFocus) getColor(R.color.white) else getColor(R.color.light_gray))
                    v.animate()
                        .scaleX(if (hasFocus) 1.1f else 1.0f)
                        .scaleY(if (hasFocus) 1.1f else 1.0f)
                        .setDuration(150)
                        .start()
                } else if (v is ImageView) {
                    v.animate()
                        .scaleX(if (hasFocus) 1.2f else 1.0f)
                        .scaleY(if (hasFocus) 1.2f else 1.0f)
                        .setDuration(150)
                        .start()
                }
            }
        }
    }
    
    private fun setupHeroBanner() {
        // Initialize Hero Banner views
        heroBackground = findViewById(R.id.heroBackground)
        heroTitle = findViewById(R.id.heroTitle)
        heroDescription = findViewById(R.id.heroDescription)
        heroInfoLayout = findViewById(R.id.heroInfoLayout)
        heroYear = findViewById(R.id.heroYear)
        heroRating = findViewById(R.id.heroRating)
        heroCategory = findViewById(R.id.heroCategory)
        btnHeroPlay = findViewById(R.id.btnHeroPlay)
        btnHeroInfo = findViewById(R.id.btnHeroInfo)
        btnHeroTrailer = findViewById(R.id.btnHeroTrailer)
        heroVideoPlayer = findViewById(R.id.heroVideoPlayer)
        
        // Initialize ExoPlayer for preview
        heroExoPlayer = ExoPlayer.Builder(this).build().apply {
            heroVideoPlayer.player = this
            volume = 0.3f // Low volume for preview
            repeatMode = Player.REPEAT_MODE_OFF
            addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_READY && isHeroPreviewPlaying) {
                        // Fade in video when ready
                        heroVideoPlayer.visibility = View.VISIBLE
                        heroVideoPlayer.alpha = 0f
                        heroVideoPlayer.animate().alpha(1f).setDuration(500).start()
                        heroBackground.animate().alpha(0f).setDuration(500).start()
                        android.util.Log.d(TAG, "Hero preview started playing")
                    }
                }
                
                override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                    android.util.Log.e(TAG, "Hero preview error: ${error.message}")
                    // Stop preview on error and show poster
                    isHeroPreviewPlaying = false
                    heroVideoPlayer.visibility = View.GONE
                    heroBackground.alpha = 1f
                }
            })
        }
        
        // Initialize preview handler
        heroPreviewHandler = Handler(Looper.getMainLooper())
        
        // Setup button click listeners
        btnHeroPlay.setOnClickListener {
            stopHeroPreview()
            featuredMovie?.let { movie ->
                playXtreamMovie(movie)
            }
        }
        
        btnHeroInfo.setOnClickListener {
            stopHeroPreview()
            featuredMovie?.let { movie ->
                openMovieDetails(movie)
            }
        }
        
        btnHeroTrailer.setOnClickListener {
            stopHeroPreview()
            openYouTubeTrailer()
        }
        
        // Focus animations for buttons - TV remote navigation
        // Also start/stop preview timer based on focus
        listOf(btnHeroPlay, btnHeroTrailer, btnHeroInfo).forEach { button ->
            button.setOnFocusChangeListener { v, hasFocus ->
                v.animate()
                    .scaleX(if (hasFocus) 1.1f else 1.0f)
                    .scaleY(if (hasFocus) 1.1f else 1.0f)
                    .setDuration(150)
                    .start()
                v.elevation = if (hasFocus) 12f else 4f
                
                // Start preview timer when any hero button gets focus
                if (hasFocus) {
                    startHeroPreviewTimer()
                }
            }
        }
        
        // Detect when user scrolls away from hero
        val scrollView = findViewById<androidx.core.widget.NestedScrollView>(R.id.scrollView)
        scrollView.setOnScrollChangeListener { _, _, scrollY, _, _ ->
            if (scrollY > 200) {
                // User scrolled down, stop preview
                stopHeroPreview()
            } else if (scrollY < 100 && !isHeroPreviewPlaying) {
                // User scrolled back to top, restart timer
                startHeroPreviewTimer()
            }
        }
        
        // Hero Banner is now loaded from Top 10 Series #1 (in displayTop10Items)
        // loadFeaturedMovie() // Disabled - using Top 10 Series instead
    }
    
    /**
     * Start the 5-second timer before playing hero preview
     * Only starts if featuredMovie/series and credentials are ready
     */
    private fun startHeroPreviewTimer() {
        // Cancel any existing timer
        heroPreviewRunnable?.let { heroPreviewHandler?.removeCallbacks(it) }
        
        // Don't start if already playing
        if (isHeroPreviewPlaying) {
            android.util.Log.d(TAG, "Hero preview already playing, not starting timer")
            return
        }
        
        // Check if we have the required data (movie OR series)
        if (featuredMovie == null && currentHeroSeriesId <= 0) {
            android.util.Log.d(TAG, "No featured movie/series yet, will retry when loaded")
            return
        }
        
        if (DataManager.xtreamCredentials == null) {
            android.util.Log.d(TAG, "No Xtream credentials yet, will retry when loaded")
            // Retry after 2 seconds
            heroPreviewHandler?.postDelayed({ startHeroPreviewTimer() }, 2000)
            return
        }
        
        heroPreviewRunnable = Runnable {
            android.util.Log.d(TAG, "⏰ Hero preview timer TRIGGERED - calling playHeroPreview()")
            playHeroPreview()
        }
        heroPreviewHandler?.postDelayed(heroPreviewRunnable!!, HERO_PREVIEW_DELAY)
        android.util.Log.d(TAG, "⏰ Hero preview timer started (5s delay)")
    }
    
    /**
     * Play the movie extract preview (from 15min for 1min)
     */
    private fun playHeroPreview() {
        android.util.Log.d(TAG, "🎬 playHeroPreview() called")
        
        // Check if we have a series to preview
        if (currentHeroSeriesId > 0) {
            playSeriesHeroPreview()
            return
        }
        
        // Fallback to movie preview (legacy)
        val movie = featuredMovie
        if (movie == null) {
            android.util.Log.e(TAG, "❌ Hero preview: no movie or series available")
            return
        }
        
        // Build the stream URL using DataManager credentials
        val credentials = DataManager.xtreamCredentials
        if (credentials == null) {
            android.util.Log.e(TAG, "❌ Hero preview: xtreamCredentials is NULL")
            return
        }
        val server = credentials.host
        val username = credentials.username
        val password = credentials.password
        
        val streamUrl = "${server}/movie/${username}/${password}/${movie.streamId}.${movie.containerExtension ?: "mp4"}"
        
        android.util.Log.d(TAG, "Starting hero preview: $streamUrl (from 15min)")
        
        try {
            heroExoPlayer?.let { player ->
                val mediaItem = MediaItem.fromUri(streamUrl)
                player.setMediaItem(mediaItem)
                player.prepare()
                player.seekTo(HERO_PREVIEW_START_POSITION) // Start at 15 minutes
                player.play()
                isHeroPreviewPlaying = true
                
                // Schedule stop after 1 minute
                heroPreviewHandler?.postDelayed({
                    stopHeroPreview()
                }, HERO_PREVIEW_DURATION)
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error playing hero preview", e)
        }
    }
    
    /**
     * Play series preview (S01E01) on Hero Banner
     */
    private fun playSeriesHeroPreview() {
        android.util.Log.d(TAG, "🎬 playSeriesHeroPreview() for seriesId: $currentHeroSeriesId")
        
        val credentials = DataManager.xtreamCredentials
        if (credentials == null) {
            android.util.Log.e(TAG, "❌ Hero preview: xtreamCredentials is NULL")
            return
        }
        
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val seriesInfoResult = xtreamRepository.getSeriesInfo(currentHeroSeriesId)
                seriesInfoResult.onSuccess { seriesInfo ->
                    // Get first season and first episode
                    val firstSeason = seriesInfo.episodes?.keys?.minOrNull()
                    if (firstSeason != null) {
                        val episodes = seriesInfo.episodes?.get(firstSeason)
                        val firstEpisode = episodes?.minByOrNull { it.episodeNum }
                        
                        if (firstEpisode != null) {
                            val streamUrl = "${credentials.host}/series/${credentials.username}/${credentials.password}/${firstEpisode.id}.${firstEpisode.containerExtension}"
                            android.util.Log.d(TAG, "Starting series hero preview: $streamUrl")
                            
                            withContext(Dispatchers.Main) {
                                try {
                                    heroExoPlayer?.let { player ->
                                        val mediaItem = MediaItem.fromUri(streamUrl)
                                        player.setMediaItem(mediaItem)
                                        player.prepare()
                                        player.seekTo(HERO_PREVIEW_START_POSITION) // Start at 15 minutes
                                        player.play()
                                        isHeroPreviewPlaying = true
                                        
                                        // Schedule stop after preview duration
                                        heroPreviewHandler?.postDelayed({
                                            stopHeroPreview()
                                        }, HERO_PREVIEW_DURATION)
                                    }
                                } catch (e: Exception) {
                                    android.util.Log.e(TAG, "Error starting series preview playback", e)
                                }
                            }
                        } else {
                            android.util.Log.e(TAG, "No episodes found for series")
                        }
                    } else {
                        android.util.Log.e(TAG, "No seasons found for series")
                    }
                }.onFailure { error ->
                    android.util.Log.e(TAG, "Error loading series info for preview: ${error.message}")
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error in playSeriesHeroPreview", e)
            }
        }
    }
    
    /**
     * Stop the hero preview and show the poster again
     */
    private fun stopHeroPreview() {
        heroPreviewRunnable?.let { heroPreviewHandler?.removeCallbacks(it) }
        
        if (isHeroPreviewPlaying) {
            android.util.Log.d(TAG, "Stopping hero preview")
            heroExoPlayer?.stop()
            heroExoPlayer?.clearMediaItems()
            
            // Fade out video, fade in poster
            heroVideoPlayer.animate().alpha(0f).setDuration(300).withEndAction {
                heroVideoPlayer.visibility = View.GONE
            }.start()
            heroBackground.animate().alpha(1f).setDuration(300).start()
            
            isHeroPreviewPlaying = false
        }
    }
    
    /**
     * Open YouTube TV app with the trailer
     */
    private fun openYouTubeTrailer() {
        val videoKey = youtubeTrailerKey
        if (videoKey.isNullOrEmpty()) {
            Toast.makeText(this, "Trailer non disponible", Toast.LENGTH_SHORT).show()
            return
        }
        
        try {
            // Try to open in YouTube TV app first
            val youtubeIntent = Intent(Intent.ACTION_VIEW, Uri.parse("vnd.youtube:$videoKey"))
            youtubeIntent.putExtra("force_fullscreen", true)
            
            if (youtubeIntent.resolveActivity(packageManager) != null) {
                startActivity(youtubeIntent)
                } else {
                // Fallback to web URL
                val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/watch?v=$videoKey"))
                startActivity(webIntent)
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error opening YouTube trailer", e)
            Toast.makeText(this, "Impossible d'ouvrir le trailer", Toast.LENGTH_SHORT).show()
        }
    }
    
    /**
     * Fetch trailer key from TMDB and show trailer button
     */
    private fun fetchTrailerFromTMDB(movieName: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val trailerUrlResult = TmdbClient.getTrailerUrl(movieName)
                
                if (trailerUrlResult != null) {
                    // Extract YouTube video key
                    val videoKey = trailerUrlResult.substringAfter("v=").substringBefore("&")
                    
                    withContext(Dispatchers.Main) {
                        youtubeTrailerKey = videoKey
                        btnHeroTrailer.visibility = View.VISIBLE
                        android.util.Log.d(TAG, "TMDB trailer found: $videoKey - button visible")
                    }
                } else {
                    android.util.Log.d(TAG, "No trailer found on TMDB for: $movieName")
                    withContext(Dispatchers.Main) {
                        btnHeroTrailer.visibility = View.GONE
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error fetching TMDB trailer", e)
            }
        }
    }
    
    /**
     * Load the latest/featured movie from Xtream API
     */
    private fun loadFeaturedMovie() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                android.util.Log.d(TAG, "=== LOADING FEATURED MOVIE ===")
                var latestMovie: XtreamMovie? = null
                
                // Load categories from API directly
                val categoriesResult = xtreamRepository.getMovieCategories()
                categoriesResult.onSuccess { categories ->
                    android.util.Log.d(TAG, "Featured: Got ${categories.size} movie categories")
                    
                    if (categories.isNotEmpty()) {
                        // Try first 3 categories to find a movie with cover
                        for (category in categories.take(3)) {
                            if (latestMovie != null) break
                            
                            val moviesResult = xtreamRepository.getMoviesByCategory(category.categoryId)
                            moviesResult.onSuccess { movies ->
                                android.util.Log.d(TAG, "Featured: Category ${category.categoryName} has ${movies.size} movies")
                                // Find a movie with a cover image
                                latestMovie = movies.firstOrNull { !it.streamIcon.isNullOrEmpty() }
                                    ?: movies.firstOrNull()
                            }
                        }
                    }
                }.onFailure { error ->
                    android.util.Log.e(TAG, "Featured: Error loading categories: ${error.message}")
                }
                
                // Load full movie info to get backdrop (16:9 image)
                if (latestMovie != null) {
                    val movie = latestMovie!!
                    android.util.Log.d(TAG, "Featured: Selected movie: ${movie.name}")
                    
                    val movieInfoResult = xtreamRepository.getMovieInfo(movie.streamId)
                    movieInfoResult.onSuccess { movieInfo ->
                        android.util.Log.d(TAG, "Featured: Got movie info, backdrop: ${movieInfo.info?.backdropPath?.firstOrNull()}")
                        withContext(Dispatchers.Main) {
                            displayFeaturedMovieWithBackdrop(movie, movieInfo)
                        }
                    }.onFailure { error ->
                        android.util.Log.e(TAG, "Featured: Error getting movie info: ${error.message}")
                        // Fallback to poster if backdrop not available
                        withContext(Dispatchers.Main) {
                            displayFeaturedMovie(movie)
                        }
                    }
                } else {
                    android.util.Log.w(TAG, "Featured: No movie found!")
                    withContext(Dispatchers.Main) {
                        heroTitle.text = "Bienvenue sur OXO Player"
                    }
                }
                
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error loading featured movie", e)
                withContext(Dispatchers.Main) {
                    heroTitle.text = "OXO Player"
                }
            }
        }
    }
    
    /**
     * Display featured movie with backdrop (16:9 image) - Netflix style
     */
    private fun displayFeaturedMovieWithBackdrop(movie: XtreamMovie, movieInfo: XtreamMovieInfo) {
        featuredMovie = movie
        
        // Set movie title
        val movieName = movieInfo.info?.name ?: movie.name
        heroTitle.text = movieName
        
        // Try to load backdrop first (16:9), fallback to cover/poster
        val backdropUrl = movieInfo.info?.backdropPath?.firstOrNull()
        val coverBig = movieInfo.info?.coverBig
        val movieImage = movieInfo.info?.movieImage
        val posterUrl = movie.streamIcon
        
        val imageUrl = when {
            !backdropUrl.isNullOrEmpty() -> backdropUrl
            !coverBig.isNullOrEmpty() -> coverBig
            !movieImage.isNullOrEmpty() -> movieImage
            else -> posterUrl
        }
        
        android.util.Log.d(TAG, "Hero backdrop URL: $imageUrl")
        
        if (!imageUrl.isNullOrEmpty()) {
            Glide.with(this)
                .load(imageUrl)
                .transition(DrawableTransitionOptions.withCrossFade(500))
                .centerCrop()
                .error(R.drawable.home_background)
                .into(heroBackground)
        }
        
        // Show movie info
        heroInfoLayout.visibility = View.VISIBLE
        
        // Set year
        val releaseDate = movieInfo.info?.releaseDate ?: movieInfo.info?.releaseDateAlt
        if (!releaseDate.isNullOrEmpty()) {
            heroYear.text = releaseDate.take(4)
        } else {
            heroYear.text = "2024"
        }
        
        // Set rating
        val ratingStr = movieInfo.info?.rating
        val ratingValue = ratingStr?.toDoubleOrNull() ?: movie.rating5Based ?: movie.rating?.toDoubleOrNull()
        if (ratingValue != null && ratingValue > 0) {
            heroRating.text = "⭐ ${String.format("%.1f", ratingValue)}"
        } else {
            heroRating.text = "⭐ HD"
        }
        
        // Set category/genre
        val genre = movieInfo.info?.genre
        if (!genre.isNullOrEmpty()) {
            heroCategory.text = genre.split(",").firstOrNull()?.trim() ?: "Film"
        } else {
            val categoryName = DataManager.xtreamMovieCategories
                .find { it.categoryId == movie.categoryId }?.categoryName ?: "Film"
            heroCategory.text = categoryName
        }
        
        // Set description/plot
        val plot = movieInfo.info?.plot ?: movieInfo.info?.description
        if (!plot.isNullOrEmpty()) {
            heroDescription.text = plot
            heroDescription.visibility = View.VISIBLE
        } else {
            heroDescription.visibility = View.GONE
        }
        
        android.util.Log.d(TAG, "Featured movie with backdrop: $movieName")
        
        // Check for trailer URL from Xtream API first
        val xtreamTrailer = movieInfo.info?.youtubeTrailer
        if (!xtreamTrailer.isNullOrEmpty()) {
            android.util.Log.d(TAG, "Xtream trailer available: $xtreamTrailer")
            
            // Extract YouTube video key from Xtream trailer
            if (xtreamTrailer.contains("youtube") || xtreamTrailer.contains("youtu.be")) {
                val videoKey = when {
                    xtreamTrailer.contains("v=") -> xtreamTrailer.substringAfter("v=").substringBefore("&")
                    xtreamTrailer.contains("youtu.be/") -> xtreamTrailer.substringAfter("youtu.be/").substringBefore("?")
                    else -> xtreamTrailer
                }
                youtubeTrailerKey = videoKey
                btnHeroTrailer.visibility = View.VISIBLE
                android.util.Log.d(TAG, "Xtream YouTube trailer key: $videoKey")
                return
            }
        }
        
        // Fetch trailer from TMDB and show button if available
        fetchTrailerFromTMDB(movieName)
        
        // Start preview timer after 3 seconds
        startHeroPreviewTimer()
    }
    
    /**
     * Display the featured movie in the Hero Banner
     */
    private fun displayFeaturedMovie(movie: XtreamMovie) {
        featuredMovie = movie
        
        // Set movie title
        heroTitle.text = movie.name
        
        // Load movie poster/backdrop
        if (!movie.streamIcon.isNullOrEmpty()) {
            Glide.with(this)
                .load(movie.streamIcon)
                .transition(DrawableTransitionOptions.withCrossFade(500))
                .centerCrop()
                .error(R.drawable.home_background)
                .into(heroBackground)
        }
        
        // Show movie info
        heroInfoLayout.visibility = View.VISIBLE
        
        // Set year from "added" timestamp if available
        if (!movie.added.isNullOrEmpty()) {
            try {
                val timestamp = movie.added.toLongOrNull()
                if (timestamp != null) {
                    val date = Date(timestamp * 1000)
                    val year = SimpleDateFormat("yyyy", Locale.getDefault()).format(date)
                    heroYear.text = year
                } else {
                    heroYear.text = "2024"
                }
            } catch (e: Exception) {
                heroYear.text = "2024"
            }
        } else {
            heroYear.text = "2024"
        }
        
        // Set rating if available
        val ratingValue = movie.rating5Based ?: movie.rating?.toDoubleOrNull()
        if (ratingValue != null && ratingValue > 0) {
            heroRating.text = "⭐ ${String.format("%.1f", ratingValue)}"
            heroRating.visibility = View.VISIBLE
        } else {
            heroRating.text = "⭐ HD"
        }
        
        // Set category
        val categoryName = DataManager.xtreamMovieCategories
            .find { it.categoryId == movie.categoryId }?.categoryName ?: "Film"
        heroCategory.text = categoryName
        
        // Hide description (not available in basic XtreamMovie)
        heroDescription.visibility = View.GONE
        
        android.util.Log.d(TAG, "Featured movie: ${movie.name}, cover: ${movie.streamIcon}")
        
        // Start preview timer after 3 seconds
        startHeroPreviewTimer()
    }
    
    /**
     * Open movie details page
     */
    private fun openMovieDetails(movie: XtreamMovie) {
        val ratingValue = movie.rating5Based?.toFloat() ?: movie.rating?.toFloatOrNull() ?: 0f
        val intent = Intent(this, MovieDetailActivity::class.java).apply {
            putExtra("MOVIE_ID", movie.streamId)
            putExtra("MOVIE_NAME", movie.name)
            putExtra("MOVIE_COVER", movie.streamIcon)
            putExtra("MOVIE_PLOT", "") // Plot not available in basic model
            putExtra("MOVIE_RATING", ratingValue)
            putExtra("MOVIE_YEAR", "")
            putExtra("MOVIE_EXTENSION", movie.containerExtension)
        }
        startActivity(intent)
    }
    
    // ==================== Top 10 Netflix Style ====================
    
    /**
     * Load ALL movie and series categories for better Top 10 matching
     * OPTIMIZED: Load in batches of 5 to avoid overloading TV Box
     */
    private suspend fun loadAllCategoriesForTop10() {
        android.util.Log.d(TAG, "Loading ALL categories for Top 10 matching (optimized batches)...")
        
        val BATCH_SIZE = 5 // Max 5 parallel requests for TV Box performance
        
        // Load movie categories in batches
        val movieCategories = DataManager.xtreamMovieCategories
        val movieCategoriesToLoad = movieCategories.filter { 
            DataManager.getCachedMoviesForCategory(it.categoryId) == null 
        }
        
        movieCategoriesToLoad.chunked(BATCH_SIZE).forEach { batch ->
            coroutineScope {
                batch.map { category ->
                    async(Dispatchers.IO) {
                        try {
                            val result = xtreamRepository.getMoviesByCategory(category.categoryId)
                            result.onSuccess { movies ->
                                DataManager.cacheMoviesForCategory(category.categoryId, movies)
                            }
                        } catch (e: Exception) {
                            // Skip failed categories
                        }
                    }
                }.awaitAll()
            }
        }
        
        val totalMoviesLoaded = movieCategories.sumOf { 
            DataManager.getCachedMoviesForCategory(it.categoryId)?.size ?: 0 
        }
        android.util.Log.d(TAG, "Total movies loaded from ${movieCategories.size} categories: $totalMoviesLoaded")
        
        // Load series categories in batches
        val seriesCategories = DataManager.xtreamSeriesCategories
        val seriesCategoriesToLoad = seriesCategories.filter {
            DataManager.getCachedSeriesForCategory(it.categoryId) == null
        }
        
        seriesCategoriesToLoad.chunked(BATCH_SIZE).forEach { batch ->
            coroutineScope {
                batch.map { category ->
                    async(Dispatchers.IO) {
                        try {
                            val result = xtreamRepository.getSeriesByCategory(category.categoryId)
                            result.onSuccess { series ->
                                DataManager.cacheSeriesForCategory(category.categoryId, series)
                            }
                        } catch (e: Exception) {
                            // Skip failed categories
                        }
                    }
                }.awaitAll()
            }
        }
        
        val totalSeriesLoaded = seriesCategories.sumOf { 
            DataManager.getCachedSeriesForCategory(it.categoryId)?.size ?: 0 
        }
        android.util.Log.d(TAG, "Total series loaded from ${seriesCategories.size} categories: $totalSeriesLoaded")
    }
    
    private fun setupTop10Sections() {
        // Initialize Top 10 Movies section
        top10MoviesSection = findViewById(R.id.top10MoviesSection)
        top10MoviesRecycler = findViewById(R.id.top10MoviesRecycler)
        top10MoviesTitle = findViewById(R.id.top10MoviesTitle)
        top10MoviesRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        top10MoviesRecycler.setItemViewCacheSize(10) // Cache more items for performance
        top10MoviesAdapter = Top10Adapter { item ->
            onTop10ItemClick(item)
        }
        top10MoviesRecycler.adapter = top10MoviesAdapter
        
        // Initialize Top 10 Series section
        top10SeriesSection = findViewById(R.id.top10SeriesSection)
        top10SeriesRecycler = findViewById(R.id.top10SeriesRecycler)
        top10SeriesTitle = findViewById(R.id.top10SeriesTitle)
        top10SeriesRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        top10SeriesRecycler.setItemViewCacheSize(10) // Cache more items for performance
        top10SeriesAdapter = Top10Adapter { item ->
            onTop10ItemClick(item)
        }
        top10SeriesRecycler.adapter = top10SeriesAdapter
        
        // Top 10 content will be loaded after Xtream content is ready (in loadXtreamContent)
    }
    
    private fun onTop10ItemClick(item: Top10Item) {
        if (item.isMovie) {
            // Open movie details directly using cached data
            val intent = Intent(this, MovieDetailActivity::class.java).apply {
                putExtra("IS_XTREAM", true)
                putExtra("STREAM_ID", item.xtreamId)
                putExtra("MOVIE_NAME", item.title)
                putExtra("MOVIE_COVER", item.streamIcon ?: item.posterUrl)
                putExtra("CONTAINER_EXTENSION", item.containerExtension ?: "mp4")
            }
            startActivity(intent)
        } else {
            // Open series details directly using cached data
            val intent = Intent(this, SeriesDetailActivity::class.java).apply {
                putExtra("IS_XTREAM", true)
                putExtra("SERIES_ID", item.xtreamId)
                putExtra("SERIES_NAME", item.title)
                putExtra("SERIES_COVER", item.cover ?: item.posterUrl)
            }
            startActivity(intent)
        }
    }
    
    private fun findXtreamMovieById(streamId: Int): XtreamMovie? {
        // Search in all cached movie categories
        for (category in DataManager.xtreamMovieCategories) {
            val movies = DataManager.getCachedMoviesForCategory(category.categoryId)
            movies?.find { it.streamId == streamId }?.let { return it }
        }
        return null
    }
    
    private fun findXtreamSeriesById(seriesId: Int): XtreamSeries? {
        // Search in all cached series categories
        for (category in DataManager.xtreamSeriesCategories) {
            val series = DataManager.getCachedSeriesForCategory(category.categoryId)
            series?.find { it.seriesId == seriesId }?.let { return it }
        }
        return null
    }
    
    private fun loadTop10Content() {
        android.util.Log.d(TAG, "🚀 loadTop10Content() CALLED")
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                android.util.Log.d(TAG, "=== LOADING TOP 10 CONTENT ===")
                
                // FAST PATH: Check if we have cached Top 10 results (final matched list)
                val cachedTop10Movies = Top10Cache.loadTop10Movies()
                val cachedTop10Series = Top10Cache.loadTop10Series()
                
                if (Top10Cache.isTop10CacheValid() && cachedTop10Movies != null && cachedTop10Series != null) {
                    // INSTANT display from cache!
                    android.util.Log.d(TAG, "⚡ INSTANT: Using cached Top 10 results (${cachedTop10Movies.size} movies, ${cachedTop10Series.size} series)")
                    
                    withContext(Dispatchers.Main) {
                        displayTop10FromCache(cachedTop10Movies, cachedTop10Series)
                    }
                    return@launch
                }
                
                android.util.Log.d(TAG, "⏳ Cache miss, trying server-side Top 10...")
                
                // NEW: Try to get Top 10 from server first (fast!)
                val xtreamHost = DataManager.xtreamCredentials?.host
                if (xtreamHost != null) {
                    val serverTop10 = com.oxoplayer.tv.data.api.Top10ApiClient.getTop10ForHost(xtreamHost)
                    
                    if (serverTop10 != null && (serverTop10.movies.isNotEmpty() || serverTop10.series.isNotEmpty())) {
                        android.util.Log.d(TAG, "🚀 SERVER: Got Top 10 from OXO server!")
                        
                        // Convert server response to our format
                        val serverMovies = serverTop10.movies.map {
                            Top10Item(it.rank, it.title, it.posterUrl, it.xtreamId, true, it.badge,
                                it.streamIcon, it.cover, it.containerExtension)
                        }
                        val serverSeries = serverTop10.series.map {
                            Top10Item(it.rank, it.title, it.posterUrl, it.xtreamId, false, it.badge,
                                it.streamIcon, it.cover, it.containerExtension)
                        }
                        
                        // Cache server results
                        val cachedMovieItems = serverMovies.map { 
                            CachedTop10Item(it.rank, it.title, it.posterUrl, it.xtreamId, it.isMovie, it.badge,
                                it.streamIcon, it.cover, it.containerExtension)
                        }
                        val cachedSeriesItems = serverSeries.map {
                            CachedTop10Item(it.rank, it.title, it.posterUrl, it.xtreamId, it.isMovie, it.badge,
                                it.streamIcon, it.cover, it.containerExtension)
                        }
                        Top10Cache.saveTop10Movies(cachedMovieItems)
                        Top10Cache.saveTop10Series(cachedSeriesItems)
                        
                        withContext(Dispatchers.Main) {
                            displayTop10Items(serverMovies, serverSeries)
                        }
                        return@launch
                    }
                }
                
                android.util.Log.d(TAG, "⏳ Server Top 10 not available, falling back to client-side computation...")
                
                // FALLBACK: Load Xtream data from DataManager and compute locally
                android.util.Log.d(TAG, "⏳ Loading Xtream data from DataManager...")
                loadAllCategoriesForTop10()
                
                // Collect all movies from DataManager cache
                val allXtreamMovies = mutableListOf<XtreamMovie>()
                for (category in DataManager.xtreamMovieCategories) {
                    DataManager.getCachedMoviesForCategory(category.categoryId)?.let {
                        allXtreamMovies.addAll(it)
                    }
                }
                
                // Collect all series from DataManager cache
                val allXtreamSeries = mutableListOf<XtreamSeries>()
                for (category in DataManager.xtreamSeriesCategories) {
                    DataManager.getCachedSeriesForCategory(category.categoryId)?.let {
                        allXtreamSeries.addAll(it)
                    }
                }
                
                android.util.Log.d(TAG, "Total Xtream movies: ${allXtreamMovies.size}")
                android.util.Log.d(TAG, "Total Xtream series: ${allXtreamSeries.size}")
                
                // Get trending movies and series from TMDB
                val trendingMovies = TmdbClient.getTrendingMovies()
                val trendingSeries = TmdbClient.getTrendingSeries()
                
                android.util.Log.d(TAG, "TMDB trending movies: ${trendingMovies.size}")
                android.util.Log.d(TAG, "TMDB trending series: ${trendingSeries.size}")
                
                // Match with Xtream catalog
                val top10Movies = matchTrendingMoviesWithXtream(trendingMovies, allXtreamMovies)
                val top10Series = matchTrendingSeriesWithXtream(trendingSeries, allXtreamSeries)
                
                android.util.Log.d(TAG, "Matched Top 10 movies: ${top10Movies.size}")
                android.util.Log.d(TAG, "Matched Top 10 series: ${top10Series.size}")
                
                // Save Top 10 results to cache for instant loading next time
                val cachedMovieItems = top10Movies.map { 
                    CachedTop10Item(it.rank, it.title, it.posterUrl, it.xtreamId, it.isMovie, it.badge,
                        it.streamIcon, it.cover, it.containerExtension)
                }
                val cachedSeriesItems = top10Series.map {
                    CachedTop10Item(it.rank, it.title, it.posterUrl, it.xtreamId, it.isMovie, it.badge,
                        it.streamIcon, it.cover, it.containerExtension)
                }
                Top10Cache.saveTop10Movies(cachedMovieItems)
                Top10Cache.saveTop10Series(cachedSeriesItems)
                
                withContext(Dispatchers.Main) {
                    displayTop10Items(top10Movies, top10Series)
                }
                
            } catch (e: Exception) {
                android.util.Log.e(TAG, "❌ ERROR loading Top 10 content: ${e.message}", e)
                e.printStackTrace()
            }
        }
    }
    
    /**
     * Display Top 10 items on the UI
     */
    private fun displayTop10Items(top10Movies: List<Top10Item>, top10Series: List<Top10Item>) {
        // Update Top 10 Movies
        if (top10Movies.isNotEmpty()) {
            top10MoviesAdapter.updateItems(top10Movies)
            top10MoviesSection.visibility = View.VISIBLE
            // Dynamic title: "Top 10" if 10 matches, "Films Populaires" otherwise
            top10MoviesTitle.text = if (top10Movies.size >= 10) 
                "Top 10 Films cette semaine" 
            else 
                "🔥 Films Populaires"
            android.util.Log.d(TAG, "Top 10 Movies section VISIBLE with ${top10Movies.size} items")
        } else {
            top10MoviesSection.visibility = View.GONE
        }
        
        // Update Top 10 Series
        if (top10Series.isNotEmpty()) {
            top10SeriesAdapter.updateItems(top10Series)
            top10SeriesSection.visibility = View.VISIBLE
            // Dynamic title: "Top 10" if 10 matches, "Séries Populaires" otherwise
            top10SeriesTitle.text = if (top10Series.size >= 10) 
                "Top 10 Séries cette semaine" 
            else 
                "🔥 Séries Populaires"
            android.util.Log.d(TAG, "Top 10 Series section VISIBLE")
            
            // Display #1 Series on Hero Banner
            displayHeroFromTop10Series(top10Series.first())
        } else {
            top10SeriesSection.visibility = View.GONE
        }
    }
    
    /**
     * Display #1 Series from Top 10 on Hero Banner with TMDB data
     */
    private fun displayHeroFromTop10Series(series: Top10Item) {
        android.util.Log.d(TAG, "🎬 Displaying Hero from Top 10 Series: ${series.title}")
        
        // Store series info for play button (we'll need to fetch XtreamSeries for playback)
        featuredMovie = null // Clear any previous movie
        currentHeroSeriesId = series.xtreamId
        
        // Set title
        heroTitle.text = series.title
        
        // Show info layout with placeholder data
        heroInfoLayout.visibility = View.VISIBLE
        heroYear.text = "2024"
        heroRating.text = "⭐ HD"
        heroCategory.text = "Série"
        heroDescription.visibility = View.GONE
        
        // Load poster temporarily while fetching TMDB backdrop
        if (!series.posterUrl.isNullOrEmpty()) {
            Glide.with(this)
                .load(series.posterUrl)
                .centerCrop()
                .into(heroBackground)
        }
        
        // Setup button click listeners for series
        btnHeroPlay.setOnClickListener {
            stopHeroPreview()
            playFirstEpisodeOfSeries(series.xtreamId)
        }
        
        btnHeroInfo.setOnClickListener {
            stopHeroPreview()
            openSeriesDetails(series.xtreamId)
        }
        
        // Fetch TMDB data for backdrop (16:9), description, rating, year
        fetchTmdbDataForHeroSeries(series.title)
        
        // Fetch trailer from TMDB
        fetchTrailerFromTMDB(series.title)
        
        // Start the preview timer
        startHeroPreviewTimer()
        
        android.util.Log.d(TAG, "Hero Banner set to Top 10 #1 Series: ${series.title}")
    }
    
    /**
     * Fetch TMDB data for Hero Series (backdrop, description, rating, year)
     */
    private fun fetchTmdbDataForHeroSeries(seriesTitle: String) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                // Clean title (remove year in parentheses)
                val cleanTitle = seriesTitle.replace(Regex("\\s*\\(\\d{4}\\)\\s*$"), "").trim()
                android.util.Log.d(TAG, "🔍 Searching TMDB for series: $cleanTitle")
                
                val response = TmdbClient.service.searchSeries(cleanTitle)
                if (response.isSuccessful && response.body() != null) {
                    val results = response.body()!!.results
                    if (results.isNotEmpty()) {
                        val tmdbSeries = results.first()
                        android.util.Log.d(TAG, "✅ Found TMDB series: ${tmdbSeries.name}, backdrop: ${tmdbSeries.backdrop_path}")
                        
                        withContext(Dispatchers.Main) {
                            // Load backdrop (16:9 image)
                            val backdropUrl = TmdbClient.getBackdropUrl(tmdbSeries.backdrop_path)
                            if (!backdropUrl.isNullOrEmpty()) {
                                android.util.Log.d(TAG, "🖼️ Loading Hero backdrop: $backdropUrl")
                                Glide.with(this@HomeActivity)
                                    .load(backdropUrl)
                                    .centerCrop()
                                    .into(heroBackground)
                            }
                            
                            // Update year
                            val year = tmdbSeries.first_air_date?.take(4)
                            if (!year.isNullOrEmpty()) {
                                heroYear.text = year
                            }
                            
                            // Update rating
                            val rating = tmdbSeries.vote_average
                            if (rating != null && rating > 0) {
                                heroRating.text = "⭐ ${String.format("%.1f", rating)}"
                            }
                            
                            // Update description
                            val overview = tmdbSeries.overview
                            if (!overview.isNullOrEmpty()) {
                                heroDescription.text = overview
                                heroDescription.visibility = View.VISIBLE
                            }
                        }
                    } else {
                        android.util.Log.w(TAG, "No TMDB results for: $cleanTitle")
                    }
                } else {
                    android.util.Log.e(TAG, "TMDB search failed: ${response.code()}")
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error fetching TMDB data for Hero", e)
            }
        }
    }
    
    // Store current hero series ID for playback
    private var currentHeroSeriesId: Int = -1
    
    /**
     * Play first episode (S01E01) of a series
     */
    private fun playFirstEpisodeOfSeries(seriesId: Int) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val seriesInfoResult = xtreamRepository.getSeriesInfo(seriesId)
                seriesInfoResult.onSuccess { seriesInfo ->
                    // Get first season
                    val firstSeason = seriesInfo.episodes?.keys?.minOrNull()
                    if (firstSeason != null) {
                        val episodes = seriesInfo.episodes?.get(firstSeason)
                        val firstEpisode = episodes?.minByOrNull { it.episodeNum }
                        
                        if (firstEpisode != null) {
                            withContext(Dispatchers.Main) {
                                // Build stream URL
                                val credentials = DataManager.xtreamCredentials
                                if (credentials != null) {
                                    val streamUrl = "${credentials.host}/series/${credentials.username}/${credentials.password}/${firstEpisode.id}.${firstEpisode.containerExtension}"
                                    
                                    val intent = Intent(this@HomeActivity, PlayerActivity::class.java).apply {
                                        putExtra("STREAM_URL", streamUrl)
                                        putExtra("STREAM_NAME", "${seriesInfo.info?.name} - S${firstSeason}E${firstEpisode.episodeNum}")
                                        putExtra("IS_LIVE", false)
                                    }
                                    startActivity(intent)
                                }
                            }
                        }
                    }
                }.onFailure { error ->
                    android.util.Log.e(TAG, "Error loading series info: ${error.message}")
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error playing first episode", e)
            }
        }
    }
    
    /**
     * Open series details page
     */
    private fun openSeriesDetails(seriesId: Int) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                // Find the XtreamSeries from cache
                var foundSeries: XtreamSeries? = null
                for (category in DataManager.xtreamSeriesCategories) {
                    DataManager.getCachedSeriesForCategory(category.categoryId)?.let { seriesList ->
                        foundSeries = seriesList.find { it.seriesId == seriesId }
                        if (foundSeries != null) return@let
                    }
                    if (foundSeries != null) break
                }
                
                if (foundSeries != null) {
                    val series = foundSeries!!
                    withContext(Dispatchers.Main) {
                        val intent = Intent(this@HomeActivity, SeriesDetailActivity::class.java).apply {
                            putExtra("SERIES_ID", series.seriesId)
                            putExtra("SERIES_NAME", series.name)
                            putExtra("SERIES_COVER", series.cover)
                            putExtra("SERIES_PLOT", series.plot)
                            putExtra("SERIES_CAST", series.cast)
                            putExtra("SERIES_DIRECTOR", series.director)
                            putExtra("SERIES_GENRE", series.genre)
                            putExtra("SERIES_RATING", series.rating)
                        }
                        startActivity(intent)
                    }
                } else {
                    android.util.Log.e(TAG, "Series not found in cache: $seriesId")
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error opening series details", e)
            }
        }
    }
    
    /**
     * Display Top 10 from cached results (instant!)
     */
    private fun displayTop10FromCache(cachedMovies: List<CachedTop10Item>, cachedSeries: List<CachedTop10Item>) {
        // Convert cached items to Top10Item with all navigation data
        val top10Movies = cachedMovies.map {
            Top10Item(it.rank, it.title, it.posterUrl, it.xtreamId, it.isMovie, it.badge,
                it.streamIcon, it.cover, it.containerExtension)
        }
        val top10Series = cachedSeries.map {
            Top10Item(it.rank, it.title, it.posterUrl, it.xtreamId, it.isMovie, it.badge,
                it.streamIcon, it.cover, it.containerExtension)
        }
        
        // Update Top 10 Movies
        if (top10Movies.isNotEmpty()) {
            top10MoviesAdapter.updateItems(top10Movies)
            top10MoviesSection.visibility = View.VISIBLE
            top10MoviesTitle.text = if (top10Movies.size >= 10) 
                "Top 10 Films cette semaine" 
            else 
                "🔥 Films Populaires"
            android.util.Log.d(TAG, "⚡ Top 10 Movies INSTANT display: ${top10Movies.size} items")
        } else {
            top10MoviesSection.visibility = View.GONE
        }
        
        // Update Top 10 Series
        if (top10Series.isNotEmpty()) {
            top10SeriesAdapter.updateItems(top10Series)
            top10SeriesSection.visibility = View.VISIBLE
            top10SeriesTitle.text = if (top10Series.size >= 10) 
                "Top 10 Séries cette semaine" 
            else 
                "🔥 Séries Populaires"
            android.util.Log.d(TAG, "⚡ Top 10 Series INSTANT display: ${top10Series.size} items")
        } else {
            top10SeriesSection.visibility = View.GONE
        }
    }
    
    /**
     * Match TMDB trending movies with Xtream catalog (OPTIMIZED with index by title+year)
     */
    private fun matchTrendingMoviesWithXtream(trendingMovies: List<com.oxoplayer.tv.data.api.TmdbMovie>, allXtreamMovies: List<XtreamMovie>): List<Top10Item> {
        android.util.Log.d(TAG, "🔍 Building movie index for ${allXtreamMovies.size} movies...")
        
        // Build TWO indexes:
        // 1. title_year -> movie (for exact year match)
        // 2. title -> list of movies (fallback)
        val movieIndexByTitleYear = mutableMapOf<String, XtreamMovie>()
        val movieIndexByTitle = mutableMapOf<String, MutableList<XtreamMovie>>()
        
        for (movie in allXtreamMovies) {
            val normalizedTitle = normalizeTitle(extractMainTitle(movie.name))
            if (normalizedTitle.length >= 3) {
                // Extract year from Xtream movie name (e.g. "Avatar (2009)" -> "2009")
                val yearMatch = Regex("\\((19|20)\\d{2}\\)").find(movie.name)
                val xtreamYear = yearMatch?.value?.replace("(", "")?.replace(")", "")
                
                // Index by title + year
                if (xtreamYear != null) {
                    val keyWithYear = "${normalizedTitle}_${xtreamYear}"
                    movieIndexByTitleYear[keyWithYear] = movie
                }
                
                // Index by title only (for fallback)
                movieIndexByTitle.getOrPut(normalizedTitle) { mutableListOf() }.add(movie)
            }
        }
        android.util.Log.d(TAG, "✅ Movie index built: ${movieIndexByTitleYear.size} with year, ${movieIndexByTitle.size} by title")
        
        val result = mutableListOf<Top10Item>()
        var rank = 1
        
        for (tmdbMovie in trendingMovies) {
            if (rank > 10) break
            
            val tmdbTitle = normalizeTitle(extractMainTitle(tmdbMovie.title))
            val tmdbYear = tmdbMovie.release_date?.take(4) // "2024-01-15" -> "2024"
            
            var matchedMovie: XtreamMovie? = null
            
            // 1. Try exact match: title + year
            if (tmdbYear != null) {
                val keyWithYear = "${tmdbTitle}_${tmdbYear}"
                matchedMovie = movieIndexByTitleYear[keyWithYear]
                
                // 2. Try year ±1 (for release date differences)
                if (matchedMovie == null) {
                    val yearInt = tmdbYear.toIntOrNull()
                    if (yearInt != null) {
                        matchedMovie = movieIndexByTitleYear["${tmdbTitle}_${yearInt - 1}"]
                            ?: movieIndexByTitleYear["${tmdbTitle}_${yearInt + 1}"]
                    }
                }
            }
            
            // 3. Fallback: title only, but ONLY if year matches in name
            if (matchedMovie == null && tmdbYear != null) {
                val candidates = movieIndexByTitle[tmdbTitle]
                matchedMovie = candidates?.find { it.name.contains(tmdbYear) }
            }
            
            if (matchedMovie != null) {
                android.util.Log.d(TAG, "✅ Matched: ${tmdbMovie.title} ($tmdbYear) -> ${matchedMovie.name}")
                result.add(Top10Item(
                    rank = rank,
                    title = matchedMovie.name,
                    posterUrl = TmdbClient.getPosterUrl(tmdbMovie.poster_path) ?: matchedMovie.streamIcon,
                    xtreamId = matchedMovie.streamId,
                    isMovie = true,
                    badge = if (rank <= 3) "Tendance" else null,
                    streamIcon = matchedMovie.streamIcon,
                    cover = null,
                    containerExtension = matchedMovie.containerExtension
                ))
                rank++
            } else {
                android.util.Log.d(TAG, "❌ No match for: ${tmdbMovie.title} ($tmdbYear)")
            }
        }
        
        android.util.Log.d(TAG, "🎬 Total matched movies: ${result.size}")
        return result
    }
    
    /**
     * Match TMDB trending series with Xtream catalog (OPTIMIZED with index by title+year)
     */
    private fun matchTrendingSeriesWithXtream(trendingSeries: List<com.oxoplayer.tv.data.api.TmdbSeries>, allXtreamSeries: List<XtreamSeries>): List<Top10Item> {
        android.util.Log.d(TAG, "🔍 Building series index for ${allXtreamSeries.size} series...")
        
        // Build TWO indexes:
        // 1. title_year -> series (for exact year match)
        // 2. title -> list of series (fallback)
        val seriesIndexByTitleYear = mutableMapOf<String, XtreamSeries>()
        val seriesIndexByTitle = mutableMapOf<String, MutableList<XtreamSeries>>()
        
        for (series in allXtreamSeries) {
            val normalizedTitle = normalizeTitle(extractMainTitle(series.name))
            if (normalizedTitle.length >= 3) {
                // Extract year from Xtream series name
                val yearMatch = Regex("\\((19|20)\\d{2}\\)").find(series.name)
                val xtreamYear = yearMatch?.value?.replace("(", "")?.replace(")", "")
                
                // Index by title + year
                if (xtreamYear != null) {
                    val keyWithYear = "${normalizedTitle}_${xtreamYear}"
                    seriesIndexByTitleYear[keyWithYear] = series
                }
                
                // Index by title only (for fallback)
                seriesIndexByTitle.getOrPut(normalizedTitle) { mutableListOf() }.add(series)
            }
        }
        android.util.Log.d(TAG, "✅ Series index built: ${seriesIndexByTitleYear.size} with year, ${seriesIndexByTitle.size} by title")
        
        val result = mutableListOf<Top10Item>()
        var rank = 1
        
        for (tmdbSeries in trendingSeries) {
            if (rank > 10) break
            
            val tmdbTitle = normalizeTitle(extractMainTitle(tmdbSeries.name))
            val tmdbYear = tmdbSeries.first_air_date?.take(4)
            
            var matchedSeries: XtreamSeries? = null
            
            // 1. Try exact match: title + year
            if (tmdbYear != null) {
                val keyWithYear = "${tmdbTitle}_${tmdbYear}"
                matchedSeries = seriesIndexByTitleYear[keyWithYear]
                
                // 2. Try year ±1 (for release date differences)
                if (matchedSeries == null) {
                    val yearInt = tmdbYear.toIntOrNull()
                    if (yearInt != null) {
                        matchedSeries = seriesIndexByTitleYear["${tmdbTitle}_${yearInt - 1}"]
                            ?: seriesIndexByTitleYear["${tmdbTitle}_${yearInt + 1}"]
                    }
                }
            }
            
            // 3. Fallback: title only, but ONLY if year matches in name
            if (matchedSeries == null && tmdbYear != null) {
                val candidates = seriesIndexByTitle[tmdbTitle]
                matchedSeries = candidates?.find { it.name.contains(tmdbYear) }
            }
            
            if (matchedSeries != null) {
                android.util.Log.d(TAG, "✅ Matched: ${tmdbSeries.name} ($tmdbYear) -> ${matchedSeries.name}")
                result.add(Top10Item(
                    rank = rank,
                    title = matchedSeries.name,
                    posterUrl = TmdbClient.getPosterUrl(tmdbSeries.poster_path) ?: matchedSeries.cover,
                    xtreamId = matchedSeries.seriesId,
                    isMovie = false,
                    badge = if (rank <= 3) "Tendance" else null,
                    streamIcon = null,
                    cover = matchedSeries.cover,
                    containerExtension = null,
                    // TMDB data for Hero Banner
                    tmdbBackdropUrl = TmdbClient.getBackdropUrl(tmdbSeries.backdrop_path),
                    tmdbOverview = tmdbSeries.overview,
                    tmdbVoteAverage = tmdbSeries.vote_average,
                    tmdbYear = tmdbYear
                ))
                rank++
            } else {
                android.util.Log.d(TAG, "❌ No match for: ${tmdbSeries.name} ($tmdbYear)")
            }
        }
        
        android.util.Log.d(TAG, "📺 Total matched series: ${result.size}")
        return result
    }
    
    /**
     * Extract main title (remove year, subtitle after colon)
     */
    private fun extractMainTitle(title: String): String {
        return title
            .replace(Regex("\\s*\\d{4}\\s*$"), "")  // Remove year at end
            .replace(Regex("\\s*-\\s*\\d{4}.*$"), "") // Remove "- 2024..." 
            .split(":").first()                       // Take part before colon
            .trim()
    }
    
    /**
     * Calculate similarity between two strings (0.0 to 1.0)
     * Very strict: requires high match to avoid false positives
     */
    private fun calculateSimilarity(s1: String, s2: String): Float {
        if (s1.isEmpty() || s2.isEmpty()) return 0f
        if (s1 == s2) return 1f
        
        val longer = if (s1.length > s2.length) s1 else s2
        val shorter = if (s1.length > s2.length) s2 else s1
        
        // Both strings must be similar in length (within 30%)
        if (shorter.length.toFloat() / longer.length < 0.7f) return 0f
        
        // Check if shorter is contained in longer
        if (longer.contains(shorter) && shorter.length.toFloat() / longer.length >= 0.85f) {
            return shorter.length.toFloat() / longer.length
        }
        
        // Levenshtein-based similarity
        val editDistance = levenshteinDistance(s1, s2)
        return 1f - (editDistance.toFloat() / longer.length)
    }
    
    /**
     * Calculate Levenshtein distance between two strings
     */
    private fun levenshteinDistance(s1: String, s2: String): Int {
        val dp = Array(s1.length + 1) { IntArray(s2.length + 1) }
        
        for (i in 0..s1.length) dp[i][0] = i
        for (j in 0..s2.length) dp[0][j] = j
        
        for (i in 1..s1.length) {
            for (j in 1..s2.length) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = minOf(
                    dp[i - 1][j] + 1,      // deletion
                    dp[i][j - 1] + 1,      // insertion
                    dp[i - 1][j - 1] + cost // substitution
                )
            }
        }
        
        return dp[s1.length][s2.length]
    }
    
    /**
     * Normalize title for comparison (remove special chars, lowercase, etc.)
     */
    private fun normalizeTitle(title: String): String {
        return title
            .lowercase()
            .replace(Regex("\\([^)]*\\)"), "") // Remove parentheses content (year, etc.)
            .replace(Regex("[^a-z0-9\\s]"), "") // Remove special characters
            .replace(Regex("\\s+"), " ")        // Normalize spaces
            .trim()
    }
    
    
    // ==================== Continue Watching ====================
    
    private fun setupContinueWatching() {
        // Initialize continue watching sections
        continueMoviesSection = findViewById(R.id.continueMoviesSection)
        continueMoviesRecycler = findViewById(R.id.continueMoviesRecycler)
        continueMoviesRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        
        continueSeriesSection = findViewById(R.id.continueSeriesSection)
        continueSeriesRecycler = findViewById(R.id.continueSeriesRecycler)
        continueSeriesRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        
        recentChannelsSection = findViewById(R.id.recentChannelsSection)
        recentChannelsRecycler = findViewById(R.id.recentChannelsRecycler)
        recentChannelsRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        
        refreshContinueWatching()
    }
    
    private fun refreshContinueWatching() {
        // Continue watching movies
        val recentMovies = WatchProgressManager.getRecentMovies(5)
        android.util.Log.d(TAG, "=== CONTINUE WATCHING MOVIES DEBUG ===")
        android.util.Log.d(TAG, "Recent movies count: ${recentMovies.size}")
        recentMovies.forEachIndexed { index, movie ->
            android.util.Log.d(TAG, "Movie $index: ${movie.title}, cover: ${movie.cover}, progress: ${movie.progressPercent}")
        }
        if (recentMovies.isNotEmpty()) {
            continueMoviesSection.visibility = View.VISIBLE
            continueMoviesRecycler.adapter = ContinueWatchingAdapter(recentMovies) { progress ->
                playContinueWatching(progress)
            }
            android.util.Log.d(TAG, "Showing ${recentMovies.size} continue watching movies - VISIBLE")
        } else {
            continueMoviesSection.visibility = View.GONE
            android.util.Log.d(TAG, "No movies to continue - HIDDEN")
        }
        
        // Continue watching series
        val recentSeries = WatchProgressManager.getRecentSeries(5)
        if (recentSeries.isNotEmpty()) {
            continueSeriesSection.visibility = View.VISIBLE
            continueSeriesRecycler.adapter = ContinueWatchingAdapter(recentSeries) { progress ->
                playContinueWatching(progress)
            }
            android.util.Log.d(TAG, "Showing ${recentSeries.size} continue watching series")
        } else {
            continueSeriesSection.visibility = View.GONE
        }
        
        // Recent channels
        val recentChannels = WatchProgressManager.getRecentChannels(5)
        android.util.Log.d(TAG, "=== RECENT CHANNELS DEBUG ===")
        android.util.Log.d(TAG, "Recent channels count: ${recentChannels.size}")
        recentChannels.forEachIndexed { index, ch ->
            android.util.Log.d(TAG, "Channel $index: ${ch.name}, logo: ${ch.logo}, url: ${ch.url}")
        }
        if (recentChannels.isNotEmpty()) {
            recentChannelsSection.visibility = View.VISIBLE
            recentChannelsRecycler.adapter = RecentChannelsAdapter(recentChannels) { channel ->
                playRecentChannel(channel)
            }
            android.util.Log.d(TAG, "Showing ${recentChannels.size} recent channels - VISIBLE")
        } else {
            recentChannelsSection.visibility = View.GONE
            android.util.Log.d(TAG, "No recent channels - HIDDEN")
        }
    }
    
    private fun playContinueWatching(progress: WatchProgressManager.WatchProgress) {
        android.util.Log.d(TAG, "Playing continue watching: ${progress.title}")
        val intent = Intent(this, PlayerActivity::class.java).apply {
            putExtra("STREAM_URL", progress.url)
            putExtra("TITLE", progress.title)
            putExtra("TYPE", progress.type)
            putExtra("COVER", progress.cover) // Pass cover image
            
            // Pass series metadata if this is a series
            if (progress.type == "SERIES") {
                putExtra("SERIES_ID", progress.seriesId)
                putExtra("SERIES_NAME", progress.seriesName)
                putExtra("CURRENT_SEASON", progress.seasonNumber ?: 1)
                putExtra("CURRENT_EPISODE_ID", progress.episodeId)
                putExtra("SEASONS_JSON", progress.seasonsJson)
                
                android.util.Log.d(TAG, "Passing series metadata - ID: ${progress.seriesId}, Season: ${progress.seasonNumber}, EpisodeId: ${progress.episodeId}")
            }
        }
        startActivity(intent)
    }
    
    private fun playRecentChannel(channel: WatchProgressManager.RecentChannel) {
        android.util.Log.d(TAG, "Playing recent channel: ${channel.name}")
        
        // Also add to recent channels (to update the timestamp)
        WatchProgressManager.addRecentChannel(
            url = channel.url,
            name = channel.name,
            logo = channel.logo,
            category = channel.category
        )
        
        val intent = Intent(this, PlayerActivity::class.java).apply {
            putExtra("STREAM_URL", channel.url)
            putExtra("TITLE", channel.name)
            putExtra("TYPE", "LIVE")
        }
        startActivity(intent)
    }
    
    private fun setupContentRows() {
        // Setup RecyclerViews with performance optimizations for TV Box
        liveChannelsRecycler = findViewById(R.id.liveChannelsRecycler)
        liveChannelsRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        liveChannelsRecycler.setItemViewCacheSize(15) // Cache more items for performance
        
        moviesRecycler = findViewById(R.id.moviesRecycler)
        moviesRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        moviesRecycler.setItemViewCacheSize(15) // Cache more items for performance
        
        seriesRecycler = findViewById(R.id.seriesRecycler)
        seriesRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        seriesRecycler.setItemViewCacheSize(15) // Cache more items for performance
        
        // Setup category selector buttons
        btnLiveCategorySelector = findViewById(R.id.btnLiveCategorySelector)
        btnMovieCategorySelector = findViewById(R.id.btnMovieCategorySelector)
        btnSeriesCategorySelector = findViewById(R.id.btnSeriesCategorySelector)
        
        btnLiveCategorySelector.setOnClickListener { showLiveCategoryDialog() }
        btnMovieCategorySelector.setOnClickListener { showMovieCategoryDialog() }
        btnSeriesCategorySelector.setOnClickListener { showSeriesCategoryDialog() }
        
        if (isXtreamMode) {
            android.util.Log.d(TAG, "Loading content with Xtream API")
            loadXtreamContent()
        } else {
            android.util.Log.d(TAG, "Loading content from M3U data")
            loadLegacyContent()
        }
    }
    
    // ==================== Category Selection Dialogs ====================
    
    private fun showLiveCategoryDialog() {
        val categories = DataManager.xtreamLiveCategories
        if (categories.isEmpty()) {
            Toast.makeText(this, "Aucune catégorie disponible", Toast.LENGTH_SHORT).show()
            return
        }
        
        val categoryNames = listOf("Toutes") + categories.map { it.categoryName }
        val categoryIds = listOf<String?>(null) + categories.map { it.categoryId }
        
        showCategoryDialog("📺 Catégorie Live TV", categoryNames) { which ->
            selectedLiveCategoryId = categoryIds[which]
            btnLiveCategorySelector.text = "${categoryNames[which]} ▼"
            loadLiveChannelsForCategory(selectedLiveCategoryId)
        }
    }
    
    private fun showMovieCategoryDialog() {
        val categories = DataManager.xtreamMovieCategories
        if (categories.isEmpty()) {
            Toast.makeText(this, "Aucune catégorie disponible", Toast.LENGTH_SHORT).show()
            return
        }
        
        val categoryNames = listOf("Toutes") + categories.map { it.categoryName }
        val categoryIds = listOf<String?>(null) + categories.map { it.categoryId }
        
        showCategoryDialog("🎬 Catégorie Films", categoryNames) { which ->
            selectedMovieCategoryId = categoryIds[which]
            btnMovieCategorySelector.text = "${categoryNames[which]} ▼"
            loadMoviesForCategory(selectedMovieCategoryId)
        }
    }
    
    private fun showSeriesCategoryDialog() {
        val categories = DataManager.xtreamSeriesCategories
        if (categories.isEmpty()) {
            Toast.makeText(this, "Aucune catégorie disponible", Toast.LENGTH_SHORT).show()
            return
        }
        
        val categoryNames = listOf("Toutes") + categories.map { it.categoryName }
        val categoryIds = listOf<String?>(null) + categories.map { it.categoryId }
        
        showCategoryDialog("📺 Catégorie Séries", categoryNames) { which ->
            selectedSeriesCategoryId = categoryIds[which]
            btnSeriesCategorySelector.text = "${categoryNames[which]} ▼"
            loadSeriesForCategory(selectedSeriesCategoryId)
        }
    }
    
    /**
     * Show custom dialog with RecyclerView for TV remote focus support
     */
    private fun showCategoryDialog(title: String, items: List<String>, onItemSelected: (Int) -> Unit) {
        val dialog = android.app.Dialog(this, R.style.Theme_OXOPlayer_Dialog)
        dialog.setContentView(R.layout.dialog_category_selector)
        
        val titleView = dialog.findViewById<android.widget.TextView>(R.id.dialogTitle)
        val recyclerView = dialog.findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.categoryRecyclerView)
        
        titleView.text = title
        
        recyclerView.layoutManager = androidx.recyclerview.widget.LinearLayoutManager(this)
        recyclerView.adapter = com.oxoplayer.tv.ui.common.DialogCategoryAdapter(items) { position ->
            onItemSelected(position)
            dialog.dismiss()
        }
        
        // Focus first item for TV remote
        recyclerView.post {
            recyclerView.getChildAt(0)?.requestFocus()
        }
        
        dialog.show()
    }
    
    private fun loadLiveChannelsForCategory(categoryId: String?) {
        lifecycleScope.launch(Dispatchers.IO) {
            val channels = if (categoryId == null) {
                // Show all channels
                DataManager.allXtreamLiveStreams.take(20)
            } else {
                // Load channels for specific category
                val result = xtreamRepository.getLiveStreamsByCategory(categoryId)
                result.getOrNull()?.take(20) ?: emptyList()
            }
            
            withContext(Dispatchers.Main) {
                displayXtreamLiveChannels(channels)
            }
        }
    }
    
    private fun loadMoviesForCategory(categoryId: String?) {
        lifecycleScope.launch(Dispatchers.IO) {
            val movies = if (categoryId == null) {
                // Show movies from first category
                val firstCategoryId = DataManager.xtreamMovieCategories.firstOrNull()?.categoryId
                if (firstCategoryId != null) {
                    DataManager.getCachedMoviesForCategory(firstCategoryId)?.take(20) ?: emptyList()
                } else emptyList()
            } else {
                // Load movies for specific category
                val cached = DataManager.getCachedMoviesForCategory(categoryId)
                if (cached != null) {
                    cached.take(20)
                } else {
                    val result = xtreamRepository.getMoviesByCategory(categoryId)
                    val movies = result.getOrNull() ?: emptyList()
                    if (movies.isNotEmpty()) {
                        DataManager.cacheMoviesForCategory(categoryId, movies)
                    }
                    movies.take(20)
                }
            }
            
            withContext(Dispatchers.Main) {
                displayXtreamMovies(movies)
            }
        }
    }
    
    private fun loadSeriesForCategory(categoryId: String?) {
        lifecycleScope.launch(Dispatchers.IO) {
            val series = if (categoryId == null) {
                // Show series from first category
                val firstCategoryId = DataManager.xtreamSeriesCategories.firstOrNull()?.categoryId
                if (firstCategoryId != null) {
                    DataManager.getCachedSeriesForCategory(firstCategoryId)?.take(20) ?: emptyList()
                } else emptyList()
            } else {
                // Load series for specific category
                val cached = DataManager.getCachedSeriesForCategory(categoryId)
                if (cached != null) {
                    cached.take(20)
                } else {
                    val result = xtreamRepository.getSeriesByCategory(categoryId)
                    val seriesList = result.getOrNull() ?: emptyList()
                    if (seriesList.isNotEmpty()) {
                        DataManager.cacheSeriesForCategory(categoryId, seriesList)
                    }
                    seriesList.take(20)
                }
            }
            
            withContext(Dispatchers.Main) {
                displayXtreamSeries(series)
            }
        }
    }
    
    // ==================== Xtream Mode ====================
    
    private fun loadXtreamContent() {
        // Reset loading counter
        loadingCounter.set(0)
        
        // First, display cached data immediately (if available)
        val hasCachedData = displayCachedContent()
        
        // If we have cached data, mark as loaded immediately
        if (hasCachedData) {
            hideLoading()
            isFirstLoad = false
        }
        
        // Then load fresh data in parallel
        lifecycleScope.launch {
            try {
                // Load all 3 sections in PARALLEL
                val liveJob = async(Dispatchers.IO) { loadXtreamLiveChannelsAsync() }
                val moviesJob = async(Dispatchers.IO) { loadXtreamMoviesAsync() }
                val seriesJob = async(Dispatchers.IO) { loadXtreamSeriesAsync() }
                
                // Wait for all to complete
                awaitAll(liveJob, moviesJob, seriesJob)
                
                android.util.Log.d(TAG, "All Xtream content loaded in parallel")
                
                // Load Top 10 after Xtream content is loaded
                loadTop10Content()
                
                // Ensure loading is hidden at the end
                withContext(Dispatchers.Main) {
                    hideLoading()
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "Error loading Xtream content", e)
                withContext(Dispatchers.Main) {
                    hideLoading()
                }
            }
        }
    }
    
    /**
     * Display cached content immediately while fresh data loads
     * @return true if any cached content was displayed
     */
    private fun displayCachedContent(): Boolean {
        var hasData = false
        
        // Display cached live channels
        if (DataManager.allXtreamLiveStreams.isNotEmpty()) {
            displayXtreamLiveChannels(DataManager.allXtreamLiveStreams.take(20))
            android.util.Log.d(TAG, "Displayed cached live channels")
            hasData = true
            onSectionLoaded()
        }
        
        // Display cached movies
        val cachedMovieCategories = DataManager.xtreamMovieCategories
        if (cachedMovieCategories.isNotEmpty()) {
            val firstCategoryId = cachedMovieCategories[0].categoryId
            val cachedMovies = DataManager.getCachedMoviesForCategory(firstCategoryId)
            if (cachedMovies != null) {
                displayXtreamMovies(cachedMovies.take(20))
                android.util.Log.d(TAG, "Displayed cached movies")
                hasData = true
                onSectionLoaded()
            }
        }
        
        // Display cached series
        val cachedSeriesCategories = DataManager.xtreamSeriesCategories
        if (cachedSeriesCategories.isNotEmpty()) {
            val firstCategoryId = cachedSeriesCategories[0].categoryId
            val cachedSeries = DataManager.getCachedSeriesForCategory(firstCategoryId)
            if (cachedSeries != null) {
                displayXtreamSeries(cachedSeries.take(20))
                android.util.Log.d(TAG, "Displayed cached series")
                hasData = true
                onSectionLoaded()
            }
        }
        
        return hasData
    }
    
    private suspend fun loadXtreamLiveChannelsAsync() {
        // Skip if we already have cached data
        if (DataManager.allXtreamLiveStreams.isNotEmpty()) {
            return
        }
        
        try {
            // Load from API - get first category streams or all streams
            val categoriesResult = xtreamRepository.getLiveCategories()
            categoriesResult.onSuccess { categories ->
                if (categories.isNotEmpty()) {
                    DataManager.initXtreamLiveCategories(categories)
                    
                    // Load first category streams for home preview
                    val streamsResult = xtreamRepository.getLiveStreamsByCategory(categories[0].categoryId)
                    streamsResult.onSuccess { streams ->
                        DataManager.cacheLiveStreamsForCategory(categories[0].categoryId, streams)
                        withContext(Dispatchers.Main) {
                            displayXtreamLiveChannels(streams.take(20))
                            onSectionLoaded()
                        }
                    }
                }
            }
            
            categoriesResult.onFailure {
                android.util.Log.e(TAG, "Failed to load Xtream live categories", it)
                withContext(Dispatchers.Main) {
                    displayLegacyLiveChannels()
                    onSectionLoaded()
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error loading live channels", e)
            withContext(Dispatchers.Main) { onSectionLoaded() }
        }
    }
    
    @Deprecated("Use loadXtreamLiveChannelsAsync instead", ReplaceWith("loadXtreamLiveChannelsAsync()"))
    private suspend fun loadXtreamLiveChannels() {
        loadXtreamLiveChannelsAsync()
    }
    
    private fun displayXtreamLiveChannels(streams: List<XtreamLiveStream>) {
        val channels = streams.map { stream ->
            xtreamRepository.convertXtreamLiveToChannel(stream, "Live TV")
        }
        
        android.util.Log.d(TAG, "Displaying ${channels.size} Xtream live channels")
        
        val channelAdapter = ChannelAdapter(channels) { channel ->
            playChannel(channel)
        }
        liveChannelsRecycler.adapter = channelAdapter
    }
    
    private suspend fun loadXtreamMoviesAsync() {
        // Skip if we already have cached data
        val cachedCategories = DataManager.xtreamMovieCategories
        if (cachedCategories.isNotEmpty()) {
            val firstCategoryId = cachedCategories[0].categoryId
            val cachedMovies = DataManager.getCachedMoviesForCategory(firstCategoryId)
            if (cachedMovies != null) {
                return // Already displayed from cache
            }
        }
        
        try {
            // Load from API
            val categoriesResult = xtreamRepository.getMovieCategories()
            categoriesResult.onSuccess { categories ->
                if (categories.isNotEmpty()) {
                    DataManager.initXtreamMovieCategories(categories)
                    
                    // Load first category movies for home preview
                    val moviesResult = xtreamRepository.getMoviesByCategory(categories[0].categoryId)
                    moviesResult.onSuccess { movies ->
                        DataManager.cacheMoviesForCategory(categories[0].categoryId, movies)
                        withContext(Dispatchers.Main) {
                            displayXtreamMovies(movies.take(20))
                            onSectionLoaded()
                        }
                    }
                }
            }
            
            categoriesResult.onFailure {
                android.util.Log.e(TAG, "Failed to load Xtream movie categories", it)
                withContext(Dispatchers.Main) {
                    displayLegacyMovies()
                    onSectionLoaded()
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error loading movies", e)
            withContext(Dispatchers.Main) { onSectionLoaded() }
        }
    }
    
    @Deprecated("Use loadXtreamMoviesAsync instead")
    private suspend fun loadXtreamMovies() {
        loadXtreamMoviesAsync()
    }
    
    private fun displayXtreamMovies(xtreamMovies: List<XtreamMovie>) {
        android.util.Log.d(TAG, "Displaying ${xtreamMovies.size} Xtream movies")
        
        val adapter = XtreamMovieHomeAdapter(xtreamMovies) { movie ->
            playXtreamMovie(movie)
        }
        moviesRecycler.adapter = adapter
    }
    
    private suspend fun loadXtreamSeriesAsync() {
        // Skip if we already have cached data
        val cachedCategories = DataManager.xtreamSeriesCategories
        if (cachedCategories.isNotEmpty()) {
            val firstCategoryId = cachedCategories[0].categoryId
            val cachedSeries = DataManager.getCachedSeriesForCategory(firstCategoryId)
            if (cachedSeries != null) {
                return // Already displayed from cache
            }
        }
        
        try {
            // Load from API
            val categoriesResult = xtreamRepository.getSeriesCategories()
            categoriesResult.onSuccess { categories ->
                if (categories.isNotEmpty()) {
                    DataManager.initXtreamSeriesCategories(categories)
                    
                    // Load first category series for home preview
                    val seriesResult = xtreamRepository.getSeriesByCategory(categories[0].categoryId)
                    seriesResult.onSuccess { seriesList ->
                        DataManager.cacheSeriesForCategory(categories[0].categoryId, seriesList)
                        withContext(Dispatchers.Main) {
                            displayXtreamSeries(seriesList.take(20))
                            onSectionLoaded()
                        }
                    }
                }
            }
            
            categoriesResult.onFailure {
                android.util.Log.e(TAG, "Failed to load Xtream series categories", it)
                withContext(Dispatchers.Main) {
                    displayLegacySeries()
                    onSectionLoaded()
                }
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error loading series", e)
            withContext(Dispatchers.Main) { onSectionLoaded() }
        }
    }
    
    @Deprecated("Use loadXtreamSeriesAsync instead")
    private suspend fun loadXtreamSeries() {
        loadXtreamSeriesAsync()
    }
    
    private fun displayXtreamSeries(xtreamSeries: List<XtreamSeries>) {
        android.util.Log.d(TAG, "Displaying ${xtreamSeries.size} Xtream series")
        
        val adapter = XtreamSeriesHomeAdapter(xtreamSeries) { series ->
            openXtreamSeries(series)
        }
        seriesRecycler.adapter = adapter
    }
    
    // ==================== Legacy M3U Mode ====================
    
    private fun loadLegacyContent() {
        displayLegacyLiveChannels()
        displayLegacyMovies()
        displayLegacySeries()
        
        // Hide loading overlay after displaying legacy content
        hideLoading()
    }
    
    private fun displayLegacyLiveChannels() {
        val channels = DataManager.channels
            .filter { it.category.isNotEmpty() }
            .take(20)
        
        android.util.Log.d(TAG, "Legacy mode: ${channels.size} channels")
        
        val channelAdapter = ChannelAdapter(channels) { channel ->
            playChannel(channel)
        }
        liveChannelsRecycler.adapter = channelAdapter
    }
    
    private fun displayLegacyMovies() {
        val movies = DataManager.movies
            .filter { it.category.isNotEmpty() }
            .take(20)
        
        android.util.Log.d(TAG, "Legacy mode: ${movies.size} movies")
        
        val moviesAdapter = ContentAdapter(movies) { item ->
            if (item is Movie) {
                playLegacyMovie(item)
            }
        }
        moviesRecycler.adapter = moviesAdapter
    }
    
    private fun displayLegacySeries() {
        val series = DataManager.series
            .filter { it.category.isNotEmpty() }
            .take(20)
        
        android.util.Log.d(TAG, "Legacy mode: ${series.size} series")
        
        val seriesAdapter = ContentAdapter(series) { item ->
            if (item is Series) {
                openLegacySeries(item)
            }
        }
        seriesRecycler.adapter = seriesAdapter
    }
    
    // ==================== Playback Actions ====================
    
    private fun playChannel(channel: Channel) {
        android.util.Log.d(TAG, "Playing channel: ${channel.name}, URL: ${channel.streamUrl}")
        
        // Save to recent channels
        WatchProgressManager.addRecentChannel(
            url = channel.streamUrl,
            name = channel.name,
            logo = channel.logo,
            category = channel.category
        )
        
        val intent = Intent(this, PlayerActivity::class.java).apply {
            putExtra("STREAM_URL", channel.streamUrl)
            putExtra("TITLE", channel.name)
            putExtra("TYPE", "LIVE")
        }
        startActivity(intent)
    }
    
    private fun playXtreamMovie(movie: XtreamMovie) {
        val streamUrl = xtreamRepository.buildMovieStreamUrl(
            movie.streamId,
            movie.containerExtension
        )
        android.util.Log.d(TAG, "Playing Xtream movie: ${movie.name}")
        android.util.Log.d(TAG, "Movie streamIcon: ${movie.streamIcon}")
        android.util.Log.d(TAG, "Movie rating: ${movie.rating}, categoryId: ${movie.categoryId}")
        
        val intent = Intent(this, PlayerActivity::class.java).apply {
            putExtra("STREAM_URL", streamUrl)
            putExtra("TITLE", movie.name)
            putExtra("TYPE", "MOVIE")
            putExtra("COVER", movie.streamIcon) // Pass cover image
        }
        startActivity(intent)
    }
    
    private fun playLegacyMovie(movie: Movie) {
        android.util.Log.d(TAG, "Playing legacy movie: ${movie.name}, URL: ${movie.streamUrl}")
        val intent = Intent(this, PlayerActivity::class.java).apply {
            putExtra("STREAM_URL", movie.streamUrl)
            putExtra("TITLE", movie.name)
            putExtra("TYPE", "MOVIE")
            putExtra("COVER", movie.cover) // Pass cover image
        }
        startActivity(intent)
    }
    
    private fun openXtreamSeries(series: XtreamSeries) {
        val intent = Intent(this, SeriesDetailActivity::class.java).apply {
            putExtra("SERIES_ID", series.seriesId)
            putExtra("SERIES_NAME", series.name)
            putExtra("SERIES_COVER", series.cover)
            putExtra("IS_XTREAM", true)
        }
        startActivity(intent)
    }
    
    private fun openLegacySeries(series: Series) {
        // Navigate to series activity
        startActivity(Intent(this, SeriesActivity::class.java))
    }
    
}
