package com.oxoplayer.tv.ui.movies

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.XtreamMovieInfo
import com.oxoplayer.tv.data.repository.XtreamRepository
import com.oxoplayer.tv.ui.player.PlayerActivity
import com.oxoplayer.tv.data.MyListManager
import kotlinx.coroutines.launch

/**
 * Movie Detail Activity
 * Shows full movie information from Xtream API before playing
 */
class MovieDetailActivity : AppCompatActivity() {
    
    private val TAG = "MovieDetailActivity"
    
    // UI Elements
    private lateinit var backgroundImage: ImageView
    private lateinit var posterImage: ImageView
    private lateinit var movieTitle: TextView
    private lateinit var movieYear: TextView
    private lateinit var movieDuration: TextView
    private lateinit var movieRating: TextView
    private lateinit var movieGenre: TextView
    private lateinit var moviePlot: TextView
    private lateinit var movieDirector: TextView
    private lateinit var movieCast: TextView
    private lateinit var btnPlay: CardView
    private lateinit var btnBack: CardView
    private lateinit var btnMyList: CardView
    private lateinit var myListIcon: ImageView
    private lateinit var myListText: TextView
    private lateinit var loadingOverlay: FrameLayout
    
    // Containers
    private lateinit var ratingContainer: View
    private lateinit var directorContainer: View
    private lateinit var castContainer: View
    private lateinit var divider1: View
    private lateinit var divider2: View
    
    private val xtreamRepository = XtreamRepository()
    
    // Movie data
    private var streamId: Int = 0
    private var movieName: String = ""
    private var movieCover: String? = null
    private var containerExtension: String? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_movie_detail)
        
        // Get intent extras
        streamId = intent.getIntExtra("STREAM_ID", 0)
        movieName = intent.getStringExtra("MOVIE_NAME") ?: "Film"
        movieCover = intent.getStringExtra("MOVIE_COVER")
        containerExtension = intent.getStringExtra("CONTAINER_EXTENSION")
        
        initViews()
        setupButtons()
        loadMovieDetails()
    }
    
    private fun initViews() {
        backgroundImage = findViewById(R.id.backgroundImage)
        posterImage = findViewById(R.id.posterImage)
        movieTitle = findViewById(R.id.movieTitle)
        movieYear = findViewById(R.id.movieYear)
        movieDuration = findViewById(R.id.movieDuration)
        movieRating = findViewById(R.id.movieRating)
        movieGenre = findViewById(R.id.movieGenre)
        moviePlot = findViewById(R.id.moviePlot)
        movieDirector = findViewById(R.id.movieDirector)
        movieCast = findViewById(R.id.movieCast)
        btnPlay = findViewById(R.id.btnPlay)
        btnBack = findViewById(R.id.btnBack)
        btnMyList = findViewById(R.id.btnMyList)
        myListIcon = findViewById(R.id.myListIcon)
        myListText = findViewById(R.id.myListText)
        loadingOverlay = findViewById(R.id.loadingOverlay)
        
        ratingContainer = findViewById(R.id.ratingContainer)
        directorContainer = findViewById(R.id.directorContainer)
        castContainer = findViewById(R.id.castContainer)
        divider1 = findViewById(R.id.divider1)
        divider2 = findViewById(R.id.divider2)
        
        // Set initial title and poster
        movieTitle.text = movieName
        
        if (!movieCover.isNullOrEmpty()) {
            Glide.with(this)
                .load(movieCover)
                .placeholder(R.drawable.placeholder_poster)
                .error(R.drawable.placeholder_poster)
                .into(posterImage)
                
            Glide.with(this)
                .load(movieCover)
                .into(backgroundImage)
        }
    }
    
    private fun setupButtons() {
        btnPlay.setOnClickListener {
            playMovie()
        }
        
        btnBack.setOnClickListener {
            finish()
        }
        
        // My List button
        btnMyList.setOnClickListener {
            toggleMyList()
        }
        
        // Update My List button state
        updateMyListButton()
        
        // Focus handling for TV navigation
        btnPlay.requestFocus()
    }
    
    private fun toggleMyList() {
        val isNowInList = MyListManager.toggleMovie(
            streamId = streamId,
            title = movieName,
            cover = movieCover,
            containerExtension = containerExtension
        )
        
        updateMyListButton()
        
        val message = if (isNowInList) "Ajouté à Ma Liste" else "Retiré de Ma Liste"
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
    
    private fun updateMyListButton() {
        val isInList = MyListManager.isMovieInList(streamId)
        
        if (isInList) {
            myListIcon.setImageResource(R.drawable.ic_check)
            myListText.text = "Dans Ma Liste"
        } else {
            myListIcon.setImageResource(R.drawable.ic_add)
            myListText.text = "Ma Liste"
        }
    }
    
    private fun loadMovieDetails() {
        if (streamId == 0) {
            hideLoading()
            return
        }
        
        lifecycleScope.launch {
            val result = xtreamRepository.getMovieInfo(streamId)
            
            result.onSuccess { movieInfo ->
                displayMovieInfo(movieInfo)
                hideLoading()
            }
            
            result.onFailure { error ->
                android.util.Log.e(TAG, "Error loading movie info", error)
                hideLoading()
                // Still allow playing even if details failed to load
            }
        }
    }
    
    private fun displayMovieInfo(movieInfo: XtreamMovieInfo) {
        val info = movieInfo.info ?: return
        
        // Title
        movieTitle.text = info.name ?: movieName
        
        // Poster/Cover
        val coverUrl = info.coverBig ?: info.movieImage ?: movieCover
        if (!coverUrl.isNullOrEmpty()) {
            Glide.with(this)
                .load(coverUrl)
                .placeholder(R.drawable.placeholder_poster)
                .error(R.drawable.placeholder_poster)
                .into(posterImage)
                
            Glide.with(this)
                .load(coverUrl)
                .into(backgroundImage)
        }
        
        // Year/Release Date
        val releaseDate = info.releaseDate ?: info.releaseDateAlt
        if (!releaseDate.isNullOrEmpty()) {
            movieYear.text = releaseDate.take(4) // Get just the year
            movieYear.visibility = View.VISIBLE
            divider1.visibility = View.VISIBLE
        }
        
        // Duration
        val duration = info.duration
        if (!duration.isNullOrEmpty()) {
            movieDuration.text = formatDuration(duration)
            movieDuration.visibility = View.VISIBLE
            divider2.visibility = View.VISIBLE
        } else if (info.durationSecs != null && info.durationSecs > 0) {
            movieDuration.text = formatDurationSecs(info.durationSecs)
            movieDuration.visibility = View.VISIBLE
            divider2.visibility = View.VISIBLE
        }
        
        // Rating
        val rating = info.rating
        if (!rating.isNullOrEmpty() && rating != "0") {
            movieRating.text = rating
            ratingContainer.visibility = View.VISIBLE
        }
        
        // Genre
        val genre = info.genre
        if (!genre.isNullOrEmpty()) {
            movieGenre.text = genre
            movieGenre.visibility = View.VISIBLE
        }
        
        // Plot/Description
        val plot = info.plot ?: info.description
        if (!plot.isNullOrEmpty()) {
            moviePlot.text = plot
        } else {
            moviePlot.text = "Aucune description disponible."
        }
        
        // Director
        val director = info.director
        if (!director.isNullOrEmpty()) {
            movieDirector.text = director
            directorContainer.visibility = View.VISIBLE
        }
        
        // Cast/Actors
        val cast = info.cast ?: info.actors
        if (!cast.isNullOrEmpty()) {
            movieCast.text = cast
            castContainer.visibility = View.VISIBLE
        }
    }
    
    private fun formatDuration(duration: String): String {
        // Duration might be in format "01:30:00" or "90 min"
        return try {
            if (duration.contains(":")) {
                val parts = duration.split(":")
                if (parts.size >= 2) {
                    val hours = parts[0].toIntOrNull() ?: 0
                    val minutes = parts[1].toIntOrNull() ?: 0
                    if (hours > 0) "${hours}h ${minutes}min" else "${minutes}min"
                } else {
                    duration
                }
            } else {
                duration
            }
        } catch (e: Exception) {
            duration
        }
    }
    
    private fun formatDurationSecs(seconds: Int): String {
        val hours = seconds / 3600
        val minutes = (seconds % 3600) / 60
        return if (hours > 0) "${hours}h ${minutes}min" else "${minutes}min"
    }
    
    private fun hideLoading() {
        loadingOverlay.animate()
            .alpha(0f)
            .setDuration(300)
            .withEndAction {
                loadingOverlay.visibility = View.GONE
            }
            .start()
    }
    
    private fun playMovie() {
        val streamUrl = xtreamRepository.buildMovieStreamUrl(
            streamId,
            containerExtension ?: "mkv"
        )
        
        val intent = Intent(this, PlayerActivity::class.java)
        intent.putExtra("STREAM_URL", streamUrl)
        intent.putExtra("TITLE", movieTitle.text.toString())
        intent.putExtra("TYPE", "MOVIE")
        intent.putExtra("COVER", movieCover)
        startActivity(intent)
    }
}

