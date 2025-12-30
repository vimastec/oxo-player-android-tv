package com.oxoplayer.tv.data.api

import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * TMDB API Service for fetching movie trailers
 */
interface TmdbApiService {
    
    @GET("search/movie")
    suspend fun searchMovie(
        @Query("query") query: String,
        @Query("language") language: String = "fr-FR",
        @Query("page") page: Int = 1
    ): Response<TmdbSearchResponse>
    
    @GET("movie/{movie_id}/videos")
    suspend fun getMovieVideos(
        @Path("movie_id") movieId: Int,
        @Query("language") language: String = "fr-FR"
    ): Response<TmdbVideosResponse>
    
    @GET("trending/movie/week")
    suspend fun getTrendingMoviesWeek(
        @Query("language") language: String = "fr-FR",
        @Query("page") page: Int = 1
    ): Response<TmdbSearchResponse>
    
    @GET("trending/tv/week")
    suspend fun getTrendingSeriesWeek(
        @Query("language") language: String = "fr-FR",
        @Query("page") page: Int = 1
    ): Response<TmdbSeriesSearchResponse>
    
    @GET("movie/popular")
    suspend fun getPopularMovies(
        @Query("language") language: String = "fr-FR",
        @Query("page") page: Int = 1
    ): Response<TmdbSearchResponse>
    
    @GET("tv/popular")
    suspend fun getPopularSeries(
        @Query("language") language: String = "fr-FR",
        @Query("page") page: Int = 1
    ): Response<TmdbSeriesSearchResponse>
    
    @GET("movie/top_rated")
    suspend fun getTopRatedMovies(
        @Query("language") language: String = "fr-FR",
        @Query("page") page: Int = 1
    ): Response<TmdbSearchResponse>
    
    @GET("tv/top_rated")
    suspend fun getTopRatedSeries(
        @Query("language") language: String = "fr-FR",
        @Query("page") page: Int = 1
    ): Response<TmdbSeriesSearchResponse>
    
    // Discover movies from this year
    @GET("discover/movie")
    suspend fun discoverMoviesThisYear(
        @Query("language") language: String = "fr-FR",
        @Query("sort_by") sortBy: String = "popularity.desc",
        @Query("primary_release_year") year: Int,
        @Query("page") page: Int = 1
    ): Response<TmdbSearchResponse>
    
    // Discover series from this year
    @GET("discover/tv")
    suspend fun discoverSeriesThisYear(
        @Query("language") language: String = "fr-FR",
        @Query("sort_by") sortBy: String = "popularity.desc",
        @Query("first_air_date_year") year: Int,
        @Query("page") page: Int = 1
    ): Response<TmdbSeriesSearchResponse>
    
    @GET("search/tv")
    suspend fun searchSeries(
        @Query("query") query: String,
        @Query("language") language: String = "fr-FR",
        @Query("page") page: Int = 1
    ): Response<TmdbSeriesSearchResponse>
}

data class TmdbSeriesSearchResponse(
    val page: Int,
    val results: List<TmdbSeries>,
    val total_pages: Int,
    val total_results: Int
)

data class TmdbSeries(
    val id: Int,
    val name: String,
    val original_name: String?,
    val overview: String?,
    val poster_path: String?,
    val backdrop_path: String?,
    val first_air_date: String?,
    val vote_average: Double?
)

data class TmdbSearchResponse(
    val page: Int,
    val results: List<TmdbMovie>,
    val total_pages: Int,
    val total_results: Int
)

data class TmdbMovie(
    val id: Int,
    val title: String,
    val original_title: String?,
    val overview: String?,
    val poster_path: String?,
    val backdrop_path: String?,
    val release_date: String?,
    val vote_average: Double?
)

data class TmdbVideosResponse(
    val id: Int,
    val results: List<TmdbVideo>
)

data class TmdbVideo(
    val id: String,
    val key: String,           // YouTube video key
    val name: String,
    val site: String,          // "YouTube"
    val type: String,          // "Trailer", "Teaser", "Clip"
    val official: Boolean?,
    val published_at: String?
)

/**
 * TMDB API Client
 */
object TmdbClient {
    
    private const val BASE_URL = "https://api.themoviedb.org/3/"
    
    // API keys loaded from BuildConfig (set in local.properties, not in source control)
    private val API_KEY = com.oxoplayer.tv.BuildConfig.TMDB_API_KEY
    private val ACCESS_TOKEN = com.oxoplayer.tv.BuildConfig.TMDB_ACCESS_TOKEN
    
    private val okHttpClient = okhttp3.OkHttpClient.Builder()
        .addInterceptor { chain ->
            val original = chain.request()
            val url = original.url.newBuilder()
                .addQueryParameter("api_key", API_KEY)
                .build()
            val request = original.newBuilder()
                .url(url)
                .header("Authorization", "Bearer $ACCESS_TOKEN")
                .build()
            chain.proceed(request)
        }
        .build()
    
    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
    
    val service: TmdbApiService = retrofit.create(TmdbApiService::class.java)
    
    /**
     * Get YouTube trailer URL for a movie by name
     * @param movieName The name of the movie to search
     * @return YouTube embed URL or null if not found
     */
    suspend fun getTrailerUrl(movieName: String): String? {
        try {
            // Clean movie name (remove year in parentheses)
            val cleanName = movieName.replace(Regex("\\s*\\(\\d{4}\\)\\s*$"), "").trim()
            
            android.util.Log.d("TmdbClient", "Searching TMDB for: $cleanName")
            
            // Search for movie
            val searchResponse = service.searchMovie(cleanName)
            if (!searchResponse.isSuccessful || searchResponse.body()?.results.isNullOrEmpty()) {
                android.util.Log.d("TmdbClient", "Movie not found on TMDB")
                return null
            }
            
            val movie = searchResponse.body()!!.results.first()
            android.util.Log.d("TmdbClient", "Found movie: ${movie.title} (ID: ${movie.id})")
            
            // Get videos for this movie
            val videosResponse = service.getMovieVideos(movie.id)
            if (!videosResponse.isSuccessful || videosResponse.body()?.results.isNullOrEmpty()) {
                // Try with English if French fails
                val videosResponseEn = service.getMovieVideos(movie.id, "en-US")
                if (!videosResponseEn.isSuccessful || videosResponseEn.body()?.results.isNullOrEmpty()) {
                    android.util.Log.d("TmdbClient", "No videos found for movie")
                    return null
                }
                return findBestTrailer(videosResponseEn.body()!!.results)
            }
            
            return findBestTrailer(videosResponse.body()!!.results)
            
        } catch (e: Exception) {
            android.util.Log.e("TmdbClient", "Error fetching trailer from TMDB", e)
            return null
        }
    }
    
    /**
     * Find the best trailer from a list of videos
     * Priority: Official Trailer > Trailer > Teaser > Any video
     */
    private fun findBestTrailer(videos: List<TmdbVideo>): String? {
        // Filter only YouTube videos
        val youtubeVideos = videos.filter { it.site.equals("YouTube", ignoreCase = true) }
        if (youtubeVideos.isEmpty()) return null
        
        // Priority: Official Trailer > Trailer > Teaser
        val trailer = youtubeVideos.find { 
            it.type.equals("Trailer", ignoreCase = true) && it.official == true 
        } ?: youtubeVideos.find { 
            it.type.equals("Trailer", ignoreCase = true) 
        } ?: youtubeVideos.find { 
            it.type.equals("Teaser", ignoreCase = true) 
        } ?: youtubeVideos.firstOrNull()
        
        if (trailer != null) {
            val youtubeUrl = "https://www.youtube.com/watch?v=${trailer.key}"
            android.util.Log.d("TmdbClient", "Found trailer: ${trailer.name} -> $youtubeUrl")
            return youtubeUrl
        }
        
        return null
    }
    
    /**
     * Get YouTube embed URL for WebView
     */
    fun getYouTubeEmbedUrl(videoKey: String): String {
        return "https://www.youtube.com/embed/$videoKey?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0"
    }
    
    /**
     * Get popular movies from TMDB (OPTIMIZED: only 2 API calls for TV Box performance)
     */
    suspend fun getTrendingMovies(): List<TmdbMovie> {
        return try {
            val allMovies = mutableListOf<TmdbMovie>()
            val seenIds = mutableSetOf<Int>()
            
            // 1. Get popular movies (most likely to match Xtream catalog)
            val popularResponse = service.getPopularMovies()
            if (popularResponse.isSuccessful && popularResponse.body() != null) {
                popularResponse.body()!!.results.forEach { movie ->
                    if (seenIds.add(movie.id)) allMovies.add(movie)
                }
            }
            
            // 2. Get popular movies page 2 for more options
            val popularResponse2 = service.getPopularMovies(page = 2)
            if (popularResponse2.isSuccessful && popularResponse2.body() != null) {
                popularResponse2.body()!!.results.forEach { movie ->
                    if (seenIds.add(movie.id)) allMovies.add(movie)
                }
            }
            
            android.util.Log.d("TmdbClient", "Total unique movies from TMDB: ${allMovies.size}")
            allMovies
        } catch (e: Exception) {
            android.util.Log.e("TmdbClient", "Error fetching movies from TMDB", e)
            emptyList()
        }
    }
    
    /**
     * Get popular series from TMDB (OPTIMIZED: only 2 API calls for TV Box performance)
     */
    suspend fun getTrendingSeries(): List<TmdbSeries> {
        return try {
            val allSeries = mutableListOf<TmdbSeries>()
            val seenIds = mutableSetOf<Int>()
            
            // 1. Get popular series (most likely to match Xtream catalog)
            val popularResponse = service.getPopularSeries()
            if (popularResponse.isSuccessful && popularResponse.body() != null) {
                popularResponse.body()!!.results.forEach { series ->
                    if (seenIds.add(series.id)) allSeries.add(series)
                }
            }
            
            // 2. Get popular series page 2 for more options
            val popularResponse2 = service.getPopularSeries(page = 2)
            if (popularResponse2.isSuccessful && popularResponse2.body() != null) {
                popularResponse2.body()!!.results.forEach { series ->
                    if (seenIds.add(series.id)) allSeries.add(series)
                }
            }
            
            android.util.Log.d("TmdbClient", "Total unique series from TMDB: ${allSeries.size}")
            allSeries
        } catch (e: Exception) {
            android.util.Log.e("TmdbClient", "Error fetching series from TMDB", e)
            emptyList()
        }
    }
    
    /**
     * Get full poster URL from TMDB path
     */
    fun getPosterUrl(posterPath: String?): String? {
        return posterPath?.let { "https://image.tmdb.org/t/p/w500$it" }
    }
    
    /**
     * Get full backdrop URL from TMDB path
     */
    fun getBackdropUrl(backdropPath: String?): String? {
        return backdropPath?.let { "https://image.tmdb.org/t/p/w1280$it" }
    }
}