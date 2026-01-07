package com.oxoplayer.tv.ui.activation

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.os.CountDownTimer
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.oxoplayer.tv.OXOApplication
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.repository.DeviceRepository
import com.oxoplayer.tv.ui.main.MainActivity
import com.oxoplayer.tv.ui.profile.ProfileSelectionActivity
import com.oxoplayer.tv.data.ProfileManager
import kotlinx.coroutines.launch
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class ActivationActivity : AppCompatActivity() {
    
    private lateinit var deviceRepository: DeviceRepository
    private lateinit var preferencesManager: com.oxoplayer.tv.data.preferences.PreferencesManager
    
    private lateinit var statusText: TextView
    private lateinit var macAddressText: TextView
    private lateinit var deviceKeyText: TextView
    private lateinit var daysRemainingText: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var retryButton: Button
    private lateinit var continueButton: Button
    private lateinit var qrCodeImage: ImageView
    private lateinit var changePlaylistButton: Button
    
    // Link Code views
    private lateinit var linkCodeSection: LinearLayout
    private lateinit var linkCodeChar1: TextView
    private lateinit var linkCodeChar2: TextView
    private lateinit var linkCodeChar3: TextView
    private lateinit var linkCodeChar4: TextView
    private lateinit var linkCodeTimer: TextView
    private lateinit var generateNewCodeButton: Button
    private var linkCodeCountdownTimer: CountDownTimer? = null
    private var hasValidLinkCode = false
    
    // Auto-refresh system
    private val refreshHandler = Handler(Looper.getMainLooper())
    private var refreshRunnable: Runnable? = null
    private var isAutoRefreshActive = false
    
    companion object {
        private const val PORTAL_URL = "https://oxo-portal.web.app"
        private const val AUTO_REFRESH_INTERVAL_MS = 10000L // 10 seconds
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_activation)
        
        deviceRepository = DeviceRepository(this)
        preferencesManager = OXOApplication.getInstance().preferencesManager
        
        initViews()
        checkDeviceActivation()
        startAutoRefresh()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stopAutoRefresh()
        linkCodeCountdownTimer?.cancel()
    }
    
    override fun onPause() {
        super.onPause()
        stopAutoRefresh()
    }
    
    override fun onResume() {
        super.onResume()
        if (!isAutoRefreshActive) {
            startAutoRefresh()
        }
    }
    
    /**
     * Start automatic refresh every 10 seconds
     */
    private fun startAutoRefresh() {
        if (isAutoRefreshActive) return
        
        isAutoRefreshActive = true
        android.util.Log.d("ActivationActivity", "Auto-refresh started (every 10 seconds)")
        
        refreshRunnable = object : Runnable {
            override fun run() {
                android.util.Log.d("ActivationActivity", "Auto-refresh triggered")
                checkDeviceActivation()
                
                // Schedule next refresh
                if (isAutoRefreshActive) {
                    refreshHandler.postDelayed(this, AUTO_REFRESH_INTERVAL_MS)
                }
            }
        }
        
        // Start first refresh after 10 seconds
        refreshHandler.postDelayed(refreshRunnable!!, AUTO_REFRESH_INTERVAL_MS)
    }
    
    /**
     * Stop automatic refresh
     */
    private fun stopAutoRefresh() {
        isAutoRefreshActive = false
        refreshRunnable?.let { refreshHandler.removeCallbacks(it) }
        refreshRunnable = null
        android.util.Log.d("ActivationActivity", "Auto-refresh stopped")
    }
    
    private fun initViews() {
        statusText = findViewById(R.id.statusText)
        macAddressText = findViewById(R.id.macAddressText)
        deviceKeyText = findViewById(R.id.deviceKeyText)
        daysRemainingText = findViewById(R.id.daysRemainingText)
        progressBar = findViewById(R.id.progressBar)
        retryButton = findViewById(R.id.retryButton)
        continueButton = findViewById(R.id.continueButton)
        qrCodeImage = findViewById(R.id.qrCodeImage)
        changePlaylistButton = findViewById(R.id.changePlaylistButton)
        
        retryButton.setOnClickListener {
            checkDeviceActivation()
        }
        
        continueButton.setOnClickListener {
            navigateToMain()
        }
        
        changePlaylistButton.setOnClickListener {
            // Open Settings to change playlist
            startActivity(Intent(this, com.oxoplayer.tv.ui.settings.SettingsActivity::class.java))
        }
        
        // Link Code views
        linkCodeSection = findViewById(R.id.linkCodeSection)
        linkCodeChar1 = findViewById(R.id.linkCodeChar1)
        linkCodeChar2 = findViewById(R.id.linkCodeChar2)
        linkCodeChar3 = findViewById(R.id.linkCodeChar3)
        linkCodeChar4 = findViewById(R.id.linkCodeChar4)
        linkCodeTimer = findViewById(R.id.linkCodeTimer)
        generateNewCodeButton = findViewById(R.id.generateNewCodeButton)
        
        generateNewCodeButton.setOnClickListener {
            hasValidLinkCode = false
            generateLinkCode()
        }
        
        // QR Code will be generated after device registration with MAC and device key
    }
    
    /**
     * Generate QR Code for portal with MAC address and device key pre-filled
     */
    private fun generatePortalQRCode(macAddress: String, deviceKey: String) {
        try {
            // URL encode the MAC address (contains colons)
            val encodedMac = URLEncoder.encode(macAddress, "UTF-8")
            val portalUrl = "$PORTAL_URL?mac=$encodedMac&key=$deviceKey"
            
            android.util.Log.d("ActivationActivity", "Generating QR code for: $portalUrl")
            generateQRCode(portalUrl)
        } catch (e: Exception) {
            android.util.Log.e("ActivationActivity", "Error generating portal QR code", e)
            // Fallback to basic URL
            generateQRCode(PORTAL_URL)
        }
    }
    
    /**
     * Generate QR Code bitmap for the given content
     */
    private fun generateQRCode(content: String) {
        try {
            val writer = QRCodeWriter()
            val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, 512, 512)
            val width = bitMatrix.width
            val height = bitMatrix.height
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)
            
            for (x in 0 until width) {
                for (y in 0 until height) {
                    bitmap.setPixel(x, y, if (bitMatrix[x, y]) Color.BLACK else Color.WHITE)
                }
            }
            
            qrCodeImage.setImageBitmap(bitmap)
        } catch (e: Exception) {
            android.util.Log.e("ActivationActivity", "Error generating QR code", e)
        }
    }
    
    private fun checkDeviceActivation() {
        showLoading()
        
        lifecycleScope.launch {
            // Get MAC address
            val macAddress = deviceRepository.getMacAddress()
            macAddressText.text = "MAC: $macAddress"
            preferencesManager.macAddress = macAddress
            
            // Register device
            val registerResult = deviceRepository.registerDevice()
            
            registerResult.onSuccess { registration ->
                preferencesManager.deviceStatus = registration.status
                preferencesManager.expirationDate = registration.expirationDate
                preferencesManager.daysRemaining = registration.daysRemaining
                preferencesManager.hasPlaylist = registration.hasPlaylist
                
                // Display Device Key and generate QR code with MAC + device key
                registration.deviceKey?.let { key ->
                    deviceKeyText.text = "Device Key: $key"
                    preferencesManager.deviceKey = key
                    
                    // Generate QR Code with pre-filled MAC and device key
                    generatePortalQRCode(macAddress, key)
                }
                
                when (registration.status) {
                    "trial" -> {
                        showTrialStatus(registration.daysRemaining)
                        if (registration.hasPlaylist) {
                            // Playlist configured! Stop auto-refresh and navigate
                            stopAutoRefresh()
                            changePlaylistButton.visibility = View.VISIBLE
                            navigateToMain()
                        } else {
                            showNoPlaylist()
                            changePlaylistButton.visibility = View.VISIBLE
                            // Show link code section
                            linkCodeSection.visibility = View.VISIBLE
                            // Generate code only if not already valid
                            if (!hasValidLinkCode) {
                                android.util.Log.d("ActivationActivity", "No valid link code, generating...")
                                generateLinkCode()
                            } else {
                                android.util.Log.d("ActivationActivity", "Link code already valid, keeping displayed")
                            }
                        }
                    }
                    "active" -> {
                        showActiveStatus(registration.daysRemaining)
                        if (registration.hasPlaylist) {
                            // Playlist configured! Stop auto-refresh and navigate
                            stopAutoRefresh()
                            linkCodeCountdownTimer?.cancel()
                            linkCodeSection.visibility = View.GONE
                            hasValidLinkCode = false
                            changePlaylistButton.visibility = View.VISIBLE
                            navigateToMain()
                        } else {
                            showNoPlaylist()
                            changePlaylistButton.visibility = View.VISIBLE
                            // Show link code section
                            linkCodeSection.visibility = View.VISIBLE
                            // Generate code only if not already valid
                            if (!hasValidLinkCode) {
                                android.util.Log.d("ActivationActivity", "No valid link code, generating...")
                                generateLinkCode()
                            } else {
                                android.util.Log.d("ActivationActivity", "Link code already valid, keeping displayed")
                            }
                        }
                    }
                    "expired" -> {
                        showExpiredStatus()
                        // Keep auto-refresh active (waiting for renewal)
                        // Show link code for renewal
                        linkCodeSection.visibility = View.VISIBLE
                        if (!hasValidLinkCode) {
                            generateLinkCode()
                        }
                    }
                    "disabled" -> {
                        showDisabledStatus()
                        // Keep auto-refresh active (waiting for admin to re-enable)
                        // Show link code so user can contact reseller
                        linkCodeSection.visibility = View.VISIBLE
                        if (!hasValidLinkCode) {
                            generateLinkCode()
                        }
                    }
                    else -> {
                        showError("Statut inconnu")
                    }
                }
            }
            
            registerResult.onFailure { error ->
                showError(error.message ?: "Erreur de connexion")
            }
        }
    }
    
    private fun showLoading() {
        progressBar.visibility = View.VISIBLE
        val refreshStatus = if (isAutoRefreshActive) " 🔄" else ""
        statusText.text = "Vérification de l'appareil...$refreshStatus"
        daysRemainingText.visibility = View.GONE
        retryButton.visibility = View.GONE
        continueButton.visibility = View.GONE
        // Keep linkCodeSection visible if it was already showing
        // Don't hide it during refresh
    }
    
    private fun showTrialStatus(daysRemaining: Int) {
        progressBar.visibility = View.GONE
        statusText.text = "📺 Période d'essai activée"
        daysRemainingText.text = "Il vous reste $daysRemaining jours d'essai gratuit"
        daysRemainingText.visibility = View.VISIBLE
        retryButton.visibility = View.GONE
    }
    
    private fun showActiveStatus(daysRemaining: Int) {
        progressBar.visibility = View.GONE
        statusText.text = "✅ Appareil activé"
        daysRemainingText.text = "Expire dans $daysRemaining jours"
        daysRemainingText.visibility = View.VISIBLE
        retryButton.visibility = View.GONE
        preferencesManager.isActivated = true
    }
    
    private fun showExpiredStatus() {
        progressBar.visibility = View.GONE
        statusText.text = "⚠️ Abonnement expiré"
        daysRemainingText.text = "Contactez votre revendeur pour renouveler"
        daysRemainingText.visibility = View.VISIBLE
        retryButton.visibility = View.VISIBLE
        continueButton.visibility = View.GONE
    }
    
    private fun showDisabledStatus() {
        progressBar.visibility = View.GONE
        statusText.text = "🚫 Appareil désactivé"
        daysRemainingText.text = "Contactez l'administrateur pour réactiver"
        daysRemainingText.visibility = View.VISIBLE
        retryButton.visibility = View.VISIBLE
        continueButton.visibility = View.GONE
    }
    
    private fun showNoPlaylist() {
        val refreshInfo = if (isAutoRefreshActive) "\n\n🔄 Vérification automatique toutes les 10s..." else ""
        daysRemainingText.text = "${daysRemainingText.text}\n\n⚠️ Aucune playlist configurée.\nContactez votre revendeur.$refreshInfo"
    }
    
    private fun showError(message: String) {
        progressBar.visibility = View.GONE
        statusText.text = "❌ Erreur"
        daysRemainingText.text = message
        daysRemainingText.visibility = View.VISIBLE
        retryButton.visibility = View.VISIBLE
        continueButton.visibility = View.GONE
    }
    
    private fun enableContinue() {
        continueButton.visibility = View.VISIBLE
        continueButton.requestFocus()
    }
    
    private fun navigateToMain() {
        // Show loading screen and load playlist
        statusText.text = "⏳ Chargement de la playlist..."
        progressBar.visibility = View.VISIBLE
        continueButton.visibility = View.GONE
        
        lifecycleScope.launch {
            try {
                // Get playlist info (contains the URL or Xtream credentials)
                val deviceRepo = com.oxoplayer.tv.data.repository.DeviceRepository(this@ActivationActivity)
                val playlistResult = deviceRepo.getPlaylist()
                
                playlistResult.onSuccess { playlistResponse ->
                    android.util.Log.d("ActivationActivity", "Playlist type: ${playlistResponse.playlistType}")
                    
                    // Check if it's Xtream Code
                    if (playlistResponse.playlistType == "xtream" && playlistResponse.xtream != null) {
                        statusText.text = "📺 Connexion Xtream Code..."
                        
                        // Initialize Xtream with credentials from API
                        val credentials = com.oxoplayer.tv.data.models.XtreamCredentials(
                            host = playlistResponse.xtream.host,
                            username = playlistResponse.xtream.username,
                            password = playlistResponse.xtream.password
                        )
                        
                        com.oxoplayer.tv.data.api.XtreamClient.initialize(credentials)
                        com.oxoplayer.tv.data.DataManager.initXtreamCredentials(credentials, preferencesManager.currentPlaylistId)
                        
                        // Load Xtream categories
                        initializeXtreamCategories()
                        
                        // Navigate to Home
                        val intent = Intent(this@ActivationActivity, ProfileSelectionActivity::class.java)
                        startActivity(intent)
                        finish()
                        
                    } else {
                        // M3U mode - try Xtream API first, fallback to M3U parsing
                        val playlistUrl = playlistResponse.playlistUrl
                        
                        // First try to extract Xtream credentials and use Xtream API
                        val credentials = if (!playlistUrl.isNullOrEmpty()) {
                            com.oxoplayer.tv.data.parser.M3UParser.extractXtreamCredentialsFromUrl(playlistUrl)
                        } else null
                        
                        if (credentials != null) {
                            // Use Xtream API (much faster and more efficient)
                            statusText.text = "📺 Connexion au serveur Xtream..."
                            android.util.Log.d("ActivationActivity", "Using Xtream API for M3U playlist")
                            
                            com.oxoplayer.tv.data.api.XtreamClient.initialize(credentials)
                            com.oxoplayer.tv.data.DataManager.initXtreamCredentials(credentials, preferencesManager.currentPlaylistId)
                            
                            initializeXtreamCategories()
                            
                            val intent = Intent(this@ActivationActivity, ProfileSelectionActivity::class.java)
                            startActivity(intent)
                            finish()
                        } else {
                            // Fallback to M3U parsing - download directly from URL
                            statusText.text = "⏳ Téléchargement de la playlist...\n(Grande playlist, cela peut prendre du temps)"
                            
                            // Try direct download first (bypasses backend)
                            val directResult = if (!playlistUrl.isNullOrEmpty()) {
                                deviceRepo.downloadM3UDirectly(playlistUrl)
                            } else {
                                Result.failure(Exception("No playlist URL"))
                            }
                            
                            directResult.onSuccess { inputStream ->
                                statusText.text = "📋 Analyse de la playlist...\n(Traitement optimisé en cours)"
                            
                                // Parse M3U using optimized streaming parser
                                val parseResult = com.oxoplayer.tv.data.parser.M3UParser.parseM3UFromStream(inputStream)
                            
                                // Store in DataManager
                            com.oxoplayer.tv.data.DataManager.setData(
                                parseResult.channels,
                                parseResult.movies,
                                parseResult.series,
                                parseResult.liveCategories,
                                parseResult.movieCategories,
                                parseResult.seriesCategories
                            )
                            
                                android.util.Log.d("ActivationActivity", "M3U parsed: ${parseResult.channels.size} channels, ${parseResult.movies.size} movies, ${parseResult.series.size} series")
                                
                                // Navigate to Home
                                val intent = Intent(this@ActivationActivity, ProfileSelectionActivity::class.java)
                                startActivity(intent)
                                finish()
                            }
                            
                            directResult.onFailure { directError ->
                                // If direct download fails, try backend
                                android.util.Log.w("ActivationActivity", "Direct download failed, trying backend: ${directError.message}")
                                
                                statusText.text = "⏳ Tentative via le serveur..."
                                val backendResult = deviceRepo.getPlaylistContent()
                                
                                backendResult.onSuccess { m3uContent ->
                                    statusText.text = "📋 Analyse de la playlist..."
                                    
                                    val parseResult = com.oxoplayer.tv.data.parser.M3UParser.parseM3U(m3uContent)
                                    
                                    com.oxoplayer.tv.data.DataManager.setData(
                                        parseResult.channels,
                                        parseResult.movies,
                                        parseResult.series,
                                        parseResult.liveCategories,
                                        parseResult.movieCategories,
                                        parseResult.seriesCategories
                                    )
                                    
                                    val intent = Intent(this@ActivationActivity, ProfileSelectionActivity::class.java)
                            startActivity(intent)
                            finish()
                        }
                        
                                backendResult.onFailure { error ->
                                    statusText.text = "❌ Erreur de chargement"
                                    daysRemainingText.text = "Impossible de charger la playlist.\n${error.message}\n\nEssayez d'utiliser une URL Xtream API."
                            daysRemainingText.visibility = View.VISIBLE
                            progressBar.visibility = View.GONE
                            retryButton.visibility = View.VISIBLE
                                }
                            }
                        }
                    }
                }
                
                playlistResult.onFailure { error ->
                    statusText.text = "Erreur de chargement"
                    daysRemainingText.text = error.message
                    daysRemainingText.visibility = View.VISIBLE
                    progressBar.visibility = View.GONE
                    retryButton.visibility = View.VISIBLE
                }
                
            } catch (e: Exception) {
                statusText.text = "Erreur"
                daysRemainingText.text = e.message
                daysRemainingText.visibility = View.VISIBLE
                progressBar.visibility = View.GONE
                retryButton.visibility = View.VISIBLE
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
            statusText.text = "📺 Chargement des chaînes Live TV..."
            try {
                val liveCategoriesResult = xtreamRepo.getLiveCategories()
                liveCategoriesResult.onSuccess { categories ->
                    com.oxoplayer.tv.data.DataManager.initXtreamLiveCategories(categories)
                    android.util.Log.d("ActivationActivity", "Loaded ${categories.size} Xtream Live TV categories")
                }
            } catch (e: Exception) {
                android.util.Log.w("ActivationActivity", "Failed to load Live TV categories", e)
            }
            
            // Pre-load Movie categories
            statusText.text = "🎬 Chargement des films..."
            try {
                val movieCategoriesResult = xtreamRepo.getMovieCategories()
                movieCategoriesResult.onSuccess { categories ->
                    com.oxoplayer.tv.data.DataManager.initXtreamMovieCategories(categories)
                    android.util.Log.d("ActivationActivity", "Loaded ${categories.size} Xtream movie categories")
                }
            } catch (e: Exception) {
                android.util.Log.w("ActivationActivity", "Failed to load movie categories", e)
            }
            
            // Pre-load Series categories
            statusText.text = "📺 Chargement des séries..."
            try {
                val seriesCategoriesResult = xtreamRepo.getSeriesCategories()
                seriesCategoriesResult.onSuccess { categories ->
                    com.oxoplayer.tv.data.DataManager.initXtreamSeriesCategories(categories)
                    android.util.Log.d("ActivationActivity", "Loaded ${categories.size} Xtream series categories")
                }
            } catch (e: Exception) {
                android.util.Log.w("ActivationActivity", "Failed to load series categories", e)
            }
            
            android.util.Log.d("ActivationActivity", "Xtream initialization complete")
            
        } catch (e: Exception) {
            android.util.Log.e("ActivationActivity", "Error initializing Xtream", e)
        }
    }
    
    /**
     * Initialize Xtream API for all content (Live TV, Movies, Series)
     * This enables proper category organization and correct stream URLs
     */
    private suspend fun initializeXtreamForSeries(playlistUrl: String?, m3uContent: String) {
        try {
            // Try to extract Xtream credentials from URL or content
            val credentials = if (!playlistUrl.isNullOrEmpty()) {
                com.oxoplayer.tv.data.parser.M3UParser.extractXtreamCredentialsFromUrl(playlistUrl)
            } else {
                com.oxoplayer.tv.data.parser.M3UParser.extractXtreamCredentials(m3uContent)
            }
            
            if (credentials != null) {
                android.util.Log.d("ActivationActivity", "Xtream credentials extracted - Host: ${credentials.host}")
                
                // Initialize Xtream client
                com.oxoplayer.tv.data.api.XtreamClient.initialize(credentials)
                
                // Store credentials in DataManager
                com.oxoplayer.tv.data.DataManager.initXtreamCredentials(credentials, preferencesManager.currentPlaylistId)
                
                val xtreamRepo = com.oxoplayer.tv.data.repository.XtreamRepository()
                
                // Pre-load Live TV categories
                statusText.text = "📺 Chargement des chaînes Live TV..."
                try {
                    val liveCategoriesResult = xtreamRepo.getLiveCategories()
                    liveCategoriesResult.onSuccess { categories ->
                        com.oxoplayer.tv.data.DataManager.initXtreamLiveCategories(categories)
                        android.util.Log.d("ActivationActivity", "Loaded ${categories.size} Xtream Live TV categories")
                        
                        // Pre-load first category streams for home page
                        if (categories.isNotEmpty()) {
                            val streamsResult = xtreamRepo.getLiveStreamsByCategory(categories[0].categoryId)
                            streamsResult.onSuccess { streams ->
                                com.oxoplayer.tv.data.DataManager.cacheLiveStreamsForCategory(categories[0].categoryId, streams)
                                android.util.Log.d("ActivationActivity", "Pre-loaded ${streams.size} Live TV streams")
                            }
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.w("ActivationActivity", "Failed to load Live TV categories", e)
                }
                
                // Pre-load Movie categories
                statusText.text = "🎬 Chargement des films..."
                try {
                    val movieCategoriesResult = xtreamRepo.getMovieCategories()
                    movieCategoriesResult.onSuccess { categories ->
                        com.oxoplayer.tv.data.DataManager.initXtreamMovieCategories(categories)
                        android.util.Log.d("ActivationActivity", "Loaded ${categories.size} Xtream movie categories")
                        
                        // Pre-load first category movies for home page
                        if (categories.isNotEmpty()) {
                            val moviesResult = xtreamRepo.getMoviesByCategory(categories[0].categoryId)
                            moviesResult.onSuccess { movies ->
                                com.oxoplayer.tv.data.DataManager.cacheMoviesForCategory(categories[0].categoryId, movies)
                                android.util.Log.d("ActivationActivity", "Pre-loaded ${movies.size} movies")
                            }
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.w("ActivationActivity", "Failed to load movie categories", e)
                }
                
                // Pre-load Series categories
                statusText.text = "📺 Chargement des séries..."
                try {
                    val seriesCategoriesResult = xtreamRepo.getSeriesCategories()
                    seriesCategoriesResult.onSuccess { categories ->
                        com.oxoplayer.tv.data.DataManager.initXtreamSeriesCategories(categories)
                        android.util.Log.d("ActivationActivity", "Loaded ${categories.size} Xtream series categories")
                        
                        // Pre-load first category series for home page
                        if (categories.isNotEmpty()) {
                            val seriesResult = xtreamRepo.getSeriesByCategory(categories[0].categoryId)
                            seriesResult.onSuccess { seriesList ->
                                com.oxoplayer.tv.data.DataManager.cacheSeriesForCategory(categories[0].categoryId, seriesList)
                                android.util.Log.d("ActivationActivity", "Pre-loaded ${seriesList.size} series")
                            }
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.w("ActivationActivity", "Failed to load series categories", e)
                }
                
                android.util.Log.d("ActivationActivity", "Xtream initialization complete - isXtreamEnabled: ${com.oxoplayer.tv.data.DataManager.isXtreamEnabled}")
                
            } else {
                android.util.Log.d("ActivationActivity", "No Xtream credentials found, using M3U parsing")
            }
        } catch (e: Exception) {
            android.util.Log.e("ActivationActivity", "Error initializing Xtream", e)
            // Continue without Xtream - will use M3U fallback
        }
    }
    
    /**
     * Generate a 4-character link code for easy activation
     */
    private fun generateLinkCode() {
        android.util.Log.d("ActivationActivity", "generateLinkCode() called, hasValidLinkCode=$hasValidLinkCode")
        
        // Mark as generating to prevent duplicate calls
        hasValidLinkCode = true
        
        // Make sure section is visible
        linkCodeSection.visibility = View.VISIBLE
        
        // Reset display
        linkCodeChar1.text = "-"
        linkCodeChar2.text = "-"
        linkCodeChar3.text = "-"
        linkCodeChar4.text = "-"
        linkCodeTimer.text = "Génération..."
        generateNewCodeButton.visibility = View.GONE
        linkCodeCountdownTimer?.cancel()
        
        lifecycleScope.launch {
            try {
                val result = deviceRepository.generateLinkCode()
                
                result.onSuccess { response ->
                    android.util.Log.d("ActivationActivity", "Link code generated: ${response.code}")
                    val code = response.code
                    if (code.length >= 4) {
                        linkCodeChar1.text = code[0].toString()
                        linkCodeChar2.text = code[1].toString()
                        linkCodeChar3.text = code[2].toString()
                        linkCodeChar4.text = code[3].toString()
                    }
                    // Keep section visible
                    linkCodeSection.visibility = View.VISIBLE
                    
                    // Parse expiration time and start countdown
                    try {
                        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                        dateFormat.timeZone = TimeZone.getTimeZone("UTC")
                        val expiresAt = dateFormat.parse(response.expiresAt)
                        
                        if (expiresAt != null) {
                            val remainingMs = expiresAt.time - System.currentTimeMillis()
                            if (remainingMs > 0) {
                                startLinkCodeCountdown(remainingMs)
                            } else {
                                linkCodeTimer.text = "Code expiré"
                                generateNewCodeButton.visibility = View.VISIBLE
                                hasValidLinkCode = false
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("ActivationActivity", "Error parsing expiration", e)
                        // Default to 10 minutes
                        startLinkCodeCountdown(10 * 60 * 1000L)
                    }
                }
                
                result.onFailure { error ->
                    android.util.Log.e("ActivationActivity", "Error generating link code: ${error.message}")
                    linkCodeTimer.text = "Erreur - Réessayer"
                    generateNewCodeButton.visibility = View.VISIBLE
                    hasValidLinkCode = false
                    // Keep section visible even on error
                    linkCodeSection.visibility = View.VISIBLE
                }
            } catch (e: Exception) {
                android.util.Log.e("ActivationActivity", "Exception in generateLinkCode", e)
                linkCodeTimer.text = "Erreur"
                generateNewCodeButton.visibility = View.VISIBLE
                hasValidLinkCode = false
                linkCodeSection.visibility = View.VISIBLE
            }
        }
    }
    
    /**
     * Start countdown timer for link code expiration
     */
    private fun startLinkCodeCountdown(durationMs: Long) {
        linkCodeCountdownTimer?.cancel()
        
        linkCodeCountdownTimer = object : CountDownTimer(durationMs, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val minutes = (millisUntilFinished / 1000) / 60
                val seconds = (millisUntilFinished / 1000) % 60
                linkCodeTimer.text = String.format("Expire dans %02d:%02d", minutes, seconds)
            }
            
            override fun onFinish() {
                linkCodeTimer.text = "Code expiré"
                generateNewCodeButton.visibility = View.VISIBLE
                hasValidLinkCode = false
            }
        }.start()
    }
}

