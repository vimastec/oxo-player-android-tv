package com.oxoplayer.tv.ui.series

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.DataManager
import com.oxoplayer.tv.data.models.Episode
import com.oxoplayer.tv.data.models.Season
import com.oxoplayer.tv.data.models.Series
import com.oxoplayer.tv.data.models.XtreamSeriesInfo
import com.oxoplayer.tv.data.repository.XtreamRepository
import kotlinx.coroutines.launch

/**
 * Series Detail Activity
 * Shows hierarchy: Seasons → Episodes
 * 
 * Supports both Xtream API mode and legacy M3U mode
 */
class SeriesDetailActivity : AppCompatActivity() {
    
    private val TAG = "SeriesDetailActivity"
    
    private lateinit var coverImage: ImageView
    private lateinit var backgroundImage: ImageView
    private lateinit var titleText: TextView
    private lateinit var infoText: TextView
    private lateinit var plotText: TextView
    private lateinit var seasonsRecyclerView: RecyclerView
    private lateinit var episodesRecyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    
    // Additional info views
    private lateinit var seriesYear: TextView
    private lateinit var seriesRating: TextView
    private lateinit var seriesGenre: TextView
    private lateinit var seriesEpisodeDuration: TextView
    private lateinit var seriesDirector: TextView
    private lateinit var seriesCast: TextView
    private lateinit var ratingContainer: View
    private lateinit var directorContainer: View
    private lateinit var castContainer: View
    private lateinit var divider1: View
    private lateinit var divider2: View
    private lateinit var episodesTitle: TextView
    
    private val xtreamRepository = XtreamRepository()
    
    private var series: Series? = null
    private var xtreamSeriesInfo: XtreamSeriesInfo? = null
    private var seasons = listOf<Season>()
    private var currentSeasonEpisodes = listOf<Episode>()
    private var selectedSeasonIndex = 0
    
    // Intent extras
    private var isXtreamMode = false
    private var seriesId: Int = 0
    private var seriesName: String = ""
    private var seriesCover: String? = null
    private var categoryName: String = ""
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_series_detail)
        
        parseIntent()
        initViews()
        loadSeriesData()
    }
    
    private fun parseIntent() {
        isXtreamMode = intent.getBooleanExtra("IS_XTREAM", false)
        seriesName = intent.getStringExtra("SERIES_NAME") ?: "Unknown Series"
        seriesCover = intent.getStringExtra("SERIES_COVER")
        categoryName = intent.getStringExtra("CATEGORY_NAME") ?: ""
        
        if (isXtreamMode) {
            seriesId = intent.getIntExtra("SERIES_ID", 0)
        } else {
            // Legacy mode - series ID is a string
            val legacyId = intent.getStringExtra("SERIES_ID") ?: ""
            seriesId = legacyId.hashCode()
        }
        
        android.util.Log.d(TAG, "Opening series: $seriesName (ID: $seriesId, Xtream: $isXtreamMode)")
    }
    
    private fun initViews() {
        coverImage = findViewById(R.id.seriesCoverImage)
        backgroundImage = findViewById(R.id.backgroundImage)
        titleText = findViewById(R.id.seriesTitleText)
        infoText = findViewById(R.id.seriesInfoText)
        plotText = findViewById(R.id.seriesPlotText)
        seasonsRecyclerView = findViewById(R.id.seasonsRecyclerView)
        episodesRecyclerView = findViewById(R.id.episodesRecyclerView)
        progressBar = findViewById(R.id.progressBar)
        
        // Additional info views
        seriesYear = findViewById(R.id.seriesYear)
        seriesRating = findViewById(R.id.seriesRating)
        seriesGenre = findViewById(R.id.seriesGenre)
        seriesEpisodeDuration = findViewById(R.id.seriesEpisodeDuration)
        seriesDirector = findViewById(R.id.seriesDirector)
        seriesCast = findViewById(R.id.seriesCast)
        ratingContainer = findViewById(R.id.ratingContainer)
        directorContainer = findViewById(R.id.directorContainer)
        castContainer = findViewById(R.id.castContainer)
        divider1 = findViewById(R.id.divider1)
        divider2 = findViewById(R.id.divider2)
        episodesTitle = findViewById(R.id.episodesTitle)
        
        // Set initial data
        titleText.text = seriesName
        
        // Load cover if available
        if (!seriesCover.isNullOrEmpty()) {
            Glide.with(this)
                .load(seriesCover)
                .placeholder(R.drawable.placeholder_series)
                .error(R.drawable.placeholder_series)
                .into(coverImage)
                
            Glide.with(this)
                .load(seriesCover)
                .into(backgroundImage)
        }
    }
    
    private fun loadSeriesData() {
        if (isXtreamMode) {
            loadXtreamSeriesData()
        } else {
            loadLegacySeriesData()
        }
    }
    
    // ==================== Xtream Mode ====================
    
    private fun loadXtreamSeriesData() {
        showLoading(true)
        
        // Load from API to get full details including cast, director, etc.
        lifecycleScope.launch {
            val result = xtreamRepository.getSeriesInfo(seriesId)
            
            result.onSuccess { seriesInfo ->
                // Store raw info for additional details
                xtreamSeriesInfo = seriesInfo
                
                // Convert to app model
                val convertedSeries = xtreamRepository.convertToAppSeries(
                    seriesId,
                    seriesInfo,
                    categoryName
                )
                
                // Cache it
                DataManager.cacheSeriesInfo(seriesId, convertedSeries)
                
                series = convertedSeries
                displaySeriesData()
            }
            
            result.onFailure { error ->
                showLoading(false)
                android.util.Log.e(TAG, "Error loading series info", error)
                Toast.makeText(
                    this@SeriesDetailActivity,
                    "Erreur: ${error.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }
    
    // ==================== Legacy M3U Mode ====================
    
    private fun loadLegacySeriesData() {
        val legacyId = intent.getStringExtra("SERIES_ID")
        
        // Find series from DataManager
        series = DataManager.series.find { it.id == legacyId }
        
        if (series == null) {
            Toast.makeText(this, "Série introuvable", Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        
        displaySeriesData()
    }
    
    // ==================== Display ====================
    
    private fun displaySeriesData() {
        showLoading(false)
        
        val seriesData = series ?: return
        
        // Update UI with series info
        titleText.text = seriesData.name
        
        // Get additional info from Xtream response
        val info = xtreamSeriesInfo?.info
        
        // Year/Release Date
        val releaseDate = info?.releaseDate ?: info?.releaseDateAlt ?: seriesData.year
        if (!releaseDate.isNullOrEmpty()) {
            seriesYear.text = releaseDate.take(4) // Get just the year
            seriesYear.visibility = View.VISIBLE
            divider1.visibility = View.VISIBLE
        }
        
        // Rating
        val rating = info?.rating ?: seriesData.rating
        if (!rating.isNullOrEmpty() && rating != "0") {
            seriesRating.text = rating
            ratingContainer.visibility = View.VISIBLE
        }
        
        // Episode Duration
        val episodeDuration = info?.episodeRunTime
        if (!episodeDuration.isNullOrEmpty()) {
            seriesEpisodeDuration.text = "${episodeDuration} min/ep"
            seriesEpisodeDuration.visibility = View.VISIBLE
            divider2.visibility = View.VISIBLE
        }
        
        // Genre
        val genre = info?.genre
        if (!genre.isNullOrEmpty()) {
            seriesGenre.text = genre
            seriesGenre.visibility = View.VISIBLE
        }
        
        // Seasons/Episodes count
        val totalEpisodes = seriesData.seasons.sumOf { it.episodes.size }
        infoText.text = "${seriesData.seasons.size} saison(s) • $totalEpisodes épisode(s)"
        
        // Plot
        val plot = info?.plot ?: seriesData.plot
        if (!plot.isNullOrEmpty()) {
            plotText.text = plot
            plotText.visibility = View.VISIBLE
        } else {
            plotText.visibility = View.GONE
        }
        
        // Director
        val director = info?.director
        if (!director.isNullOrEmpty()) {
            seriesDirector.text = director
            directorContainer.visibility = View.VISIBLE
        }
        
        // Cast/Actors
        val cast = info?.cast
        if (!cast.isNullOrEmpty()) {
            seriesCast.text = cast
            castContainer.visibility = View.VISIBLE
        }
        
        // Cover image
        val coverUrl = info?.cover ?: seriesData.cover
        if (!coverUrl.isNullOrEmpty()) {
            Glide.with(this)
                .load(coverUrl)
                .placeholder(R.drawable.placeholder_series)
                .error(R.drawable.placeholder_series)
                .into(coverImage)
                
            Glide.with(this)
                .load(coverUrl)
                .into(backgroundImage)
        }
        
        // Setup seasons (don't show episodes yet)
        seasons = seriesData.seasons
        selectedSeasonIndex = -1 // No season selected initially
        
        setupRecyclerViews()
    }
    
    private fun setupRecyclerViews() {
        // Seasons list (horizontal)
        seasonsRecyclerView.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        val seasonsAdapter = SeasonsAdapter(seasons, selectedSeasonIndex) { season, position ->
            onSeasonSelected(season, position)
        }
        seasonsRecyclerView.adapter = seasonsAdapter
        
        // Episodes list (vertical) - hidden initially
        episodesRecyclerView.layoutManager = LinearLayoutManager(this)
        episodesRecyclerView.visibility = View.GONE
        episodesTitle.visibility = View.GONE
    }
    
    private fun onSeasonSelected(season: Season, position: Int) {
        selectedSeasonIndex = position
        currentSeasonEpisodes = season.episodes
        
        // Show episodes section
        episodesTitle.visibility = View.VISIBLE
        episodesRecyclerView.visibility = View.VISIBLE
        
        // Update episodes title
        episodesTitle.text = "Épisodes - Saison ${season.seasonNumber}"
        
        // Update episodes list
        val episodesAdapter = EpisodesAdapter(currentSeasonEpisodes) { episode ->
            onEpisodeSelected(episode)
        }
        episodesRecyclerView.adapter = episodesAdapter
        
        // Update seasons adapter to highlight selected
        val seasonsAdapter = SeasonsAdapter(seasons, selectedSeasonIndex) { s, p ->
            onSeasonSelected(s, p)
        }
        seasonsRecyclerView.adapter = seasonsAdapter
        
        android.util.Log.d(TAG, "Selected season ${season.seasonNumber} with ${currentSeasonEpisodes.size} episodes")
    }
    
    private fun onEpisodeSelected(episode: Episode) {
        // Play episode
        val intent = Intent(this, com.oxoplayer.tv.ui.player.PlayerActivity::class.java)
        intent.putExtra("STREAM_URL", episode.streamUrl)
        intent.putExtra("TITLE", "${series?.name} - ${episode.name}")
        intent.putExtra("TYPE", "SERIES")
        // Always use series cover for "Continue Watching" section consistency
        intent.putExtra("COVER", series?.cover)
        startActivity(intent)
        
        android.util.Log.d(TAG, "Playing episode: ${episode.name} with series cover: ${series?.cover}")
    }
    
    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
    }
    
    override fun onBackPressed() {
        super.onBackPressed()
        finish()
    }
}
