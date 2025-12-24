package com.oxoplayer.tv.ui.movies

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.DataManager
import com.oxoplayer.tv.data.models.Category
import com.oxoplayer.tv.data.models.Movie
import com.oxoplayer.tv.data.models.XtreamMovie
import com.oxoplayer.tv.data.models.XtreamMovieCategory
import com.oxoplayer.tv.data.repository.XtreamRepository
import com.oxoplayer.tv.ui.livetv.CategoriesAdapter
import com.oxoplayer.tv.ui.player.PlayerActivity
import kotlinx.coroutines.launch

/**
 * Movies Activity - Shows hierarchy:
 * Categories → Movies List
 * 
 * Uses Xtream API when available for proper category organization
 */
class MoviesActivity : AppCompatActivity() {
    
    private val TAG = "MoviesActivity"
    
    private lateinit var categoriesRecyclerView: RecyclerView
    private lateinit var moviesRecyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var categoryTitle: TextView
    private lateinit var searchEditText: EditText
    private lateinit var clearSearchButton: ImageView
    private lateinit var noResultsText: TextView
    
    private val xtreamRepository = XtreamRepository()
    
    // Xtream mode data
    private var xtreamCategories = listOf<XtreamMovieCategory>()
    private var currentXtreamMovies = listOf<XtreamMovie>()
    private var allXtreamMovies = mutableListOf<XtreamMovie>() // ALL movies for global search
    private var currentCategoryId: String? = null
    private var currentCategoryName: String = ""
    
    // Legacy M3U mode data
    private var allMovies = listOf<Movie>()
    private var legacyCategories = listOf<Category>()
    private var currentLegacyMovies = listOf<Movie>()
    
    private var isXtreamMode = false
    private var isSearchActive = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_movies)
        
        initViews()
        determineMode()
        setupRecyclerViews()
        loadCategories()
    }
    
    private fun initViews() {
        categoriesRecyclerView = findViewById(R.id.categoriesRecyclerView)
        moviesRecyclerView = findViewById(R.id.moviesRecyclerView)
        
        // Try to find progress bar and title (might not exist in all layouts)
        progressBar = findViewById(R.id.progressBar) ?: ProgressBar(this).also { it.visibility = View.GONE }
        categoryTitle = findViewById(R.id.categoryTitle) ?: TextView(this)
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
                filterMovies(query)
            }
        })
        
        clearSearchButton.setOnClickListener {
            searchEditText.text.clear()
        }
    }
    
    private fun filterMovies(query: String) {
        isSearchActive = query.isNotEmpty()
        
        if (isXtreamMode) {
            filterXtreamMovies(query)
        } else {
            filterLegacyMovies(query)
        }
    }
    
    private fun filterXtreamMovies(query: String) {
        val filteredMovies = if (query.isEmpty()) {
            // When search is cleared, show current category
            currentXtreamMovies
        } else {
            // Search across ALL movies from ALL categories
            allXtreamMovies.filter { 
                it.name.contains(query, ignoreCase = true) 
            }
        }
        
        noResultsText.visibility = if (filteredMovies.isEmpty() && query.isNotEmpty()) View.VISIBLE else View.GONE
        
        val adapter = XtreamMovieAdapter(filteredMovies) { movie ->
            onXtreamMovieSelected(movie)
        }
        moviesRecyclerView.adapter = adapter
    }
    
    private fun filterLegacyMovies(query: String) {
        val filteredMovies = if (query.isEmpty()) {
            // When search is cleared, show current category
            currentLegacyMovies
        } else {
            // Search across ALL movies from ALL categories
            allMovies.filter { 
                it.name.contains(query, ignoreCase = true) 
            }
        }
        
        noResultsText.visibility = if (filteredMovies.isEmpty() && query.isNotEmpty()) View.VISIBLE else View.GONE
        
        val moviesAdapter = MoviesAdapter(filteredMovies) { movie ->
            playLegacyMovie(movie)
        }
        moviesRecyclerView.adapter = moviesAdapter
    }
    
    private fun determineMode() {
        isXtreamMode = DataManager.shouldUseXtreamForMovies()
        android.util.Log.d(TAG, "Movies mode: ${if (isXtreamMode) "Xtream API" else "Legacy M3U"}")
    }
    
    private fun setupRecyclerViews() {
        // Categories (Left sidebar)
        categoriesRecyclerView.layoutManager = LinearLayoutManager(this)
        
        // Movies Grid (Main content)
        moviesRecyclerView.layoutManager = GridLayoutManager(this, 5)
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
        if (DataManager.xtreamMovieCategories.isNotEmpty()) {
            xtreamCategories = DataManager.xtreamMovieCategories
            displayXtreamCategories()
            
            // Load all movies for global search
            loadAllXtreamMoviesForSearch()
            
            // Auto-select first category
            if (xtreamCategories.isNotEmpty()) {
                onXtreamCategorySelected(xtreamCategories[0], 0)
            }
            return
        }
        
        // Load from API
        lifecycleScope.launch {
            val result = xtreamRepository.getMovieCategories()
            
            result.onSuccess { categories ->
                xtreamCategories = categories
                DataManager.initXtreamMovieCategories(categories)
                
                displayXtreamCategories()
                
                // Load all movies for global search
                loadAllXtreamMoviesForSearch()
                
                // Auto-select first category
                if (categories.isNotEmpty()) {
                    onXtreamCategorySelected(categories[0], 0)
                } else {
                    showLoading(false)
                }
            }
            
            result.onFailure { error ->
                showLoading(false)
                android.util.Log.e(TAG, "Error loading movie categories", error)
                Toast.makeText(this@MoviesActivity, "Erreur: ${error.message}", Toast.LENGTH_SHORT).show()
                
                // Fallback to legacy mode
                isXtreamMode = false
                loadLegacyCategories()
            }
        }
    }
    
    private fun loadAllXtreamMoviesForSearch() {
        // Load all movies from all categories for global search
        lifecycleScope.launch {
            allXtreamMovies.clear()
            
            for (category in xtreamCategories) {
                // Check cache first
                val cached = DataManager.getCachedMoviesForCategory(category.categoryId)
                if (cached != null) {
                    allXtreamMovies.addAll(cached)
                } else {
                    // Load from API
                    val result = xtreamRepository.getMoviesByCategory(category.categoryId)
                    result.onSuccess { movies ->
                        DataManager.cacheMoviesForCategory(category.categoryId, movies)
                        allXtreamMovies.addAll(movies)
                    }
                }
            }
            
            android.util.Log.d(TAG, "Loaded ${allXtreamMovies.size} total movies for global search")
        }
    }
    
    private fun displayXtreamCategories() {
        val adapter = XtreamMovieCategoryAdapter(xtreamCategories) { category, position ->
            onXtreamCategorySelected(category, position)
        }
        categoriesRecyclerView.adapter = adapter
    }
    
    private fun onXtreamCategorySelected(category: XtreamMovieCategory, position: Int) {
        currentCategoryId = category.categoryId
        currentCategoryName = category.categoryName
        categoryTitle.text = "${category.categoryName}"
        
        // Update category selection
        (categoriesRecyclerView.adapter as? XtreamMovieCategoryAdapter)?.setSelectedPosition(position)
        
        // Check cache first
        val cached = DataManager.getCachedMoviesForCategory(category.categoryId)
        if (cached != null) {
            currentXtreamMovies = cached
            displayXtreamMovies()
            return
        }
        
        // Load from API
        loadXtreamMoviesForCategory(category.categoryId)
    }
    
    private fun loadXtreamMoviesForCategory(categoryId: String) {
        showLoading(true)
        
        lifecycleScope.launch {
            val result = xtreamRepository.getMoviesByCategory(categoryId)
            
            result.onSuccess { moviesList ->
                currentXtreamMovies = moviesList
                DataManager.cacheMoviesForCategory(categoryId, moviesList)
                displayXtreamMovies()
            }
            
            result.onFailure { error ->
                showLoading(false)
                android.util.Log.e(TAG, "Error loading movies for category $categoryId", error)
                Toast.makeText(this@MoviesActivity, "Erreur: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun displayXtreamMovies() {
        showLoading(false)
        
        val adapter = XtreamMovieAdapter(currentXtreamMovies) { movie ->
            onXtreamMovieSelected(movie)
        }
        moviesRecyclerView.adapter = adapter
        
        android.util.Log.d(TAG, "Displaying ${currentXtreamMovies.size} movies for $currentCategoryName")
    }
    
    private fun onXtreamMovieSelected(movie: XtreamMovie) {
        // Navigate to movie detail page
        val intent = Intent(this, MovieDetailActivity::class.java)
        intent.putExtra("STREAM_ID", movie.streamId)
        intent.putExtra("MOVIE_NAME", movie.name)
        intent.putExtra("MOVIE_COVER", movie.streamIcon)
        intent.putExtra("CONTAINER_EXTENSION", movie.containerExtension)
        startActivity(intent)
    }
    
    // ==================== Legacy M3U Mode ====================
    
    private fun loadLegacyCategories() {
        allMovies = DataManager.movies
        
        val categoriesMap = allMovies.groupBy { it.category }
        legacyCategories = categoriesMap.keys.map { categoryName ->
            Category(categoryName, categoryName, com.oxoplayer.tv.data.models.ContentType.MOVIES)
        }
        
        if (legacyCategories.isNotEmpty()) {
            currentLegacyMovies = categoriesMap[legacyCategories[0].name] ?: emptyList()
            currentCategoryName = legacyCategories[0].name
        }
        
        displayLegacyCategories()
        showLoading(false)
        
        android.util.Log.d(TAG, "Legacy mode: ${allMovies.size} movies in ${legacyCategories.size} categories")
    }
    
    private fun displayLegacyCategories() {
        val categoriesAdapter = CategoriesAdapter(legacyCategories) { category ->
            onLegacyCategorySelected(category)
        }
        categoriesRecyclerView.adapter = categoriesAdapter
        
        // Display first category movies
        if (currentLegacyMovies.isNotEmpty()) {
            displayLegacyMovies()
        }
    }
    
    private fun onLegacyCategorySelected(category: Category) {
        currentLegacyMovies = allMovies.filter { it.category == category.name }
        currentCategoryName = category.name
        categoryTitle.text = category.name
        displayLegacyMovies()
    }
    
    private fun displayLegacyMovies() {
        val moviesAdapter = MoviesAdapter(currentLegacyMovies) { movie ->
            playLegacyMovie(movie)
        }
        moviesRecyclerView.adapter = moviesAdapter
    }
    
    private fun playLegacyMovie(movie: Movie) {
        val intent = Intent(this, PlayerActivity::class.java)
        intent.putExtra("STREAM_URL", movie.streamUrl)
        intent.putExtra("TITLE", movie.name)
        intent.putExtra("TYPE", "MOVIE")
        intent.putExtra("COVER", movie.cover) // Pass cover image
        startActivity(intent)
    }
    
    // ==================== Utils ====================
    
    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
    }
}
