package com.oxoplayer.tv.ui.movies

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.Spinner
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
    private lateinit var yearFilterSpinner: Spinner
    
    private val xtreamRepository = XtreamRepository()
    
    // Year filter
    private var selectedYear: String? = null
    private var availableYears = mutableListOf<String>()
    
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
        yearFilterSpinner = findViewById(R.id.yearFilterSpinner)
        
        setupSearch()
        setupYearFilter()
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
    
    private fun setupYearFilter() {
        // Initialize with default value
        availableYears.add("📅 Toutes les années")
        val initialAdapter = ArrayAdapter(
            this,
            R.layout.spinner_year_item,
            availableYears
        )
        initialAdapter.setDropDownViewResource(R.layout.spinner_year_dropdown)
        yearFilterSpinner.adapter = initialAdapter
        
        yearFilterSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                val selected = availableYears.getOrNull(position)
                selectedYear = if (selected?.contains("Toutes") == true) null else selected
                filterMovies(searchEditText.text.toString().trim())
            }
            
            override fun onNothingSelected(parent: AdapterView<*>?) {
                selectedYear = null
            }
        }
    }
    
    private fun updateYearFilter(movies: List<XtreamMovie>) {
        // Extract years from movie titles
        val years = movies.mapNotNull { extractYearFromTitle(it.name) }
            .distinct()
            .sortedDescending()
        
        availableYears.clear()
        availableYears.add("📅 Toutes les années")
        availableYears.addAll(years)
        
        runOnUiThread {
            val adapter = ArrayAdapter(
                this,
                R.layout.spinner_year_item,
                availableYears
            )
            adapter.setDropDownViewResource(R.layout.spinner_year_dropdown)
            yearFilterSpinner.adapter = adapter
            
            android.util.Log.d(TAG, "Year filter updated with ${years.size} years")
        }
    }
    
    private fun extractYearFromTitle(title: String): String? {
        // Try multiple year patterns:
        // 1. "(2024)" - standard format
        // 2. "2024" at end of title
        // 3. "[2024]" - bracket format
        // 4. "- 2024" - dash format
        
        // Pattern 1: (YYYY)
        val pattern1 = Regex("\\((19|20)\\d{2}\\)")
        pattern1.find(title)?.let {
            return it.value.replace("(", "").replace(")", "")
        }
        
        // Pattern 2: [YYYY]
        val pattern2 = Regex("\\[(19|20)\\d{2}\\]")
        pattern2.find(title)?.let {
            return it.value.replace("[", "").replace("]", "")
        }
        
        // Pattern 3: YYYY at the end (with space before)
        val pattern3 = Regex("\\s(19|20)\\d{2}$")
        pattern3.find(title)?.let {
            return it.value.trim()
        }
        
        // Pattern 4: - YYYY or . YYYY
        val pattern4 = Regex("[-.\\s](19|20)\\d{2}(?:[^0-9]|$)")
        pattern4.find(title)?.let {
            val year = Regex("(19|20)\\d{2}").find(it.value)
            return year?.value
        }
        
        return null
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
        var filteredMovies = if (query.isEmpty()) {
            // When search is cleared, show current category
            currentXtreamMovies
        } else {
            // Search across ALL movies from ALL categories
            allXtreamMovies.filter { 
                it.name.contains(query, ignoreCase = true) 
            }
        }
        
        // Apply year filter
        if (selectedYear != null) {
            filteredMovies = filteredMovies.filter { movie ->
                val movieYear = extractYearFromTitle(movie.name)
                movieYear == selectedYear
            }
        }
        
        noResultsText.visibility = if (filteredMovies.isEmpty() && (query.isNotEmpty() || selectedYear != null)) View.VISIBLE else View.GONE
        
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
        moviesRecyclerView.layoutManager = GridLayoutManager(this, 6)
        
        // Allow items to scale outside their bounds (Netflix-style focus animation)
        moviesRecyclerView.clipChildren = false
        moviesRecyclerView.clipToPadding = false
        (moviesRecyclerView.parent as? android.view.ViewGroup)?.let {
            it.clipChildren = false
            it.clipToPadding = false
        }
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
            
            // Update year filter with all available years
            updateYearFilter(allXtreamMovies)
            
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
        
        // Update year filter with current category movies
        updateYearFilterFromCurrentMovies()
        
        val adapter = XtreamMovieAdapter(currentXtreamMovies) { movie ->
            onXtreamMovieSelected(movie)
        }
        moviesRecyclerView.adapter = adapter
        
        android.util.Log.d(TAG, "Displaying ${currentXtreamMovies.size} movies for $currentCategoryName")
    }
    
    private fun updateYearFilterFromCurrentMovies() {
        // Debug: show first 3 movie titles
        android.util.Log.d(TAG, "Sample movies: ${currentXtreamMovies.take(3).map { it.name }}")
        
        // Extract years from current category movies
        val years = currentXtreamMovies.mapNotNull { extractYearFromTitle(it.name) }
            .distinct()
            .sortedDescending()
        
        android.util.Log.d(TAG, "Extracted ${years.size} unique years from ${currentXtreamMovies.size} movies")
        
        if (years.isEmpty()) {
            android.util.Log.d(TAG, "No years found in movie titles!")
            return
        }
        
        availableYears.clear()
        availableYears.add("📅 Toutes les années")
        availableYears.addAll(years)
        
        val adapter = ArrayAdapter(
            this,
            R.layout.spinner_year_item,
            availableYears
        )
        adapter.setDropDownViewResource(R.layout.spinner_year_dropdown)
        yearFilterSpinner.adapter = adapter
        
        android.util.Log.d(TAG, "Year filter updated with ${years.size} years: ${years.take(5)}")
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
