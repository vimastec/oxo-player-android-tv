package com.oxoplayer.tv.data

import com.oxoplayer.tv.data.models.*

/**
 * Singleton pour stocker et partager les données entre les activités
 */
object DataManager {
    
    // ==================== Live TV & Movies (from M3U) ====================
    var channels = listOf<Channel>()
    var movies = listOf<Movie>()
    var liveCategories = listOf<Category>()
    var movieCategories = listOf<Category>()
    
    // ==================== Series (from M3U - legacy) ====================
    var series = listOf<Series>()
    var seriesCategories = listOf<SeriesCategory>()
    
    // ==================== Xtream Series (from API) ====================
    private var _xtreamCredentials: XtreamCredentials? = null
    private var _xtreamSeriesCategories = listOf<XtreamSeriesCategory>()
    var isXtreamEnabled = false
    
    // Cache for loaded series by category
    private val seriesByCategoryCache = mutableMapOf<String, List<XtreamSeries>>()
    
    // Cache for full series info
    private val seriesInfoCache = mutableMapOf<Int, Series>()
    
    // ==================== Xtream Movies/VOD (from API) ====================
    private var _xtreamMovieCategories = listOf<XtreamMovieCategory>()
    
    // Cache for loaded movies by category
    private val moviesByCategoryCache = mutableMapOf<String, List<XtreamMovie>>()
    
    // Cache for full movie info
    private val movieInfoCache = mutableMapOf<Int, XtreamMovieInfo>()
    
    // ==================== Xtream Live TV (from API) ====================
    private var _xtreamLiveCategories = listOf<XtreamLiveCategory>()
    
    // Cache for loaded live streams by category
    private val liveStreamsByCategoryCache = mutableMapOf<String, List<XtreamLiveStream>>()
    
    // All live streams cache (for home page)
    private var _allXtreamLiveStreams = listOf<XtreamLiveStream>()
    
    var isDataLoaded = false
    
    /**
     * Set data from M3U parsing (Live TV, Movies, and fallback Series)
     */
    fun setData(
        channels: List<Channel>,
        movies: List<Movie>,
        series: List<Series>,
        liveCategories: List<Category>,
        movieCategories: List<Category>,
        seriesCategories: List<SeriesCategory>
    ) {
        this.channels = channels
        this.movies = movies
        this.series = series
        this.liveCategories = liveCategories
        this.movieCategories = movieCategories
        this.seriesCategories = seriesCategories
        isDataLoaded = true
        
        android.util.Log.d("DataManager", "M3U Data loaded: ${channels.size} channels, ${movies.size} movies, ${series.size} series")
    }
    
    /**
     * Get Xtream credentials
     */
    val xtreamCredentials: XtreamCredentials?
        get() = _xtreamCredentials
    
    /**
     * Get Xtream series categories
     */
    val xtreamSeriesCategories: List<XtreamSeriesCategory>
        get() = _xtreamSeriesCategories
    
    /**
     * Set Xtream credentials and enable Xtream mode for series
     */
    fun initXtreamCredentials(credentials: XtreamCredentials) {
        this._xtreamCredentials = credentials
        this.isXtreamEnabled = true
        android.util.Log.d("DataManager", "Xtream enabled - Host: ${credentials.host}")
    }
    
    /**
     * Set Xtream series categories
     */
    fun initXtreamSeriesCategories(categories: List<XtreamSeriesCategory>) {
        this._xtreamSeriesCategories = categories
        android.util.Log.d("DataManager", "Xtream categories loaded: ${categories.size}")
    }
    
    /**
     * Cache series list for a category
     */
    fun cacheSeriesForCategory(categoryId: String, seriesList: List<XtreamSeries>) {
        seriesByCategoryCache[categoryId] = seriesList
    }
    
    /**
     * Get cached series for a category
     */
    fun getCachedSeriesForCategory(categoryId: String): List<XtreamSeries>? {
        return seriesByCategoryCache[categoryId]
    }
    
    /**
     * Cache full series info
     */
    fun cacheSeriesInfo(seriesId: Int, series: Series) {
        seriesInfoCache[seriesId] = series
    }
    
    /**
     * Get cached series info
     */
    fun getCachedSeriesInfo(seriesId: Int): Series? {
        return seriesInfoCache[seriesId]
    }
    
    /**
     * Check if series should use Xtream API
     */
    fun shouldUseXtreamForSeries(): Boolean {
        return isXtreamEnabled && xtreamCredentials != null
    }
    
    /**
     * Clear all data
     */
    fun clear() {
        channels = emptyList()
        movies = emptyList()
        series = emptyList()
        liveCategories = emptyList()
        movieCategories = emptyList()
        seriesCategories = emptyList()
        
        _xtreamCredentials = null
        _xtreamSeriesCategories = emptyList()
        _xtreamMovieCategories = emptyList()
        _xtreamLiveCategories = emptyList()
        _allXtreamLiveStreams = emptyList()
        isXtreamEnabled = false
        seriesByCategoryCache.clear()
        seriesInfoCache.clear()
        moviesByCategoryCache.clear()
        movieInfoCache.clear()
        liveStreamsByCategoryCache.clear()
        
        isDataLoaded = false
    }
    
    /**
     * Clear only series cache (useful for refresh)
     */
    fun clearSeriesCache() {
        seriesByCategoryCache.clear()
        seriesInfoCache.clear()
    }
    
    // ==================== Xtream Movies Methods ====================
    
    /**
     * Get Xtream movie categories
     */
    val xtreamMovieCategories: List<XtreamMovieCategory>
        get() = _xtreamMovieCategories
    
    /**
     * Set Xtream movie categories
     */
    fun initXtreamMovieCategories(categories: List<XtreamMovieCategory>) {
        this._xtreamMovieCategories = categories
        android.util.Log.d("DataManager", "Xtream movie categories loaded: ${categories.size}")
    }
    
    /**
     * Cache movies list for a category
     */
    fun cacheMoviesForCategory(categoryId: String, moviesList: List<XtreamMovie>) {
        moviesByCategoryCache[categoryId] = moviesList
    }
    
    /**
     * Get cached movies for a category
     */
    fun getCachedMoviesForCategory(categoryId: String): List<XtreamMovie>? {
        return moviesByCategoryCache[categoryId]
    }
    
    /**
     * Cache full movie info
     */
    fun cacheMovieInfo(movieId: Int, movieInfo: XtreamMovieInfo) {
        movieInfoCache[movieId] = movieInfo
    }
    
    /**
     * Get cached movie info
     */
    fun getCachedMovieInfo(movieId: Int): XtreamMovieInfo? {
        return movieInfoCache[movieId]
    }
    
    /**
     * Check if movies should use Xtream API
     */
    fun shouldUseXtreamForMovies(): Boolean {
        return isXtreamEnabled && xtreamCredentials != null
    }
    
    /**
     * Clear only movies cache (useful for refresh)
     */
    fun clearMoviesCache() {
        moviesByCategoryCache.clear()
        movieInfoCache.clear()
        _xtreamMovieCategories = emptyList()
    }
    
    // ==================== Xtream Live TV Methods ====================
    
    /**
     * Get Xtream live TV categories
     */
    val xtreamLiveCategories: List<XtreamLiveCategory>
        get() = _xtreamLiveCategories
    
    /**
     * Set Xtream live TV categories
     */
    fun initXtreamLiveCategories(categories: List<XtreamLiveCategory>) {
        this._xtreamLiveCategories = categories
        android.util.Log.d("DataManager", "Xtream live categories loaded: ${categories.size}")
    }
    
    /**
     * Cache live streams list for a category
     */
    fun cacheLiveStreamsForCategory(categoryId: String, streams: List<XtreamLiveStream>) {
        liveStreamsByCategoryCache[categoryId] = streams
    }
    
    /**
     * Get cached live streams for a category
     */
    fun getCachedLiveStreamsForCategory(categoryId: String): List<XtreamLiveStream>? {
        return liveStreamsByCategoryCache[categoryId]
    }
    
    /**
     * Set all Xtream live streams (for home page)
     */
    fun setAllXtreamLiveStreams(streams: List<XtreamLiveStream>) {
        _allXtreamLiveStreams = streams
        android.util.Log.d("DataManager", "All Xtream live streams cached: ${streams.size}")
    }
    
    /**
     * Get all cached Xtream live streams
     */
    val allXtreamLiveStreams: List<XtreamLiveStream>
        get() = _allXtreamLiveStreams
    
    /**
     * Check if Live TV should use Xtream API
     */
    fun shouldUseXtreamForLiveTV(): Boolean {
        return isXtreamEnabled && xtreamCredentials != null
    }
    
    /**
     * Clear only live TV cache (useful for refresh)
     */
    fun clearLiveTVCache() {
        liveStreamsByCategoryCache.clear()
        _xtreamLiveCategories = emptyList()
        _allXtreamLiveStreams = emptyList()
    }
}




