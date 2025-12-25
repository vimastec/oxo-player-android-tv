package com.oxoplayer.tv.ui.player

import android.app.AlertDialog
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.rtsp.RtspMediaSource
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.PlayerView
import androidx.media3.exoplayer.mediacodec.MediaCodecSelector
import androidx.media3.exoplayer.mediacodec.MediaCodecUtil
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.WatchProgressManager
import com.oxoplayer.tv.data.models.Episode
import com.oxoplayer.tv.data.models.Season

class PlayerActivity : AppCompatActivity() {
    
    private lateinit var playerView: PlayerView
    private lateinit var trackSelector: DefaultTrackSelector
    private var player: ExoPlayer? = null
    private var streamUrl: String? = null
    private var title: String? = null
    private var type: String? = null
    private var cover: String? = null
    
    // UI Controls
    private var topBar: View? = null
    private var titleText: TextView? = null
    private var loadingIndicator: ProgressBar? = null
    private var volumeSeekBar: SeekBar? = null
    private var volumeText: TextView? = null
    private var audioButton: ImageButton? = null
    private var subtitleButton: ImageButton? = null
    private var infoButton: ImageButton? = null
    
    // Netflix-style bottom row
    private var seriesOptionsRow: View? = null
    private var btnInfoContainer: LinearLayout? = null
    private var btnEpisodesContainer: LinearLayout? = null
    private var btnAudioSubtitlesContainer: LinearLayout? = null
    
    // Series data for Episodes feature
    private var seriesName: String? = null
    private var currentSeasonNumber: Int = 1
    private var currentEpisodeId: String? = null
    private var seasons: List<Season> = emptyList()
    
    // Next Episode feature (Netflix-style)
    private var nextEpisodeContainer: LinearLayout? = null
    private var countdownProgress: ProgressBar? = null
    private var countdownText: TextView? = null
    private var nextEpisode: Episode? = null
    private var nextEpisodeSeasonNumber: Int = 0
    private var isNextEpisodeShowing = false
    private var countdownSeconds = 5
    private val countdownHandler = Handler(Looper.getMainLooper())
    private var countdownRunnable: Runnable? = null
    private val positionCheckHandler = Handler(Looper.getMainLooper())
    private var positionCheckRunnable: Runnable? = null
    private val NEXT_EPISODE_THRESHOLD_MS = 60000L // Show button 60 seconds (1 minute) before end
    
    // Audio Manager
    private lateinit var audioManager: AudioManager
    private var maxVolume: Int = 0
    
    // Track info
    private var audioTracks = mutableListOf<TrackInfo>()
    private var subtitleTracks = mutableListOf<TrackInfo>()
    private var selectedAudioIndex = 0
    private var selectedSubtitleIndex = -1 // -1 = off
    
    private val handler = Handler(Looper.getMainLooper())
    
    data class TrackInfo(
        val index: Int,
        val groupIndex: Int,
        val trackIndex: Int,
        val label: String,
        val language: String?
    )
    
    // Resume playback position
    private var resumePosition: Long = 0L
    private var shouldShowResumeDialog = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_player)
        
        // Initialize audio manager
        audioManager = getSystemService(AUDIO_SERVICE) as AudioManager
        maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        
        // Reset retry counters for new video
        retryCount = 0
        hasTriedSoftwareDecoder = false
        
        parseIntent() // MUST be called before initViews for seasons data
        initViews()
        
        if (streamUrl == null) {
            Toast.makeText(this, "URL de stream invalide", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        
        // Check for saved progress (resume playback feature)
        checkForResumePosition()
    }
    
    /**
     * Check if there's a saved position for this video
     * If yes, show dialog to ask user if they want to resume
     */
    private fun checkForResumePosition() {
        val url = streamUrl ?: return
        
        if (WatchProgressManager.hasProgress(url)) {
            val progress = WatchProgressManager.getProgress(url)
            if (progress != null) {
                val formattedTime = WatchProgressManager.formatTime(progress.positionMs)
                val progressPercent = (progress.progressPercent * 100).toInt()
                
                AlertDialog.Builder(this, R.style.Theme_OXOPlayer_Dialog)
                    .setTitle("📺 Reprendre la lecture")
                    .setMessage("Vous avez regardé ${progressPercent}% de ce contenu.\n\nReprendre à $formattedTime ?")
                    .setPositiveButton("▶️ Reprendre") { _, _ ->
                        resumePosition = WatchProgressManager.getResumePosition(url)
                        android.util.Log.d("PlayerActivity", "Resuming from position: ${WatchProgressManager.formatTime(resumePosition)}")
                        initializePlayer()
                    }
                    .setNegativeButton("🔄 Recommencer") { _, _ ->
                        resumePosition = 0L
                        // Clear saved progress since user wants to start fresh
                        WatchProgressManager.removeProgress(url)
                        initializePlayer()
                    }
                    .setCancelable(false)
                    .show()
            } else {
                initializePlayer()
            }
        } else {
            initializePlayer()
        }
    }
    
    private fun initViews() {
        playerView = findViewById(R.id.player_view)
        topBar = findViewById(R.id.top_bar)
        titleText = findViewById(R.id.title_text)
        loadingIndicator = findViewById(R.id.loading_indicator)
        
        // Next Episode button (Netflix-style)
        nextEpisodeContainer = findViewById(R.id.next_episode_container)
        countdownProgress = findViewById(R.id.countdown_progress)
        countdownText = findViewById(R.id.countdown_text)
        
        // Setup Next Episode button click
        nextEpisodeContainer?.setOnClickListener {
            playNextEpisodeNow()
        }
        
        // Sync top bar visibility with player controller
        playerView.setControllerVisibilityListener(
            PlayerView.ControllerVisibilityListener { visibility ->
                topBar?.visibility = visibility
            }
        )
        
        // Find controls inside the PlayerView's controller (custom_player_controls.xml)
        // These will be available after the controller is inflated
        playerView.post {
            volumeSeekBar = playerView.findViewById(R.id.volume_seekbar)
            volumeText = playerView.findViewById(R.id.volume_text)
            
            setupBottomControls()
        }
    }
    
    /**
     * Setup the bottom control buttons (volume, audio, subtitle, info)
     * Called after PlayerView controller is inflated
     */
    private fun setupBottomControls() {
        // Setup volume seekbar
        volumeSeekBar?.max = maxVolume
        volumeSeekBar?.progress = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        updateVolumeText()
        
        volumeSeekBar?.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, progress, 0)
                    updateVolumeText()
                }
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })
        
        // Netflix-style bottom row (for movies and series)
        seriesOptionsRow = playerView.findViewById(R.id.series_options_row)
        btnInfoContainer = playerView.findViewById(R.id.btn_info_container)
        btnEpisodesContainer = playerView.findViewById(R.id.btn_episodes_container)
        btnAudioSubtitlesContainer = playerView.findViewById(R.id.btn_audio_subtitles_container)
        
        android.util.Log.d("PlayerActivity", "setupBottomControls - type: $type, seasons: ${seasons.size}")
        
        // Show bottom options row for movies and series
        if (type == "MOVIE" || type == "SERIES") {
            seriesOptionsRow?.visibility = View.VISIBLE
            
            // Show Episodes button only for series with seasons data
            if (type == "SERIES" && seasons.isNotEmpty()) {
                btnEpisodesContainer?.visibility = View.VISIBLE
                android.util.Log.d("PlayerActivity", "Episodes button VISIBLE - ${seasons.size} seasons available")
            } else {
                android.util.Log.d("PlayerActivity", "Episodes button HIDDEN - seasons empty or not series")
            }
        }
        
        // Setup click listeners
        btnInfoContainer?.setOnClickListener {
            showStreamInfo()
        }
        
        btnEpisodesContainer?.setOnClickListener {
            showEpisodesSelector()
        }
        
        btnAudioSubtitlesContainer?.setOnClickListener {
            showAudioSubtitlesDialog()
        }
        
        // Setup D-pad navigation between bottom buttons
        setupBottomButtonsNavigation()
    }
    
    /**
     * Setup D-pad navigation for bottom row buttons
     */
    private fun setupBottomButtonsNavigation() {
        val info = btnInfoContainer
        val episodes = btnEpisodesContainer
        val audioSub = btnAudioSubtitlesContainer
        
        if (info == null || audioSub == null) return
        
        // Check if episodes button is visible
        val episodesVisible = episodes?.visibility == View.VISIBLE
        
        // Create list of visible buttons for navigation
        val buttons = mutableListOf<View>()
        buttons.add(info)
        if (episodesVisible && episodes != null) {
            buttons.add(episodes)
        }
        buttons.add(audioSub)
        
        // Setup key listeners for each button to handle D-pad navigation manually
        for ((index, button) in buttons.withIndex()) {
            button.setOnKeyListener { v, keyCode, event ->
                if (event.action == KeyEvent.ACTION_DOWN) {
                    when (keyCode) {
                        KeyEvent.KEYCODE_DPAD_LEFT -> {
                            if (index > 0) {
                                buttons[index - 1].requestFocus()
                                return@setOnKeyListener true
                            }
                        }
                        KeyEvent.KEYCODE_DPAD_RIGHT -> {
                            if (index < buttons.size - 1) {
                                buttons[index + 1].requestFocus()
                                return@setOnKeyListener true
                            }
                        }
                        KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                            v.performClick()
                            return@setOnKeyListener true
                        }
                    }
                }
                false
            }
        }
        
        android.util.Log.d("PlayerActivity", "Bottom navigation setup complete, buttons: ${buttons.size}, episodesVisible: $episodesVisible")
    }
    
    /**
     * Show Audio & Subtitles combined dialog
     */
    private fun showAudioSubtitlesDialog() {
        val options = mutableListOf<String>()
        
        if (audioTracks.isNotEmpty()) {
            options.add("🔊 Piste Audio (${audioTracks.size})")
        }
        if (subtitleTracks.isNotEmpty()) {
            options.add("📝 Sous-titres (${subtitleTracks.size})")
        }
        
        if (options.isEmpty()) {
            Toast.makeText(this, "Aucune piste disponible", Toast.LENGTH_SHORT).show()
            return
        }
        
        showTVFriendlyDialog("Audio & Sous-titres", options, -1) { which ->
            when {
                options[which].contains("Audio") -> showAudioTrackSelector()
                options[which].contains("Sous-titres") -> showSubtitleTrackSelector()
            }
        }
    }
    
    /**
     * Show a TV-friendly dialog with visible focus (orange background)
     */
    private fun showTVFriendlyDialog(
        title: String, 
        items: List<String>, 
        selectedIndex: Int,
        onItemSelected: (Int) -> Unit
    ) {
        // Create custom ListView with proper focus handling
        val listView = android.widget.ListView(this)
        listView.choiceMode = if (selectedIndex >= 0) android.widget.ListView.CHOICE_MODE_SINGLE else android.widget.ListView.CHOICE_MODE_NONE
        listView.setBackgroundColor(resources.getColor(R.color.sidebar_background, null))
        listView.divider = null
        listView.dividerHeight = 0
        
        val adapter = TVDialogAdapter(this, items, selectedIndex)
        listView.adapter = adapter
        
        val dialog = AlertDialog.Builder(this, R.style.Theme_OXOPlayer_Dialog)
            .setTitle(title)
            .setView(listView)
            .setNegativeButton("Fermer", null)
            .create()
        
        listView.setOnItemClickListener { _, _, position, _ ->
            android.util.Log.d("PlayerActivity", "Dialog item clicked: $position")
            dialog.dismiss()
            onItemSelected(position)
        }
        
        // Also handle key events for D-pad center/enter
        listView.setOnKeyListener { _, keyCode, event ->
            if (event.action == KeyEvent.ACTION_DOWN && 
                (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER)) {
                val position = listView.selectedItemPosition
                if (position >= 0) {
                    android.util.Log.d("PlayerActivity", "Dialog item selected via key: $position")
                    dialog.dismiss()
                    onItemSelected(position)
                    return@setOnKeyListener true
                }
            }
            false
        }
        
        dialog.show()
        
        // Request focus on the list
        listView.post {
            listView.requestFocus()
            if (selectedIndex >= 0) {
                listView.setSelection(selectedIndex)
            }
        }
    }
    
    /**
     * Custom adapter for TV-friendly dialogs with orange focus
     */
    inner class TVDialogAdapter(
        context: android.content.Context,
        private val items: List<String>,
        private val selectedIndex: Int
    ) : android.widget.ArrayAdapter<String>(context, R.layout.dialog_list_item, items) {
        
        override fun getView(position: Int, convertView: android.view.View?, parent: android.view.ViewGroup): android.view.View {
            val view = convertView ?: layoutInflater.inflate(R.layout.dialog_list_item, parent, false)
            
            val textView = view.findViewById<TextView>(R.id.item_text)
            val radioIndicator = view.findViewById<android.widget.ImageView>(R.id.radio_indicator)
            
            textView.text = items[position]
            
            // Show/hide radio indicator based on whether this is a selection dialog
            if (selectedIndex >= 0) {
                radioIndicator.visibility = View.VISIBLE
                if (position == selectedIndex) {
                    radioIndicator.setImageResource(R.drawable.ic_radio_checked)
                } else {
                    radioIndicator.setImageResource(R.drawable.ic_radio_unchecked)
                }
            } else {
                radioIndicator.visibility = View.GONE
            }
            
            return view
        }
    }
    
    /**
     * Show episodes selector dialog (Netflix-style with visuals)
     */
    private fun showEpisodesSelector() {
        if (seasons.isEmpty()) {
            Toast.makeText(this, "Aucun épisode disponible", Toast.LENGTH_SHORT).show()
            return
        }
        
        showVisualEpisodesDialog()
    }

    /**
     * Show visual episodes dialog with thumbnails
     */
    private fun showVisualEpisodesDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_episodes, null)
        val seasonSelector = dialogView.findViewById<LinearLayout>(R.id.season_selector)
        val seasonSpinner = dialogView.findViewById<android.widget.Spinner>(R.id.season_spinner)
        val episodesRecycler = dialogView.findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.episodes_recycler)
        
        val dialog = AlertDialog.Builder(this, R.style.Theme_OXOPlayer_Dialog)
            .setTitle("📺 Épisodes")
            .setView(dialogView)
            .setNegativeButton("Fermer", null)
            .create()
        
        // Current season index
        var currentSeasonIdx = seasons.indexOfFirst { it.seasonNumber == currentSeasonNumber }.coerceAtLeast(0)
        
        // Setup RecyclerView
        episodesRecycler.layoutManager = androidx.recyclerview.widget.LinearLayoutManager(this)
        
        // Function to update episodes list
        fun updateEpisodesList(seasonIndex: Int) {
            val season = seasons[seasonIndex]
            val adapter = EpisodeDialogAdapter(season.episodes, currentEpisodeId) { episode ->
                dialog.dismiss()
                playEpisode(episode, season.seasonNumber)
            }
            episodesRecycler.adapter = adapter
            
            // Scroll to current episode
            val currentEpIdx = season.episodes.indexOfFirst { it.id == currentEpisodeId }
            if (currentEpIdx >= 0) {
                episodesRecycler.scrollToPosition(currentEpIdx)
            }
        }
        
        // Setup season spinner if multiple seasons
        if (seasons.size > 1) {
            seasonSelector.visibility = View.VISIBLE
            
            val seasonNames = seasons.map { "Saison ${it.seasonNumber}" }
            val spinnerAdapter = android.widget.ArrayAdapter(
                this,
                android.R.layout.simple_spinner_item,
                seasonNames
            ).apply {
                setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            }
            seasonSpinner.adapter = spinnerAdapter
            seasonSpinner.setSelection(currentSeasonIdx)
            
            seasonSpinner.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                    currentSeasonIdx = position
                    updateEpisodesList(position)
                }
                override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
            }
        }
        
        // Load initial episodes
        updateEpisodesList(currentSeasonIdx)
        
        dialog.show()
        
        // Request focus on the RecyclerView
        episodesRecycler.post {
            episodesRecycler.requestFocus()
        }
    }
    
    /**
     * Adapter for episode dialog with thumbnails
     */
    inner class EpisodeDialogAdapter(
        private val episodes: List<Episode>,
        private val currentEpisodeId: String?,
        private val onEpisodeClick: (Episode) -> Unit
    ) : androidx.recyclerview.widget.RecyclerView.Adapter<EpisodeDialogAdapter.ViewHolder>() {
        
        inner class ViewHolder(view: View) : androidx.recyclerview.widget.RecyclerView.ViewHolder(view) {
            val thumbnail: android.widget.ImageView = view.findViewById(R.id.episode_thumbnail)
            val playIndicator: android.widget.ImageView = view.findViewById(R.id.play_indicator)
            val title: TextView = view.findViewById(R.id.episode_title)
            val info: TextView = view.findViewById(R.id.episode_info)
            val plot: TextView = view.findViewById(R.id.episode_plot)
        }
        
        override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): ViewHolder {
            val view = layoutInflater.inflate(R.layout.item_episode_dialog, parent, false)
            return ViewHolder(view)
        }
        
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val episode = episodes[position]
            val isCurrentEpisode = episode.id == currentEpisodeId
            
            // Title
            holder.title.text = "E${episode.episodeNumber}: ${episode.name}"
            
            // Info (duration)
            val durationText = episode.duration
            if (!durationText.isNullOrEmpty()) {
                holder.info.text = "$durationText min"
                holder.info.visibility = View.VISIBLE
            } else {
                holder.info.visibility = View.GONE
            }
            
            // Plot
            if (!episode.plot.isNullOrEmpty()) {
                holder.plot.text = episode.plot
                holder.plot.visibility = View.VISIBLE
            } else {
                holder.plot.visibility = View.GONE
            }
            
            // Thumbnail (use cover)
            val imageUrl = episode.cover
            if (!imageUrl.isNullOrEmpty()) {
                com.bumptech.glide.Glide.with(holder.itemView.context)
                    .load(imageUrl as String)
                    .centerCrop()
                    .placeholder(R.drawable.placeholder_poster)
                    .error(R.drawable.placeholder_poster)
                    .into(holder.thumbnail)
            } else {
                holder.thumbnail.setImageResource(R.drawable.placeholder_poster)
            }
            
            // Show play indicator for current episode
            holder.playIndicator.visibility = if (isCurrentEpisode) View.VISIBLE else View.GONE
            
            // Click listener
            holder.itemView.setOnClickListener {
                onEpisodeClick(episode)
            }
            
            // Focus handling for TV
            holder.itemView.isFocusable = true
            holder.itemView.isFocusableInTouchMode = true
            
            holder.itemView.setOnKeyListener { _, keyCode, event ->
                if (event.action == KeyEvent.ACTION_DOWN && 
                    (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER)) {
                    onEpisodeClick(episode)
                    return@setOnKeyListener true
                }
                false
            }
        }
        
        override fun getItemCount() = episodes.size
    }
    
    /**
     * Play a different episode
     */
    private fun playEpisode(episode: Episode, seasonNumber: Int) {
        // Don't restart if it's the same episode
        if (episode.id == currentEpisodeId) {
            return
        }
        
        // Save current progress before switching
        saveWatchProgress()
        
        // Update current episode tracking
        currentEpisodeId = episode.id
        currentSeasonNumber = seasonNumber
        
        // Update title
        val newTitle = "$seriesName - ${episode.name}"
        title = newTitle
        titleText?.text = newTitle
        
        // Update stream URL
        streamUrl = episode.streamUrl
        
        // Reset resume position for new episode
        resumePosition = 0L
        
        // Check if there's saved progress for this episode
        if (WatchProgressManager.hasProgress(episode.streamUrl)) {
            val progress = WatchProgressManager.getProgress(episode.streamUrl)
            if (progress != null) {
                val formattedTime = WatchProgressManager.formatTime(progress.positionMs)
                val progressPercent = (progress.progressPercent * 100).toInt()
                
                AlertDialog.Builder(this, R.style.Theme_OXOPlayer_Dialog)
                    .setTitle("📺 Reprendre la lecture")
                    .setMessage("Vous avez regardé ${progressPercent}% de cet épisode.\n\nReprendre à $formattedTime ?")
                    .setPositiveButton("▶️ Reprendre") { _, _ ->
                        resumePosition = WatchProgressManager.getResumePosition(episode.streamUrl)
                        loadNewEpisode(episode.streamUrl)
                    }
                    .setNegativeButton("🔄 Recommencer") { _, _ ->
                        WatchProgressManager.removeProgress(episode.streamUrl)
                        loadNewEpisode(episode.streamUrl)
                    }
                    .show()
                return
            }
        }
        
        loadNewEpisode(episode.streamUrl)
    }
    
    /**
     * Load and play a new episode stream
     */
    private fun loadNewEpisode(url: String) {
        try {
            // Hide next episode button if showing
            hideNextEpisodeButton()
            
            // Create new media source
            val mediaSource = createMediaSource(url)
            
            // Stop current playback
            player?.stop()
            
            // Set new media source
            player?.setMediaSource(mediaSource)
            player?.prepare()
            
            // Seek to resume position if available
            if (resumePosition > 0) {
                player?.seekTo(resumePosition)
            }
            
            player?.playWhenReady = true
            
            // Find next episode for auto-play feature
            findNextEpisode()
            
            Toast.makeText(this, "Lecture: ${title}", Toast.LENGTH_SHORT).show()
            
        } catch (e: Exception) {
            android.util.Log.e("PlayerActivity", "Error loading episode", e)
            Toast.makeText(this, "Erreur de chargement", Toast.LENGTH_SHORT).show()
        }
    }
    
    // ==================== Next Episode Feature (Netflix-style) ====================
    
    /**
     * Find the next episode in the series
     */
    private fun findNextEpisode() {
        if (type != "SERIES" || seasons.isEmpty() || currentEpisodeId == null) {
            nextEpisode = null
            return
        }
        
        // Find current season
        val currentSeasonIndex = seasons.indexOfFirst { it.seasonNumber == currentSeasonNumber }
        if (currentSeasonIndex < 0) {
            nextEpisode = null
            return
        }
        
        val currentSeason = seasons[currentSeasonIndex]
        val currentEpisodeIndex = currentSeason.episodes.indexOfFirst { it.id == currentEpisodeId }
        
        if (currentEpisodeIndex < 0) {
            nextEpisode = null
            return
        }
        
        // Check if there's a next episode in current season
        if (currentEpisodeIndex < currentSeason.episodes.size - 1) {
            nextEpisode = currentSeason.episodes[currentEpisodeIndex + 1]
            nextEpisodeSeasonNumber = currentSeasonNumber
            android.util.Log.d("PlayerActivity", "Next episode found: ${nextEpisode?.name} (same season)")
            return
        }
        
        // Check if there's a next season
        if (currentSeasonIndex < seasons.size - 1) {
            val nextSeason = seasons[currentSeasonIndex + 1]
            if (nextSeason.episodes.isNotEmpty()) {
                nextEpisode = nextSeason.episodes[0]
                nextEpisodeSeasonNumber = nextSeason.seasonNumber
                android.util.Log.d("PlayerActivity", "Next episode found: ${nextEpisode?.name} (next season ${nextEpisodeSeasonNumber})")
                return
            }
        }
        
        // No next episode
        nextEpisode = null
        android.util.Log.d("PlayerActivity", "No next episode available")
    }
    
    /**
     * Start monitoring playback position for next episode feature
     */
    private fun startPositionMonitoring() {
        android.util.Log.d("PlayerActivity", "startPositionMonitoring - type: $type, nextEpisode: ${nextEpisode?.name}")
        
        if (type != "SERIES") {
            android.util.Log.d("PlayerActivity", "Not a series, skipping position monitoring")
            return
        }
        
        // Find next episode if not already done
        if (nextEpisode == null) {
            findNextEpisode()
        }
        
        if (nextEpisode == null) {
            android.util.Log.d("PlayerActivity", "No next episode available, skipping monitoring")
            return
        }
        
        android.util.Log.d("PlayerActivity", "Starting position monitoring for next episode: ${nextEpisode?.name}")
        
        positionCheckRunnable = object : Runnable {
            override fun run() {
                checkForNextEpisodeTrigger()
                positionCheckHandler.postDelayed(this, 1000) // Check every second
            }
        }
        positionCheckHandler.post(positionCheckRunnable!!)
    }
    
    /**
     * Stop position monitoring
     */
    private fun stopPositionMonitoring() {
        positionCheckRunnable?.let { positionCheckHandler.removeCallbacks(it) }
        positionCheckRunnable = null
    }
    
    /**
     * Check if we should show the next episode button
     */
    private fun checkForNextEpisodeTrigger() {
        val exoPlayer = player ?: return
        if (nextEpisode == null || isNextEpisodeShowing) return
        
        val duration = exoPlayer.duration
        val position = exoPlayer.currentPosition
        
        if (duration <= 0) return
        
        val remainingTime = duration - position
        
        // Log every 5 seconds for debugging
        if (position % 5000 < 1000) {
            android.util.Log.d("PlayerActivity", "Position check - remaining: ${remainingTime/1000}s, threshold: ${NEXT_EPISODE_THRESHOLD_MS/1000}s")
        }
        
        // Show next episode button when less than threshold remaining
        if (remainingTime in 1..NEXT_EPISODE_THRESHOLD_MS) {
            android.util.Log.d("PlayerActivity", "TRIGGERING next episode button! Remaining: ${remainingTime}ms")
            showNextEpisodeButton()
        }
    }
    
    /**
     * Show the next episode button with countdown animation
     */
    private fun showNextEpisodeButton() {
        if (isNextEpisodeShowing || nextEpisode == null) return
        
        isNextEpisodeShowing = true
        countdownSeconds = 10 // 10 seconds countdown
        
        // Update UI
        runOnUiThread {
            nextEpisodeContainer?.visibility = View.VISIBLE
            countdownText?.text = countdownSeconds.toString()
            countdownProgress?.progress = 100
            
            // Animate entrance
            nextEpisodeContainer?.alpha = 0f
            nextEpisodeContainer?.translationX = 100f
            nextEpisodeContainer?.animate()
                ?.alpha(1f)
                ?.translationX(0f)
                ?.setDuration(300)
                ?.start()
        }
        
        // Start countdown
        startCountdown()
        
        android.util.Log.d("PlayerActivity", "Showing next episode button: ${nextEpisode?.name}")
    }
    
    /**
     * Hide the next episode button
     */
    private fun hideNextEpisodeButton() {
        isNextEpisodeShowing = false
        stopCountdown()
        
        runOnUiThread {
            nextEpisodeContainer?.animate()
                ?.alpha(0f)
                ?.translationX(100f)
                ?.setDuration(200)
                ?.withEndAction {
                    nextEpisodeContainer?.visibility = View.GONE
                }
                ?.start()
        }
    }
    
    /**
     * Start the countdown timer
     */
    private fun startCountdown() {
        stopCountdown()
        
        countdownRunnable = object : Runnable {
            override fun run() {
                countdownSeconds--
                
                runOnUiThread {
                    countdownText?.text = countdownSeconds.toString()
                    // Animate progress (from 100 to 0 over 10 seconds)
                    val progress = (countdownSeconds * 10) // 10->100, 9->90, ... 1->10, 0->0
                    countdownProgress?.progress = progress
                }
                
                if (countdownSeconds <= 0) {
                    // Auto-play next episode
                    playNextEpisodeNow()
                } else {
                    countdownHandler.postDelayed(this, 1000)
                }
            }
        }
        countdownHandler.postDelayed(countdownRunnable!!, 1000)
    }
    
    /**
     * Stop the countdown timer
     */
    private fun stopCountdown() {
        countdownRunnable?.let { countdownHandler.removeCallbacks(it) }
        countdownRunnable = null
    }
    
    /**
     * Play the next episode immediately
     */
    private fun playNextEpisodeNow() {
        val episode = nextEpisode ?: return
        
        stopCountdown()
        hideNextEpisodeButton()
        
        // Play the next episode
        playEpisode(episode, nextEpisodeSeasonNumber)
    }
    
    private fun parseIntent() {
        streamUrl = intent.getStringExtra("STREAM_URL")
        title = intent.getStringExtra("TITLE") ?: "OXO Player"
        type = intent.getStringExtra("TYPE")
        cover = intent.getStringExtra("COVER")
        
        titleText?.text = title
        
        // Parse series data for Episodes feature
        if (type == "SERIES") {
            seriesName = intent.getStringExtra("SERIES_NAME")
            currentSeasonNumber = intent.getIntExtra("CURRENT_SEASON", 1)
            currentEpisodeId = intent.getStringExtra("CURRENT_EPISODE_ID")
            
            // Parse seasons JSON
            val seasonsJson = intent.getStringExtra("SEASONS_JSON")
            if (!seasonsJson.isNullOrEmpty()) {
                try {
                    val gson = Gson()
                    val typeToken = object : TypeToken<List<Season>>() {}.type
                    seasons = gson.fromJson(seasonsJson, typeToken)
                    android.util.Log.d("PlayerActivity", "Parsed ${seasons.size} seasons from intent")
                } catch (e: Exception) {
                    android.util.Log.e("PlayerActivity", "Error parsing seasons JSON", e)
                    seasons = emptyList()
                }
            }
        }
        
        android.util.Log.d("PlayerActivity", "===== PLAYBACK INFO =====")
        android.util.Log.d("PlayerActivity", "Title: $title")
        android.util.Log.d("PlayerActivity", "Type: $type")
        android.util.Log.d("PlayerActivity", "Cover: $cover")
        android.util.Log.d("PlayerActivity", "URL: $streamUrl")
        if (type == "SERIES") {
            android.util.Log.d("PlayerActivity", "Series: $seriesName, Season: $currentSeasonNumber, Seasons count: ${seasons.size}")
        }
        android.util.Log.d("PlayerActivity", "========================")
    }
    
    private var retryCount = 0
    private val maxRetries = 2
    private var hasTriedSoftwareDecoder = false
    
    private fun initializePlayer(useSoftwareDecoder: Boolean = false) {
        // Check if running on emulator - prefer software decoder for HEVC
        val isEmulator = android.os.Build.PRODUCT.contains("sdk") || 
                        android.os.Build.MODEL.contains("Emulator") ||
                        android.os.Build.FINGERPRINT.contains("generic")
        
        android.util.Log.d("PlayerActivity", "Initializing player - isEmulator: $isEmulator, useSoftwareDecoder: $useSoftwareDecoder")
        
        // List available decoders for HEVC
        listAvailableDecoders()
        
        // Create track selector for audio/subtitle selection
        trackSelector = DefaultTrackSelector(this).apply {
            setParameters(
                buildUponParameters()
                    .setPreferredAudioLanguage("ara") // Default Arabic
                    .setPreferredTextLanguage("ara")
                    // Allow exceeding decoder capabilities (will use software decoder)
                    .setExceedRendererCapabilitiesIfNecessary(true)
                    .setExceedVideoConstraintsIfNecessary(true)
                    .setExceedAudioConstraintsIfNecessary(true)
                    // Force maximum quality selection
                    .setForceHighestSupportedBitrate(false)
            )
        }
        
        // Create custom MediaCodecSelector to filter out buggy goldfish decoder
        val mediaCodecSelector = object : MediaCodecSelector {
            override fun getDecoderInfos(
                mimeType: String,
                requiresSecureDecoder: Boolean,
                requiresTunnelingDecoder: Boolean
            ): List<androidx.media3.exoplayer.mediacodec.MediaCodecInfo> {
                val defaultList = MediaCodecUtil.getDecoderInfos(
                    mimeType,
                    requiresSecureDecoder,
                    requiresTunnelingDecoder
                )
                
                // Filter out buggy goldfish HEVC decoder on emulator
                return if (isEmulator && mimeType == "video/hevc") {
                    val filtered = defaultList.filter { 
                        !it.name.contains("goldfish", ignoreCase = true)
                    }
                    android.util.Log.d("PlayerActivity", "Filtered HEVC decoders: ${filtered.map { it.name }}")
                    filtered
                } else {
                    defaultList
                }
            }
        }
        
        // Create RenderersFactory with custom codec selector
        val renderersFactory = DefaultRenderersFactory(this).apply {
            // Set custom MediaCodecSelector to filter buggy decoders
            setMediaCodecSelector(mediaCodecSelector)
            
            // On emulator or after hardware failure, prefer software decoder
            val mode = if (useSoftwareDecoder || isEmulator) {
                DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER
            } else {
                DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON
            }
            setExtensionRendererMode(mode)
            
            // Enable decoder fallback to handle unsupported profiles
            setEnableDecoderFallback(true)
            
            // Allow audio/video renderer to fail gracefully
            setAllowedVideoJoiningTimeMs(5000)
        }
        
        // Create ExoPlayer with track selector and renderers factory
        player = ExoPlayer.Builder(this, renderersFactory)
            .setTrackSelector(trackSelector)
            .build()
            .also { exoPlayer ->
                playerView.player = exoPlayer
                
                // Create media source
                val mediaSource = createMediaSource(streamUrl!!)
                
                // Prepare and play
                exoPlayer.setMediaSource(mediaSource)
                exoPlayer.prepare()
                
                // Seek to resume position if available
                if (resumePosition > 0) {
                    android.util.Log.d("PlayerActivity", "Seeking to resume position: ${WatchProgressManager.formatTime(resumePosition)}")
                    exoPlayer.seekTo(resumePosition)
                }
                
                exoPlayer.playWhenReady = true
                
                // Set volume to max initially
                exoPlayer.volume = 1.0f
                
                // Add listener
                exoPlayer.addListener(object : Player.Listener {
                    override fun onPlayerError(error: PlaybackException) {
                        loadingIndicator?.visibility = View.GONE
                        android.util.Log.e("PlayerActivity", "Player error (retry: $retryCount)", error)
                        
                        // Check error type
                        val isCodecError = error.errorCode == PlaybackException.ERROR_CODE_DECODING_FAILED ||
                                error.errorCode == PlaybackException.ERROR_CODE_DECODER_INIT_FAILED ||
                                error.message?.contains("codec", ignoreCase = true) == true ||
                                error.message?.contains("decoder", ignoreCase = true) == true ||
                                error.message?.contains("NO_EXCEEDS_CAPABILITIES", ignoreCase = true) == true
                        
                        val isSourceError = error.errorCode == PlaybackException.ERROR_CODE_IO_UNSPECIFIED ||
                                error.errorCode == PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED ||
                                error.errorCode == PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED ||
                                error.message?.contains("Source error", ignoreCase = true) == true ||
                                error.message?.contains("ArrayIndexOutOfBoundsException", ignoreCase = true) == true
                        
                        when {
                            // Source error (often from seeking) - retry from current position
                            isSourceError && retryCount < maxRetries -> {
                                retryCount++
                                val currentPosition = player?.currentPosition ?: 0L
                                android.util.Log.w("PlayerActivity", "Source error, reloading from position $currentPosition (attempt $retryCount)")
                                Toast.makeText(
                                    this@PlayerActivity,
                                    "Rechargement...",
                                    Toast.LENGTH_SHORT
                                ).show()
                                
                                handler.postDelayed({
                                    reloadFromPosition(currentPosition)
                                }, 300)
                            }
                            
                            // Codec error - retry with software decoder (only once)
                            isCodecError && !hasTriedSoftwareDecoder && retryCount < maxRetries -> {
                                retryCount++
                                hasTriedSoftwareDecoder = true
                                android.util.Log.w("PlayerActivity", "Codec error, retrying with software decoder (attempt $retryCount)")
                                Toast.makeText(
                                    this@PlayerActivity,
                                    "Changement de décodeur...",
                                    Toast.LENGTH_SHORT
                                ).show()
                                
                                handler.postDelayed({
                                    releasePlayer()
                                    initializePlayer(useSoftwareDecoder = true)
                                }, 500)
                            }
                            
                            else -> {
                                // Show more helpful error message
                                val errorMsg = when {
                                    error.message?.contains("NO_EXCEEDS_CAPABILITIES", ignoreCase = true) == true ||
                                    error.message?.contains("hevc", ignoreCase = true) == true ||
                                    error.message?.contains("h265", ignoreCase = true) == true -> {
                                        "Format vidéo non supporté (HEVC/H.265). Essayez une autre vidéo."
                                    }
                                    else -> "Erreur de lecture: ${error.message}"
                                }
                                
                                Toast.makeText(
                                    this@PlayerActivity,
                                    errorMsg,
                                    Toast.LENGTH_LONG
                                ).show()
                                
                                android.util.Log.e("PlayerActivity", "Final error, giving up: $errorMsg")
                            }
                        }
                    }
                    
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        when (playbackState) {
                            Player.STATE_BUFFERING -> {
                                loadingIndicator?.visibility = View.VISIBLE
                            }
                            Player.STATE_READY -> {
                                loadingIndicator?.visibility = View.GONE
                                retryCount = 0 // Reset retry count on success
                                // Update tracks when ready
                                updateAvailableTracks()
                                
                                // Start next episode monitoring for series
                                if (type == "SERIES" && nextEpisode == null) {
                                    findNextEpisode()
                                }
                                startPositionMonitoring()
                            }
                            Player.STATE_ENDED -> {
                                // For series: auto-play next episode if available
                                if (type == "SERIES" && nextEpisode != null) {
                                    playNextEpisodeNow()
                                } else if (type == "MOVIE" || type == "SERIES") {
                                    finish()
                                }
                            }
                        }
                    }
                    
                    override fun onTracksChanged(tracks: Tracks) {
                        updateAvailableTracks()
                    }
                })
            }
        
        // Configure player view
        playerView.controllerShowTimeoutMs = 5000
        playerView.controllerHideOnTouch = false
        playerView.setShowSubtitleButton(true)
    }
    
    private fun createMediaSource(url: String): MediaSource {
        val uri = Uri.parse(url)
        val dataSourceFactory = DefaultHttpDataSource.Factory()
            .setUserAgent("OXO Player TV/1.0")
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(30000)
            .setReadTimeoutMs(30000)
        
        return when {
            url.contains(".m3u8", ignoreCase = true) -> {
                HlsMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(uri))
            }
            url.startsWith("rtsp://", ignoreCase = true) -> {
                RtspMediaSource.Factory()
                    .createMediaSource(MediaItem.fromUri(uri))
            }
            else -> {
                // Progressive (MPEGTS, MP4, MKV, etc.)
                ProgressiveMediaSource.Factory(dataSourceFactory)
                    .createMediaSource(MediaItem.fromUri(uri))
            }
        }
    }
    
    private fun updateAvailableTracks() {
        val player = player ?: return
        
        audioTracks.clear()
        subtitleTracks.clear()
        
        val tracks = player.currentTracks
        
        for ((groupIndex, groupInfo) in tracks.groups.withIndex()) {
            val trackGroup = groupInfo.mediaTrackGroup
            val trackType = groupInfo.type
            
            for (trackIndex in 0 until trackGroup.length) {
                val format = trackGroup.getFormat(trackIndex)
                val language = format.language ?: "und"
                val label = format.label ?: getLanguageName(language)
                
                when (trackType) {
                    C.TRACK_TYPE_AUDIO -> {
                        val channels = if (format.channelCount > 0) "${format.channelCount}ch" else ""
                        val codec = format.codecs ?: format.sampleMimeType?.replace("audio/", "") ?: ""
                        val trackLabel = StringBuilder().apply {
                            append(label)
                            if (channels.isNotEmpty()) {
                                append(" ($channels")
                                if (codec.isNotEmpty()) {
                                    append(" - $codec)")
                                } else {
                                    append(")")
                                }
                            } else if (codec.isNotEmpty()) {
                                append(" ($codec)")
                            }
                        }.toString()
                        
                        audioTracks.add(TrackInfo(
                            index = audioTracks.size,
                            groupIndex = groupIndex,
                            trackIndex = trackIndex,
                            label = trackLabel,
                            language = language
                        ))
                        android.util.Log.d("PlayerActivity", "Audio track: $trackLabel, mime: ${format.sampleMimeType}")
                    }
                    C.TRACK_TYPE_TEXT -> {
                        subtitleTracks.add(TrackInfo(
                            index = subtitleTracks.size,
                            groupIndex = groupIndex,
                            trackIndex = trackIndex,
                            label = label,
                            language = language
                        ))
                        android.util.Log.d("PlayerActivity", "Subtitle track: $label, mime: ${format.sampleMimeType}")
                    }
                }
            }
        }
        
        // Update button visibility - show audio button even with 1 track for info
        audioButton?.visibility = if (audioTracks.isNotEmpty()) View.VISIBLE else View.GONE
        subtitleButton?.visibility = if (subtitleTracks.isNotEmpty()) View.VISIBLE else View.GONE
        
        android.util.Log.d("PlayerActivity", "Total: ${audioTracks.size} audio tracks, ${subtitleTracks.size} subtitle tracks")
    }
    
    private fun getLanguageName(code: String?): String {
        return when (code?.lowercase()) {
            "ara", "ar" -> "العربية (Arabic)"
            "eng", "en" -> "English"
            "fra", "fr" -> "Français"
            "spa", "es" -> "Español"
            "deu", "de" -> "Deutsch"
            "ita", "it" -> "Italiano"
            "por", "pt" -> "Português"
            "rus", "ru" -> "Русский"
            "tur", "tr" -> "Türkçe"
            "jpn", "ja" -> "日本語"
            "kor", "ko" -> "한국어"
            "chi", "zh" -> "中文"
            "hin", "hi" -> "हिन्दी"
            "und", null -> "Unknown"
            else -> code ?: "Unknown"
        }
    }
    
    private fun showAudioTrackSelector() {
        if (audioTracks.isEmpty()) {
            Toast.makeText(this, "Aucune piste audio disponible", Toast.LENGTH_SHORT).show()
            return
        }
        
        val trackNames = audioTracks.map { it.label }
        
        showTVFriendlyDialog("🔊 Piste Audio", trackNames, selectedAudioIndex) { which ->
            selectAudioTrack(which)
        }
    }
    
    private fun selectAudioTrack(index: Int) {
        if (index < 0 || index >= audioTracks.size) return
        
        selectedAudioIndex = index
        val track = audioTracks[index]
        
        val player = player ?: return
        val tracks = player.currentTracks
        
        try {
            if (track.groupIndex < tracks.groups.size) {
                val group = tracks.groups[track.groupIndex]
                val override = TrackSelectionOverride(group.mediaTrackGroup, listOf(track.trackIndex))
                
                player.trackSelectionParameters = player.trackSelectionParameters
                    .buildUpon()
                    .clearOverridesOfType(C.TRACK_TYPE_AUDIO)
                    .addOverride(override)
                    .build()
                
                Toast.makeText(this, "Audio: ${track.label}", Toast.LENGTH_SHORT).show()
                android.util.Log.d("PlayerActivity", "Selected audio track: ${track.label}")
            }
        } catch (e: Exception) {
            android.util.Log.e("PlayerActivity", "Error selecting audio track", e)
            Toast.makeText(this, "Erreur: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun showSubtitleTrackSelector() {
        val trackNames = mutableListOf("Désactivé")
        trackNames.addAll(subtitleTracks.map { it.label })
        
        val currentSelection = if (selectedSubtitleIndex < 0) 0 else selectedSubtitleIndex + 1
        
        showTVFriendlyDialog("📝 Sous-titres", trackNames, currentSelection) { which ->
            if (which == 0) {
                disableSubtitles()
            } else {
                selectSubtitleTrack(which - 1)
            }
        }
    }
    
    private fun selectSubtitleTrack(index: Int) {
        if (index < 0 || index >= subtitleTracks.size) return
        
        selectedSubtitleIndex = index
        val track = subtitleTracks[index]
        
        val player = player ?: return
        val tracks = player.currentTracks
        
        try {
            if (track.groupIndex < tracks.groups.size) {
                val group = tracks.groups[track.groupIndex]
                val override = TrackSelectionOverride(group.mediaTrackGroup, listOf(track.trackIndex))
                
                player.trackSelectionParameters = player.trackSelectionParameters
                    .buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                    .clearOverridesOfType(C.TRACK_TYPE_TEXT)
                    .addOverride(override)
                    .build()
                
                Toast.makeText(this, "Sous-titres: ${track.label}", Toast.LENGTH_SHORT).show()
                android.util.Log.d("PlayerActivity", "Selected subtitle track: ${track.label}")
            }
        } catch (e: Exception) {
            android.util.Log.e("PlayerActivity", "Error selecting subtitle track", e)
            Toast.makeText(this, "Erreur: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }
    
    private fun disableSubtitles() {
        selectedSubtitleIndex = -1
        
        try {
            player?.trackSelectionParameters = player?.trackSelectionParameters
                ?.buildUpon()
                ?.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                ?.clearOverridesOfType(C.TRACK_TYPE_TEXT)
                ?.build() ?: return
            
            Toast.makeText(this, "Sous-titres désactivés", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            android.util.Log.e("PlayerActivity", "Error disabling subtitles", e)
        }
    }
    
    private fun showStreamInfo() {
        val player = player ?: return
        val format = player.videoFormat
        val audioFormat = player.audioFormat
        
        val info = StringBuilder()
        info.append("📺 Vidéo:\n")
        info.append("  Résolution: ${format?.width ?: "?"} x ${format?.height ?: "?"}\n")
        info.append("  Codec: ${format?.codecs ?: format?.sampleMimeType ?: "?"}\n")
        info.append("  FPS: ${format?.frameRate?.toInt() ?: "?"}\n\n")
        
        info.append("🔊 Audio:\n")
        info.append("  Codec: ${audioFormat?.sampleMimeType ?: "?"}\n")
        info.append("  Channels: ${audioFormat?.channelCount ?: "?"}\n")
        info.append("  Sample Rate: ${audioFormat?.sampleRate ?: "?"} Hz\n\n")
        
        info.append("📡 Stream:\n")
        info.append("  Pistes audio: ${audioTracks.size}\n")
        info.append("  Sous-titres: ${subtitleTracks.size}\n")
        
        AlertDialog.Builder(this, R.style.Theme_OXOPlayer_Dialog)
            .setTitle("ℹ️ Informations")
            .setMessage(info.toString())
            .setPositiveButton("OK", null)
            .show()
    }
    
    private fun updateVolumeText() {
        val currentVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        val percentage = (currentVolume * 100 / maxVolume)
        volumeText?.text = "$percentage%"
    }
    
    private fun adjustVolume(increase: Boolean) {
        val direction = if (increase) AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER
        audioManager.adjustStreamVolume(AudioManager.STREAM_MUSIC, direction, 0)
        
        volumeSeekBar?.progress = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        updateVolumeText()
        
        // Show controller briefly
        playerView.showController()
    }
    
    private fun listAvailableDecoders() {
        try {
            val codecList = android.media.MediaCodecList(android.media.MediaCodecList.ALL_CODECS)
            val codecs = codecList.codecInfos
            
            android.util.Log.d("PlayerActivity", "===== AVAILABLE VIDEO DECODERS =====")
            for (codec in codecs) {
                if (!codec.isEncoder) {
                    val types = codec.supportedTypes
                    for (type in types) {
                        if (type.startsWith("video/")) {
                            val isHardware = !codec.name.contains("OMX.google", ignoreCase = true) && 
                                           !codec.name.contains("c2.android", ignoreCase = true)
                            val decoderType = if (isHardware) "HW" else "SW"
                            android.util.Log.d("PlayerActivity", "[$decoderType] ${codec.name} - $type")
                            
                            if (type == "video/hevc" || type == "video/h265") {
                                android.util.Log.w("PlayerActivity", ">>> HEVC DECODER FOUND: ${codec.name}")
                            }
                        }
                    }
                }
            }
            android.util.Log.d("PlayerActivity", "===================================")
        } catch (e: Exception) {
            android.util.Log.e("PlayerActivity", "Error listing decoders", e)
        }
    }
    
    override fun onPause() {
        super.onPause()
        // Save watch progress before pausing
        saveWatchProgress()
        // Stop next episode monitoring
        stopPositionMonitoring()
        stopCountdown()
        hideNextEpisodeButton()
        player?.pause()
    }
    
    override fun onResume() {
        super.onResume()
        player?.play()
        // Resume position monitoring if playing series
        if (type == "SERIES" && player?.isPlaying == true) {
            startPositionMonitoring()
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Save watch progress before destroying
        saveWatchProgress()
        handler.removeCallbacksAndMessages(null)
        
        // Stop next episode monitoring
        stopPositionMonitoring()
        stopCountdown()
        
        releasePlayer()
    }
    
    /**
     * Save current playback position for resume feature
     */
    private fun saveWatchProgress() {
        val url = streamUrl ?: return
        val videoTitle = title ?: return
        val videoType = type ?: return
        
        val currentPosition = player?.currentPosition ?: 0L
        val duration = player?.duration ?: 0L
        
        // Only save for movies and series, not live TV
        if (videoType != "MOVIE" && videoType != "SERIES") {
            return
        }
        
        // Save progress with cover image
        WatchProgressManager.saveProgress(
            url = url,
            title = videoTitle,
            positionMs = currentPosition,
            durationMs = duration,
            type = videoType,
            cover = cover // Pass the cover image URL
        )
        
        android.util.Log.d("PlayerActivity", "Saved progress for '$videoTitle': ${WatchProgressManager.formatTime(currentPosition)} (cover: $cover)")
    }
    
    private fun releasePlayer() {
        player?.release()
        player = null
    }
    
    /**
     * Seek by a specific amount of milliseconds
     * Handles edge cases and ensures valid seek positions
     */
    private fun seekByAmount(deltaMs: Long) {
        val exoPlayer = player ?: return
        
        val currentPosition = exoPlayer.currentPosition
        val duration = exoPlayer.duration
        
        // Calculate new position
        var newPosition = currentPosition + deltaMs
        
        // Clamp to valid range
        if (duration > 0) {
            newPosition = newPosition.coerceIn(0L, duration - 1000) // Leave 1 second buffer at end
        } else {
            newPosition = maxOf(0L, newPosition)
        }
        
        android.util.Log.d("PlayerActivity", "Seeking from ${currentPosition}ms to ${newPosition}ms (delta: ${deltaMs}ms)")
        
        try {
            exoPlayer.seekTo(newPosition)
        } catch (e: Exception) {
            android.util.Log.e("PlayerActivity", "Seek failed", e)
            // If seek fails, try reloading
            reloadFromPosition(newPosition)
        }
    }
    
    /**
     * Reload the stream from a specific position
     * Used to recover from source errors during seeking
     */
    private fun reloadFromPosition(positionMs: Long) {
        val url = streamUrl ?: return
        
        try {
            // Stop current playback
            player?.stop()
            
            // Create new media source
            val mediaSource = createMediaSource(url)
            
            // Seek slightly back from the error position to avoid the same error
            val safePosition = maxOf(0L, positionMs - 5000) // Go back 5 seconds
            
            // Set new media source and seek
            player?.setMediaSource(mediaSource)
            player?.prepare()
            player?.seekTo(safePosition)
            player?.playWhenReady = true
            
            android.util.Log.d("PlayerActivity", "Reloaded stream at position ${safePosition}ms")
        } catch (e: Exception) {
            android.util.Log.e("PlayerActivity", "Failed to reload stream", e)
            Toast.makeText(this, "Erreur de rechargement", Toast.LENGTH_SHORT).show()
        }
    }
    
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE -> {
                finish()
                true
            }
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_DPAD_CENTER -> {
                player?.let {
                    if (it.isPlaying) it.pause() else it.play()
                }
                true
            }
            KeyEvent.KEYCODE_MEDIA_PLAY -> {
                player?.play()
                true
            }
            KeyEvent.KEYCODE_MEDIA_PAUSE -> {
                player?.pause()
                true
            }
            KeyEvent.KEYCODE_VOLUME_UP -> {
                adjustVolume(true)
                true
            }
            KeyEvent.KEYCODE_VOLUME_DOWN -> {
                adjustVolume(false)
                true
            }
            KeyEvent.KEYCODE_DPAD_LEFT -> {
                seekByAmount(-10000) // Seek back 10 seconds
                playerView.showController()
                true
            }
            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                seekByAmount(10000) // Seek forward 10 seconds
                playerView.showController()
                true
            }
            KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_INFO -> {
                showStreamInfo()
                true
            }
            // A button - Audio track
            KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_A -> {
                showAudioTrackSelector()
                true
            }
            // S button - Subtitles
            KeyEvent.KEYCODE_BUTTON_B, KeyEvent.KEYCODE_S -> {
                showSubtitleTrackSelector()
                true
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }
}
