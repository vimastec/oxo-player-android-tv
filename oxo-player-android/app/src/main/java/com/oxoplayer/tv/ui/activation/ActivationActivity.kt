package com.oxoplayer.tv.ui.activation

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ImageView
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
    
    companion object {
        private const val PORTAL_URL = "https://oxo-portal.web.app"
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_activation)
        
        deviceRepository = DeviceRepository(this)
        preferencesManager = OXOApplication.getInstance().preferencesManager
        
        initViews()
        checkDeviceActivation()
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
                            // Show change playlist button and auto-continue
                            changePlaylistButton.visibility = View.VISIBLE
                            navigateToMain()
                        } else {
                            showNoPlaylist()
                            // Show change playlist button even without playlist
                            changePlaylistButton.visibility = View.VISIBLE
                        }
                    }
                    "active" -> {
                        showActiveStatus(registration.daysRemaining)
                        if (registration.hasPlaylist) {
                            // Show change playlist button and auto-continue
                            changePlaylistButton.visibility = View.VISIBLE
                            navigateToMain()
                        } else {
                            showNoPlaylist()
                            // Show change playlist button even without playlist
                            changePlaylistButton.visibility = View.VISIBLE
                        }
                    }
                    "expired" -> {
                        showExpiredStatus()
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
        statusText.text = "Vérification de l'appareil..."
        daysRemainingText.visibility = View.GONE
        retryButton.visibility = View.GONE
        continueButton.visibility = View.GONE
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
    
    private fun showNoPlaylist() {
        daysRemainingText.text = "${daysRemainingText.text}\n\n⚠️ Aucune playlist configurée.\nContactez votre revendeur."
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
                        com.oxoplayer.tv.data.DataManager.initXtreamCredentials(credentials)
                        
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
                            com.oxoplayer.tv.data.DataManager.initXtreamCredentials(credentials)
                            
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
                com.oxoplayer.tv.data.DataManager.initXtreamCredentials(credentials)
                
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
}

