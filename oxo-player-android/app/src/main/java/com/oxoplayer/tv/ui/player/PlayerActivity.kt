package com.oxoplayer.tv.ui.player

import android.app.AlertDialog
import android.media.AudioManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.widget.ImageButton
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
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.WatchProgressManager

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
        
        initViews()
        parseIntent()
        
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
        volumeSeekBar = findViewById(R.id.volume_seekbar)
        volumeText = findViewById(R.id.volume_text)
        audioButton = findViewById(R.id.btn_audio)
        subtitleButton = findViewById(R.id.btn_subtitle)
        infoButton = findViewById(R.id.btn_info)
        
        // Sync top bar visibility with player controller
        playerView.setControllerVisibilityListener(
            PlayerView.ControllerVisibilityListener { visibility ->
                topBar?.visibility = visibility
            }
        )
        
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
        
        // Audio button
        audioButton?.setOnClickListener {
            showAudioTrackSelector()
        }
        
        // Subtitle button
        subtitleButton?.setOnClickListener {
            showSubtitleTrackSelector()
        }
        
        // Info button
        infoButton?.setOnClickListener {
            showStreamInfo()
        }
    }
    
    private fun parseIntent() {
        streamUrl = intent.getStringExtra("STREAM_URL")
        title = intent.getStringExtra("TITLE") ?: "OXO Player"
        type = intent.getStringExtra("TYPE")
        cover = intent.getStringExtra("COVER")
        
        titleText?.text = title
        
        android.util.Log.d("PlayerActivity", "===== PLAYBACK INFO =====")
        android.util.Log.d("PlayerActivity", "Title: $title")
        android.util.Log.d("PlayerActivity", "Type: $type")
        android.util.Log.d("PlayerActivity", "Cover: $cover")
        android.util.Log.d("PlayerActivity", "URL: $streamUrl")
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
                            }
                            Player.STATE_ENDED -> {
                                if (type == "MOVIE" || type == "SERIES") {
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
        
        val trackNames = audioTracks.map { it.label }.toTypedArray()
        
        AlertDialog.Builder(this, R.style.Theme_OXOPlayer_Dialog)
            .setTitle("🔊 Piste Audio")
            .setSingleChoiceItems(trackNames, selectedAudioIndex) { dialog, which ->
                selectAudioTrack(which)
                dialog.dismiss()
            }
            .setNegativeButton("Annuler", null)
            .show()
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
        
        AlertDialog.Builder(this, R.style.Theme_OXOPlayer_Dialog)
            .setTitle("📝 Sous-titres")
            .setSingleChoiceItems(trackNames.toTypedArray(), currentSelection) { dialog, which ->
                if (which == 0) {
                    disableSubtitles()
                } else {
                    selectSubtitleTrack(which - 1)
                }
                dialog.dismiss()
            }
            .setNegativeButton("Annuler", null)
            .show()
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
        player?.pause()
    }
    
    override fun onResume() {
        super.onResume()
        player?.play()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Save watch progress before destroying
        saveWatchProgress()
        handler.removeCallbacksAndMessages(null)
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
