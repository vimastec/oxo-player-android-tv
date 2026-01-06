package com.oxoplayer.tv.ui.series

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
import com.oxoplayer.tv.data.models.SeriesCategory
import com.oxoplayer.tv.data.models.SeriesInfo
import com.oxoplayer.tv.data.models.XtreamSeries
import com.oxoplayer.tv.data.models.XtreamSeriesCategory
import com.oxoplayer.tv.data.repository.XtreamRepository
import kotlinx.coroutines.launch

/**
 * Series Activity - Shows hierarchy:
 * Categories → Series List → (SeriesDetailActivity) → Seasons → Episodes
 * 
 * Uses Xtream API when available for proper category organization
 */
class SeriesActivity : AppCompatActivity() {
    
    private val TAG = "SeriesActivity"
    
    private lateinit var categoriesRecyclerView: RecyclerView
    private lateinit var seriesRecyclerView: RecyclerView
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
    private var xtreamCategories = listOf<XtreamSeriesCategory>()
    private var currentXtreamSeries = listOf<XtreamSeries>()
    private var allXtreamSeries = mutableListOf<XtreamSeries>() // ALL series for global search
    private var currentCategoryId: String? = null
    private var currentCategoryName: String = ""
    
    // Legacy M3U mode data
    private var legacySeriesCategories = listOf<SeriesCategory>()
    private var currentLegacySeriesList = listOf<SeriesInfo>()
    private var allLegacySeries = mutableListOf<SeriesInfo>() // ALL legacy series for global search
    
    private var isXtreamMode = false
    private var isSearchActive = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_series)
        
        initViews()
        determineMode()
        setupRecyclerViews()
        loadCategories()
    }
    
    private fun initViews() {
        categoriesRecyclerView = findViewById(R.id.categoriesRecyclerView)
        seriesRecyclerView = findViewById(R.id.seriesRecyclerView)
        
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
                filterSeries(query)
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
                filterSeries(searchEditText.text.toString().trim())
            }
            
            override fun onNothingSelected(parent: AdapterView<*>?) {
                selectedYear = null
            }
        }
    }
    
    private fun updateYearFilter(series: List<XtreamSeries>) {
        // Extract years from series (from releaseDate or title)
        val years = series.mapNotNull { s ->
            // Try releaseDate first, then extract from title
            s.releaseDate?.take(4) 
                ?: s.releaseDateAlt?.take(4)
                ?: extractYearFromTitle(s.name)
        }.distinct().sortedDescending()
        
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
    
    private fun getSeriesYear(series: XtreamSeries): String? {
        return series.releaseDate?.take(4) 
            ?: series.releaseDateAlt?.take(4)
            ?: extractYearFromTitle(series.name)
    }
    
    private fun filterSeries(query: String) {
        isSearchActive = query.isNotEmpty()
        
        if (isXtreamMode) {
            filterXtreamSeries(query)
        } else {
            filterLegacySeries(query)
        }
    }
    
    private fun filterXtreamSeries(query: String) {
        var filteredSeries = if (query.isEmpty()) {
            // When search is cleared, show current category
            currentXtreamSeries
        } else {
            // Search across ALL series from ALL categories
            allXtreamSeries.filter { 
                it.name.contains(query, ignoreCase = true) 
            }
        }
        
        // Apply year filter
        if (selectedYear != null) {
            filteredSeries = filteredSeries.filter { series ->
                val seriesYear = getSeriesYear(series)
                seriesYear == selectedYear
            }
        }
        
        noResultsText.visibility = if (filteredSeries.isEmpty() && (query.isNotEmpty() || selectedYear != null)) View.VISIBLE else View.GONE
        
        val adapter = XtreamSeriesAdapter(filteredSeries) { series ->
            onXtreamSeriesSelected(series)
        }
        seriesRecyclerView.adapter = adapter
    }
    
    private fun filterLegacySeries(query: String) {
        val filteredSeries = if (query.isEmpty()) {
            // When search is cleared, show current category
            currentLegacySeriesList
        } else {
            // Search across ALL series from ALL categories
            allLegacySeries.filter { 
                it.name.contains(query, ignoreCase = true) 
            }
        }
        
        noResultsText.visibility = if (filteredSeries.isEmpty() && query.isNotEmpty()) View.VISIBLE else View.GONE
        
        val seriesInfoAdapter = SeriesInfoAdapter(filteredSeries) { seriesInfo ->
            onLegacySeriesSelected(seriesInfo)
        }
        seriesRecyclerView.adapter = seriesInfoAdapter
    }
    
    private fun determineMode() {
        isXtreamMode = DataManager.shouldUseXtreamForSeries()
        android.util.Log.d(TAG, "Series mode: ${if (isXtreamMode) "Xtream API" else "Legacy M3U"}")
    }
    
    private fun setupRecyclerViews() {
        // Categories (Left sidebar)
        categoriesRecyclerView.layoutManager = LinearLayoutManager(this)
        
        // Series Grid (Main content)
        seriesRecyclerView.layoutManager = GridLayoutManager(this, 6)
        
        // Allow items to scale outside their bounds (Netflix-style focus animation)
        seriesRecyclerView.clipChildren = false
        seriesRecyclerView.clipToPadding = false
        (seriesRecyclerView.parent as? android.view.ViewGroup)?.let {
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
        if (DataManager.xtreamSeriesCategories.isNotEmpty()) {
            xtreamCategories = DataManager.xtreamSeriesCategories
            displayXtreamCategories()
            
            // Load all series for global search
            loadAllXtreamSeriesForSearch()
            
            // Auto-select first category
            if (xtreamCategories.isNotEmpty()) {
                onXtreamCategorySelected(xtreamCategories[0], 0)
            }
            return
        }
        
        // Load from API
        lifecycleScope.launch {
            val result = xtreamRepository.getSeriesCategories()
            
            result.onSuccess { categories ->
                xtreamCategories = categories
                DataManager.initXtreamSeriesCategories(categories)
                
                displayXtreamCategories()
                
                // Load all series for global search
                loadAllXtreamSeriesForSearch()
                
                // Auto-select first category
                if (categories.isNotEmpty()) {
                    onXtreamCategorySelected(categories[0], 0)
                } else {
                    showLoading(false)
                }
            }
            
            result.onFailure { error ->
                showLoading(false)
                android.util.Log.e(TAG, "Error loading categories", error)
                Toast.makeText(this@SeriesActivity, "Erreur: ${error.message}", Toast.LENGTH_SHORT).show()
                
                // Fallback to legacy mode
                isXtreamMode = false
                loadLegacyCategories()
            }
        }
    }
    
    private fun loadAllXtreamSeriesForSearch() {
        // Load all series from all categories for global search
        lifecycleScope.launch {
            allXtreamSeries.clear()
            
            for (category in xtreamCategories) {
                // Check cache first
                val cached = DataManager.getCachedSeriesForCategory(category.categoryId)
                if (cached != null) {
                    allXtreamSeries.addAll(cached)
                } else {
                    // Load from API
                    val result = xtreamRepository.getSeriesByCategory(category.categoryId)
                    result.onSuccess { series ->
                        DataManager.cacheSeriesForCategory(category.categoryId, series)
                        allXtreamSeries.addAll(series)
                    }
                }
            }
            
            // Update year filter with all available years
            updateYearFilter(allXtreamSeries)
            
            android.util.Log.d(TAG, "Loaded ${allXtreamSeries.size} total series for global search")
        }
    }
    
    private fun displayXtreamCategories() {
        val adapter = XtreamCategoryAdapter(xtreamCategories) { category, position ->
            onXtreamCategorySelected(category, position)
        }
        categoriesRecyclerView.adapter = adapter
    }
    
    private fun onXtreamCategorySelected(category: XtreamSeriesCategory, position: Int) {
        currentCategoryId = category.categoryId
        currentCategoryName = category.categoryName
        categoryTitle.text = "${category.categoryName}"
        
        // Update category selection
        (categoriesRecyclerView.adapter as? XtreamCategoryAdapter)?.setSelectedPosition(position)
        
        // Check cache first
        val cached = DataManager.getCachedSeriesForCategory(category.categoryId)
        if (cached != null) {
            currentXtreamSeries = cached
            displayXtreamSeries()
            return
        }
        
        // Load from API
        loadXtreamSeriesForCategory(category.categoryId)
    }
    
    private fun loadXtreamSeriesForCategory(categoryId: String) {
        showLoading(true)
        
        lifecycleScope.launch {
            val result = xtreamRepository.getSeriesByCategory(categoryId)
            
            result.onSuccess { seriesList ->
                currentXtreamSeries = seriesList
                DataManager.cacheSeriesForCategory(categoryId, seriesList)
                displayXtreamSeries()
            }
            
            result.onFailure { error ->
                showLoading(false)
                android.util.Log.e(TAG, "Error loading series for category $categoryId", error)
                Toast.makeText(this@SeriesActivity, "Erreur: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
    
    private fun displayXtreamSeries() {
        showLoading(false)
        
        // Update year filter with current category series
        updateYearFilterFromCurrentSeries()
        
        val adapter = XtreamSeriesAdapter(currentXtreamSeries) { series ->
            onXtreamSeriesSelected(series)
        }
        seriesRecyclerView.adapter = adapter
        
        android.util.Log.d(TAG, "Displaying ${currentXtreamSeries.size} series for $currentCategoryName")
    }
    
    private fun updateYearFilterFromCurrentSeries() {
        // Extract years from current category series
        val years = currentXtreamSeries.mapNotNull { getSeriesYear(it) }
            .distinct()
            .sortedDescending()
        
        if (years.isEmpty()) return
        
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
    
    private fun onXtreamSeriesSelected(series: XtreamSeries) {
        val intent = Intent(this, SeriesDetailActivity::class.java)
        intent.putExtra("SERIES_ID", series.seriesId)
        intent.putExtra("SERIES_NAME", series.name)
        intent.putExtra("SERIES_COVER", series.cover)
        intent.putExtra("CATEGORY_NAME", currentCategoryName)
        intent.putExtra("IS_XTREAM", true)
        startActivity(intent)
    }
    
    // ==================== Legacy M3U Mode ====================
    
    private fun loadLegacyCategories() {
        legacySeriesCategories = DataManager.seriesCategories
        
        // Build all series list for global search
        allLegacySeries.clear()
        for (category in legacySeriesCategories) {
            allLegacySeries.addAll(category.seriesList)
        }
        
        if (legacySeriesCategories.isNotEmpty()) {
            currentLegacySeriesList = legacySeriesCategories[0].seriesList
        }
        
        displayLegacyCategories()
        showLoading(false)
        
        android.util.Log.d(TAG, "Legacy mode: ${legacySeriesCategories.size} categories, ${allLegacySeries.size} total series")
    }
    
    private fun displayLegacyCategories() {
        val categoriesAdapter = SeriesCategoryAdapter(legacySeriesCategories) { category ->
            onLegacyCategorySelected(category)
        }
        categoriesRecyclerView.adapter = categoriesAdapter
        
        // Display first category series
        if (currentLegacySeriesList.isNotEmpty()) {
            displayLegacySeries()
        }
    }
    
    private fun onLegacyCategorySelected(category: SeriesCategory) {
        currentLegacySeriesList = category.seriesList
        currentCategoryName = category.name
        categoryTitle.text = category.name
        displayLegacySeries()
    }
    
    private fun displayLegacySeries() {
        val seriesInfoAdapter = SeriesInfoAdapter(currentLegacySeriesList) { seriesInfo ->
            onLegacySeriesSelected(seriesInfo)
        }
        seriesRecyclerView.adapter = seriesInfoAdapter
    }
    
    private fun onLegacySeriesSelected(seriesInfo: SeriesInfo) {
        val intent = Intent(this, SeriesDetailActivity::class.java)
        intent.putExtra("SERIES_ID", seriesInfo.id)
        intent.putExtra("SERIES_NAME", seriesInfo.name)
        intent.putExtra("IS_XTREAM", false)
        startActivity(intent)
    }
    
    // ==================== Utils ====================
    
    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
    }
}
