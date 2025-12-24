package com.oxoplayer.tv.data.api

import com.oxoplayer.tv.data.models.XtreamEpisode
import com.oxoplayer.tv.data.models.XtreamLiveCategory
import com.oxoplayer.tv.data.models.XtreamLiveStream
import com.oxoplayer.tv.data.models.XtreamMovie
import com.oxoplayer.tv.data.models.XtreamMovieCategory
import com.oxoplayer.tv.data.models.XtreamMovieInfo
import com.oxoplayer.tv.data.models.XtreamSeries
import com.oxoplayer.tv.data.models.XtreamSeriesCategory
import com.oxoplayer.tv.data.models.XtreamSeriesInfo
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * Xtream Codes API Service
 * 
 * Documentation: https://xtream-codes.github.io/api/
 * 
 * This service is used to fetch series and VOD/movies data with proper hierarchy:
 * - Series: Categories -> Series -> Seasons -> Episodes
 * - Movies: Categories -> Movies
 */
interface XtreamApiService {
    
    // ==================== Series Endpoints ====================
    
    /**
     * Get all series categories
     * Example: RAMADAN 2025, NETFLIX, DISNEY+, etc.
     */
    @GET("player_api.php")
    suspend fun getSeriesCategories(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_series_categories"
    ): Response<List<XtreamSeriesCategory>>
    
    /**
     * Get series list for a specific category
     */
    @GET("player_api.php")
    suspend fun getSeriesByCategory(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_series",
        @Query("category_id") categoryId: String
    ): Response<List<XtreamSeries>>
    
    /**
     * Get full series info with seasons and episodes
     */
    @GET("player_api.php")
    suspend fun getSeriesInfo(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_series_info",
        @Query("series_id") seriesId: Int
    ): Response<XtreamSeriesInfo>
    
    // ==================== VOD/Movies Endpoints ====================
    
    /**
     * Get all VOD/movie categories
     * Example: ACTION, COMEDY, ARABIC MOVIES, etc.
     */
    @GET("player_api.php")
    suspend fun getVodCategories(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_vod_categories"
    ): Response<List<XtreamMovieCategory>>
    
    /**
     * Get VOD/movie list for a specific category
     */
    @GET("player_api.php")
    suspend fun getVodStreams(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_vod_streams",
        @Query("category_id") categoryId: String
    ): Response<List<XtreamMovie>>
    
    /**
     * Get full VOD/movie info with stream details
     */
    @GET("player_api.php")
    suspend fun getVodInfo(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_vod_info",
        @Query("vod_id") vodId: Int
    ): Response<XtreamMovieInfo>
    
    // ==================== Live TV Endpoints ====================
    
    /**
     * Get all Live TV categories
     * Example: SPORTS, NEWS, FRENCH HD, etc.
     */
    @GET("player_api.php")
    suspend fun getLiveCategories(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_live_categories"
    ): Response<List<XtreamLiveCategory>>
    
    /**
     * Get Live TV streams/channels for a specific category
     */
    @GET("player_api.php")
    suspend fun getLiveStreams(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_live_streams",
        @Query("category_id") categoryId: String
    ): Response<List<XtreamLiveStream>>
    
    /**
     * Get all Live TV streams (without category filter)
     */
    @GET("player_api.php")
    suspend fun getAllLiveStreams(
        @Query("username") username: String,
        @Query("password") password: String,
        @Query("action") action: String = "get_live_streams"
    ): Response<List<XtreamLiveStream>>
}






