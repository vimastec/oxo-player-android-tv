package com.oxoplayer.tv.ui.home

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.oxoplayer.tv.data.DataManager
import com.oxoplayer.tv.OXOApplication
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.Channel
import com.oxoplayer.tv.data.models.Movie
import com.oxoplayer.tv.data.models.Series
import com.oxoplayer.tv.data.models.XtreamLiveStream
import com.oxoplayer.tv.data.models.XtreamMovie
import com.oxoplayer.tv.data.models.XtreamSeries
import com.oxoplayer.tv.data.repository.XtreamRepository
import com.oxoplayer.tv.ui.livetv.LiveTVActivity
import com.oxoplayer.tv.ui.movies.MoviesActivity
import com.oxoplayer.tv.ui.player.PlayerActivity
import com.oxoplayer.tv.ui.series.SeriesActivity
import com.oxoplayer.tv.ui.series.SeriesDetailActivity
import com.oxoplayer.tv.ui.settings.SettingsActivity
import com.oxoplayer.tv.ui.profile.ProfileSelectionActivity
import com.oxoplayer.tv.data.WatchProgressManager
import com.oxoplayer.tv.data.ProfileManager
import kotlinx.coroutines.launch
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
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
        setupContentRows()
        setupCategories()
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
    }
    
    private fun setupNavigation() {
        // Navigation items
        val navHome = findViewById<TextView>(R.id.navHome)
        val navLiveTV = findViewById<TextView>(R.id.navLiveTV)
        val navMovies = findViewById<TextView>(R.id.navMovies)
        val navSeries = findViewById<TextView>(R.id.navSeries)
        
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
        val navItems = listOf(navHome, navLiveTV, navMovies, navSeries, btnSearch, btnSettings, profileSection)
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
        val btnPlayNow = findViewById<CardView>(R.id.btnPlayNow)
        val btnMoreInfo = findViewById<CardView>(R.id.btnMoreInfo)
        
        btnPlayNow.setOnClickListener {
            // Navigate to Live TV or start playing featured content
            startActivity(Intent(this, LiveTVActivity::class.java))
        }
        
        btnMoreInfo.setOnClickListener {
            Toast.makeText(this, "📺 Découvrez tout le contenu disponible", Toast.LENGTH_SHORT).show()
        }
        
        // Focus animations for hero buttons
        listOf(btnPlayNow, btnMoreInfo).forEach { button ->
            button.setOnFocusChangeListener { v, hasFocus ->
                v.animate()
                    .scaleX(if (hasFocus) 1.05f else 1.0f)
                    .scaleY(if (hasFocus) 1.05f else 1.0f)
                    .setDuration(200)
                    .start()
                
                if (v is CardView) {
                    v.cardElevation = if (hasFocus) 16f else 8f
                }
            }
        }
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
        // Setup RecyclerViews
        liveChannelsRecycler = findViewById(R.id.liveChannelsRecycler)
        liveChannelsRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        
        moviesRecycler = findViewById(R.id.moviesRecycler)
        moviesRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        
        seriesRecycler = findViewById(R.id.seriesRecycler)
        seriesRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        
        if (isXtreamMode) {
            android.util.Log.d(TAG, "Loading content with Xtream API")
            loadXtreamContent()
        } else {
            android.util.Log.d(TAG, "Loading content from M3U data")
            loadLegacyContent()
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
    
    // ==================== Categories ====================
    
    private fun setupCategories() {
        val categoryAction = findViewById<CardView>(R.id.categoryAction)
        val categoryComedy = findViewById<CardView>(R.id.categoryComedy)
        val categoryDrama = findViewById<CardView>(R.id.categoryDrama)
        val categorySport = findViewById<CardView>(R.id.categorySport)
        
        val categories = listOf(categoryAction, categoryComedy, categoryDrama, categorySport)
        
        categoryAction.setOnClickListener {
            openCategory("Action")
        }
        
        categoryComedy.setOnClickListener {
            openCategory("Comédie")
        }
        
        categoryDrama.setOnClickListener {
            openCategory("Drame")
        }
        
        categorySport.setOnClickListener {
            openCategory("Sport")
        }
        
        // Focus animations for categories
        categories.forEach { category ->
            category.setOnFocusChangeListener { v, hasFocus ->
                v.animate()
                    .scaleX(if (hasFocus) 1.08f else 1.0f)
                    .scaleY(if (hasFocus) 1.08f else 1.0f)
                    .setDuration(200)
                    .start()
                
                if (v is CardView) {
                    v.cardElevation = if (hasFocus) 12f else 8f
                    v.setCardBackgroundColor(
                        if (hasFocus) getColor(R.color.primary) else getColor(R.color.dark_gray)
                    )
                }
            }
        }
    }
    
    private fun openCategory(categoryName: String) {
        Toast.makeText(this, "🎬 Ouverture de la catégorie: $categoryName", Toast.LENGTH_SHORT).show()
        // TODO: Implement category filtering
    }
}
