package com.oxoplayer.tv.ui.livetv

import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.ui.PlayerView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.DataManager
import com.oxoplayer.tv.data.models.Category
import com.oxoplayer.tv.data.models.Channel
import com.oxoplayer.tv.data.models.ContentType
import com.oxoplayer.tv.data.models.XtreamLiveCategory
import com.oxoplayer.tv.data.models.XtreamLiveStream
import com.oxoplayer.tv.data.repository.XtreamRepository
import com.oxoplayer.tv.data.WatchProgressManager
import kotlinx.coroutines.launch

/**
 * Live TV Activity - Style IBO Player
 * Sidebar avec catégories + Liste des chaînes + Preview miniature
 * 
 * Uses Xtream API for proper channel URLs when available
 */
class LiveTVActivity : AppCompatActivity() {
    
    private val TAG = "LiveTVActivity"
    
    private lateinit var categoriesRecyclerView: RecyclerView
    private lateinit var channelsRecyclerView: RecyclerView
    private lateinit var miniPlayerView: PlayerView
    private lateinit var channelNameText: TextView
    private lateinit var previewContainer: FrameLayout
    private var progressBar: ProgressBar? = null
    private lateinit var searchEditText: EditText
    private lateinit var clearSearchButton: ImageView
    private lateinit var noResultsText: TextView
    
    private var player: ExoPlayer? = null
    private var currentChannelIndex = 0
    private var isFullscreen = false
    
    private val xtreamRepository = XtreamRepository()
    private var isXtreamMode = false
    
    // Xtream mode data
    private var xtreamCategories = listOf<XtreamLiveCategory>()
    private var currentXtreamStreams = listOf<XtreamLiveStream>()
    private var allXtreamStreams = mutableListOf<XtreamLiveStream>() // ALL streams for global search
    private var currentCategoryId: String? = null
    private var currentCategoryName: String = ""
    private var isSearchActive = false
    
    // Legacy mode data
    private var allChannels = listOf<Channel>()
    private var legacyCategories = listOf<Category>()
    private var currentLegacyChannels = listOf<Channel>()
    
    private val handler = Handler(Looper.getMainLooper())
    private var previewRunnable: Runnable? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_livetv)
        
        initViews()
        determineMode()
        setupRecyclerViews()
        initializePlayer()
        loadCategories()
    }
    
    private fun initViews() {
        categoriesRecyclerView = findViewById(R.id.categoriesRecyclerView)
        channelsRecyclerView = findViewById(R.id.channelsRecyclerView)
        miniPlayerView = findViewById(R.id.miniPlayerView)
        channelNameText = findViewById(R.id.channelNameText)
        previewContainer = findViewById(R.id.previewContainer)
        progressBar = findViewById(R.id.progressBar)
        searchEditText = findViewById(R.id.searchEditText)
        clearSearchButton = findViewById(R.id.clearSearchButton)
        noResultsText = findViewById(R.id.noResultsText)
        
        setupSearch()
    }
    
    private fun setupSearch() {
        searchEditText.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                val query = s?.toString()?.trim() ?: ""
                clearSearchButton.visibility = if (query.isNotEmpty()) View.VISIBLE else View.GONE
                filterChannels(query)
            }
        })
        
        clearSearchButton.setOnClickListener {
            searchEditText.text.clear()
        }
    }
    
    private fun filterChannels(query: String) {
        isSearchActive = query.isNotEmpty()
        
        if (isXtreamMode) {
            filterXtreamStreams(query)
        } else {
            filterLegacyChannels(query)
        }
    }
    
    private fun filterXtreamStreams(query: String) {
        val filteredStreams = if (query.isEmpty()) {
            // When search is cleared, show current category
            currentXtreamStreams
        } else {
            // Search across ALL streams from ALL categories
            allXtreamStreams.filter { 
                it.name.contains(query, ignoreCase = true) 
            }
        }
        
        noResultsText.visibility = if (filteredStreams.isEmpty() && query.isNotEmpty()) View.VISIBLE else View.GONE
        
        val adapter = XtreamLiveStreamsAdapter(filteredStreams) { stream, position, isDoubleClick ->
            onXtreamStreamSelected(stream, position, isDoubleClick)
        }
        channelsRecyclerView.adapter = adapter
    }
    
    private fun filterLegacyChannels(query: String) {
        val filteredChannels = if (query.isEmpty()) {
            // When search is cleared, show current category
            currentLegacyChannels
        } else {
            // Search across ALL channels from ALL categories
            allChannels.filter { 
                it.name.contains(query, ignoreCase = true) 
            }
        }
        
        noResultsText.visibility = if (filteredChannels.isEmpty() && query.isNotEmpty()) View.VISIBLE else View.GONE
        
        val channelsAdapter = ChannelsAdapter(filteredChannels) { channel, position, isDoubleClick ->
            onLegacyChannelSelected(channel, position, isDoubleClick)
        }
        channelsRecyclerView.adapter = channelsAdapter
    }
    
    private fun determineMode() {
        isXtreamMode = DataManager.shouldUseXtreamForLiveTV()
        Log.d(TAG, "Live TV mode: ${if (isXtreamMode) "Xtream API" else "Legacy M3U"}")
    }
    
    private fun setupRecyclerViews() {
        categoriesRecyclerView.layoutManager = LinearLayoutManager(this)
        channelsRecyclerView.layoutManager = LinearLayoutManager(this)
    }
    
    private fun loadCategories() {
        if (isXtreamMode) {
            loadXtreamCategories()
        } else {
            loadLegacyCategories()
        }
    }
    
    // ==================== Xtream Mode ====================
    
    private fun loadXtreamCategories() {
        showLoading(true)
        
        // First check cache
        if (DataManager.xtreamLiveCategories.isNotEmpty()) {
            xtreamCategories = DataManager.xtreamLiveCategories
            displayXtreamCategories()
            
            // Load all streams for global search
            loadAllXtreamStreamsForSearch()
            
            // Auto-select first category
            if (xtreamCategories.isNotEmpty()) {
                onXtreamCategorySelected(xtreamCategories[0], 0)
            }
            return
        }
        
        // Load from API
        lifecycleScope.launch {
            val result = xtreamRepository.getLiveCategories()
            
            result.onSuccess { categories ->
                xtreamCategories = categories
                DataManager.initXtreamLiveCategories(categories)
                
                displayXtreamCategories()
                
                // Load all streams for global search
                loadAllXtreamStreamsForSearch()
                
                // Auto-select first category
                if (categories.isNotEmpty()) {
                    onXtreamCategorySelected(categories[0], 0)
                } else {
                    showLoading(false)
                }
            }
            
            result.onFailure { error ->
                showLoading(false)
                Log.e(TAG, "Error loading live categories", error)
                Toast.makeText(this@LiveTVActivity, "Erreur: ${error.message}", Toast.LENGTH_SHORT).show()
                
                // Fallback to legacy mode
                isXtreamMode = false
                loadLegacyCategories()
            }
        }
    }
    
    private fun loadAllXtreamStreamsForSearch() {
        // Load all streams from all categories for global search
        lifecycleScope.launch {
            allXtreamStreams.clear()
            
            for (category in xtreamCategories) {
                // Check cache first
                val cached = DataManager.getCachedLiveStreamsForCategory(category.categoryId)
                if (cached != null) {
                    allXtreamStreams.addAll(cached)
                } else {
                    // Load from API
                    val result = xtreamRepository.getLiveStreamsByCategory(category.categoryId)
                    result.onSuccess { streams ->
                        DataManager.cacheLiveStreamsForCategory(category.categoryId, streams)
                        allXtreamStreams.addAll(streams)
                    }
                }
            }
            
            Log.d(TAG, "Loaded ${allXtreamStreams.size} total streams for global search")
        }
    }
    
    private fun displayXtreamCategories() {
        val adapter = XtreamLiveCategoryAdapter(xtreamCategories) { category, position ->
            onXtreamCategorySelected(category, position)
        }
        categoriesRecyclerView.adapter = adapter
    }
    
    private fun onXtreamCategorySelected(category: XtreamLiveCategory, position: Int) {
        currentCategoryId = category.categoryId
        currentCategoryName = category.categoryName
        
        // Update category selection
        (categoriesRecyclerView.adapter as? XtreamLiveCategoryAdapter)?.setSelectedPosition(position)
        
        // Check cache first
        val cached = DataManager.getCachedLiveStreamsForCategory(category.categoryId)
        if (cached != null) {
            currentXtreamStreams = cached
            displayXtreamStreams()
            return
        }
        
        // Load from API
        loadXtreamStreamsForCategory(category.categoryId)
    }
    
    private fun loadXtreamStreamsForCategory(categoryId: String) {
        showLoading(true)
        
        lifecycleScope.launch {
            val result = xtreamRepository.getLiveStreamsByCategory(categoryId)
            
            result.onSuccess { streams ->
                currentXtreamStreams = streams
                DataManager.cacheLiveStreamsForCategory(categoryId, streams)
                displayXtreamStreams()
            }
            
            result.onFailure { error ->
                showLoading(false)
                Log.e(TAG, "Error loading streams for category $categoryId", error)
                Toast.makeText(this@LiveTVActivity, "Erreur: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun displayXtreamStreams() {
        showLoading(false)
        
        val adapter = XtreamLiveStreamsAdapter(currentXtreamStreams) { stream, position, isDoubleClick ->
            onXtreamStreamSelected(stream, position, isDoubleClick)
        }
        channelsRecyclerView.adapter = adapter
        
        Log.d(TAG, "Displaying ${currentXtreamStreams.size} streams for $currentCategoryName")
        
        // Don't auto-play - user must select a channel explicitly
    }
    
    private fun onXtreamStreamSelected(stream: XtreamLiveStream, position: Int, isDoubleClick: Boolean) {
        currentChannelIndex = position
        if (isDoubleClick) {
            // Double-click: go to fullscreen
            enterFullscreenXtream(stream)
        } else {
            // First click: play in mini player
            playXtreamStream(stream, false)
        }
    }
    
    private fun playXtreamStream(stream: XtreamLiveStream, fullscreen: Boolean) {
        val streamUrl = xtreamRepository.buildLiveStreamUrl(stream.streamId, "m3u8")
        Log.d(TAG, "Playing Xtream stream: ${stream.name}, URL: $streamUrl")
        
        channelNameText.text = stream.name
        
        // Cancel any pending preview
        previewRunnable?.let { handler.removeCallbacks(it) }
        
        // Start preview after delay
        previewRunnable = Runnable {
            startStream(streamUrl)
        }
        handler.postDelayed(previewRunnable!!, 500)
        
        if (fullscreen) {
            enterFullscreenXtream(stream)
        }
    }
    
    private fun enterFullscreenXtream(stream: XtreamLiveStream) {
        // Stop mini player to avoid double audio
        player?.stop()
        previewRunnable?.let { handler.removeCallbacks(it) }
        
        val streamUrl = xtreamRepository.buildLiveStreamUrl(stream.streamId, "m3u8")
        
        Log.d(TAG, "=== ADDING RECENT CHANNEL (Xtream) ===")
        Log.d(TAG, "Name: ${stream.name}")
        Log.d(TAG, "Logo: ${stream.streamIcon}")
        Log.d(TAG, "Category: $currentCategoryName")
        Log.d(TAG, "URL: $streamUrl")
        
        // Save to recent channels
        WatchProgressManager.addRecentChannel(
            url = streamUrl,
            name = stream.name,
            logo = stream.streamIcon,
            category = currentCategoryName
        )
        
        val intent = android.content.Intent(this, com.oxoplayer.tv.ui.player.PlayerActivity::class.java)
        intent.putExtra("STREAM_URL", streamUrl)
        intent.putExtra("TITLE", stream.name)
        intent.putExtra("TYPE", "LIVE")
        startActivity(intent)
    }
    
    // ==================== Legacy M3U Mode ====================
    
    private fun loadLegacyCategories() {
        allChannels = DataManager.channels
        
        val categoriesMap = allChannels.groupBy { it.category }
        legacyCategories = categoriesMap.keys.map { categoryName ->
            Category(categoryName, categoryName, ContentType.LIVE_TV)
        }
        
        if (legacyCategories.isNotEmpty()) {
            currentLegacyChannels = categoriesMap[legacyCategories[0].name] ?: emptyList()
            currentCategoryName = legacyCategories[0].name
        }
        
        displayLegacyCategories()
        showLoading(false)
        
        Log.d(TAG, "Legacy mode: ${allChannels.size} channels in ${legacyCategories.size} categories")
    }
    
    private fun displayLegacyCategories() {
        val categoriesAdapter = CategoriesAdapter(legacyCategories) { category ->
            onLegacyCategorySelected(category)
        }
        categoriesRecyclerView.adapter = categoriesAdapter
        
        // Display first category channels
        if (currentLegacyChannels.isNotEmpty()) {
            displayLegacyChannels()
        }
    }
    
    private fun onLegacyCategorySelected(category: Category) {
        currentLegacyChannels = allChannels.filter { it.category == category.name }
        currentCategoryName = category.name
        displayLegacyChannels()
        
        // Don't auto-play - user must select a channel explicitly
    }
    
    private fun displayLegacyChannels() {
        val channelsAdapter = ChannelsAdapter(currentLegacyChannels) { channel, position, isDoubleClick ->
            onLegacyChannelSelected(channel, position, isDoubleClick)
        }
        channelsRecyclerView.adapter = channelsAdapter
    }
    
    private fun onLegacyChannelSelected(channel: Channel, position: Int, isDoubleClick: Boolean) {
        currentChannelIndex = position
        if (isDoubleClick) {
            enterFullscreenLegacy(channel)
        } else {
            playLegacyChannel(channel, false)
        }
    }
    
    private fun playLegacyChannel(channel: Channel, fullscreen: Boolean) {
        Log.d(TAG, "Playing legacy channel: ${channel.name}, URL: ${channel.streamUrl}")
        channelNameText.text = channel.name
        
        // Cancel any pending preview
        previewRunnable?.let { handler.removeCallbacks(it) }
        
        // Start preview after delay
        previewRunnable = Runnable {
            startStream(channel.streamUrl)
        }
        handler.postDelayed(previewRunnable!!, 500)
        
        if (fullscreen) {
            enterFullscreenLegacy(channel)
        }
    }
    
    private fun enterFullscreenLegacy(channel: Channel) {
        // Stop mini player to avoid double audio
        player?.stop()
        previewRunnable?.let { handler.removeCallbacks(it) }
        
        // Save to recent channels
        WatchProgressManager.addRecentChannel(
            url = channel.streamUrl,
            name = channel.name,
            logo = channel.logo,
            category = currentCategoryName
        )
        
        val intent = android.content.Intent(this, com.oxoplayer.tv.ui.player.PlayerActivity::class.java)
        intent.putExtra("STREAM_URL", channel.streamUrl)
        intent.putExtra("TITLE", channel.name)
        intent.putExtra("TYPE", "LIVE")
        startActivity(intent)
    }
    
    // ==================== Player ====================
    
    private fun startStream(url: String) {
        player?.stop()
        player?.clearMediaItems()
        
        try {
            val dataSourceFactory = DefaultHttpDataSource.Factory()
                .setUserAgent("OXO Player TV/1.0")
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(15000)
            
            val mediaSource = if (url.contains(".m3u8")) {
                HlsMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(Uri.parse(url)))
            } else {
                ProgressiveMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(Uri.parse(url)))
            }
            
            player?.setMediaSource(mediaSource)
            player?.prepare()
            player?.play()
            
        } catch (e: Exception) {
            Log.e(TAG, "Error playing stream", e)
        }
    }
    
    private fun initializePlayer() {
        player = ExoPlayer.Builder(this).build()
        miniPlayerView.player = player
        miniPlayerView.useController = false
        
        player?.addListener(object : Player.Listener {
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                Log.e(TAG, "Player error: ${error.message}")
            }
        })
    }
    
    // ==================== Utils ====================
    
    private fun showLoading(show: Boolean) {
        progressBar?.visibility = if (show) View.VISIBLE else View.GONE
    }
    
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_BACK -> {
                finish()
                true
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }
    
    override fun onPause() {
        super.onPause()
        player?.pause()
    }
    
    override fun onResume() {
        super.onResume()
        player?.play()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        previewRunnable?.let { handler.removeCallbacks(it) }
        player?.release()
        player = null
    }
}
