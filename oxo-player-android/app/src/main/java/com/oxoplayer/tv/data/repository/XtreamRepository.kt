package com.oxoplayer.tv.data.repository

import com.oxoplayer.tv.data.api.XtreamClient
import com.oxoplayer.tv.data.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Repository for Xtream API operations
 * 
 * Handles:
 * - Series data with proper hierarchy: Categories -> Series -> Seasons -> Episodes
 * - Movies/VOD data with hierarchy: Categories -> Movies
 */
class XtreamRepository {
    
    private val TAG = "XtreamRepository"
    
    /**
     * Get all series categories
     * Returns: List of categories like "RAMADAN 2025", "NETFLIX", etc.
     */
    suspend fun getSeriesCategories(): Result<List<XtreamSeriesCategory>> = withContext(Dispatchers.IO) {
        try {
            val credentials = XtreamClient.getCredentials()
            val service = XtreamClient.getService()
            
            val response = service.getSeriesCategories(
                username = credentials.username,
                password = credentials.password
            )
            
            if (response.isSuccessful && response.body() != null) {
                val categories = response.body()!!
                android.util.Log.d(TAG, "Loaded ${categories.size} series categories")
                Result.success(categories)
            } else {
                Result.failure(Exception("Failed to get categories: ${response.code()}"))
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting series categories", e)
            Result.failure(e)
        }
    }
    
    /**
     * Get series list for a specific category
     */
    suspend fun getSeriesByCategory(categoryId: String): Result<List<XtreamSeries>> = withContext(Dispatchers.IO) {
        try {
            val credentials = XtreamClient.getCredentials()
            val service = XtreamClient.getService()
            
            val response = service.getSeriesByCategory(
                username = credentials.username,
                password = credentials.password,
                categoryId = categoryId
            )
            
            if (response.isSuccessful && response.body() != null) {
                val series = response.body()!!
                android.util.Log.d(TAG, "Loaded ${series.size} series for category $categoryId")
                Result.success(series)
            } else {
                Result.failure(Exception("Failed to get series: ${response.code()}"))
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting series for category $categoryId", e)
            Result.failure(e)
        }
    }
    
    /**
     * Get full series info with seasons and episodes
     */
    suspend fun getSeriesInfo(seriesId: Int): Result<XtreamSeriesInfo> = withContext(Dispatchers.IO) {
        try {
            val credentials = XtreamClient.getCredentials()
            val service = XtreamClient.getService()
            
            val response = service.getSeriesInfo(
                username = credentials.username,
                password = credentials.password,
                seriesId = seriesId
            )
            
            if (response.isSuccessful && response.body() != null) {
                val seriesInfo = response.body()!!
                android.util.Log.d(TAG, "Loaded series info for $seriesId: ${seriesInfo.episodes?.size ?: 0} seasons")
                Result.success(seriesInfo)
            } else {
                Result.failure(Exception("Failed to get series info: ${response.code()}"))
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting series info for $seriesId", e)
            Result.failure(e)
        }
    }
    
    /**
     * Build stream URL for an episode
     */
    fun buildEpisodeStreamUrl(episodeId: String, extension: String?): String {
        val credentials = XtreamClient.getCredentials()
        val ext = extension ?: "mkv"
        return credentials.buildSeriesStreamUrl(episodeId, ext)
    }
    
    // ==================== VOD/Movies Methods ====================
    
    /**
     * Get all VOD/movie categories
     * Returns: List of categories like "ACTION", "COMEDY", "ARABIC MOVIES", etc.
     */
    suspend fun getMovieCategories(): Result<List<XtreamMovieCategory>> = withContext(Dispatchers.IO) {
        try {
            val credentials = XtreamClient.getCredentials()
            val service = XtreamClient.getService()
            
            val response = service.getVodCategories(
                username = credentials.username,
                password = credentials.password
            )
            
            if (response.isSuccessful && response.body() != null) {
                val categories = response.body()!!
                android.util.Log.d(TAG, "Loaded ${categories.size} movie categories")
                Result.success(categories)
            } else {
                Result.failure(Exception("Failed to get movie categories: ${response.code()}"))
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting movie categories", e)
            Result.failure(e)
        }
    }
    
    /**
     * Get VOD/movie list for a specific category
     */
    suspend fun getMoviesByCategory(categoryId: String): Result<List<XtreamMovie>> = withContext(Dispatchers.IO) {
        try {
            val credentials = XtreamClient.getCredentials()
            val service = XtreamClient.getService()
            
            val response = service.getVodStreams(
                username = credentials.username,
                password = credentials.password,
                categoryId = categoryId
            )
            
            if (response.isSuccessful && response.body() != null) {
                val movies = response.body()!!
                android.util.Log.d(TAG, "Loaded ${movies.size} movies for category $categoryId")
                Result.success(movies)
            } else {
                Result.failure(Exception("Failed to get movies: ${response.code()}"))
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting movies for category $categoryId", e)
            Result.failure(e)
        }
    }
    
    /**
     * Get full VOD/movie info with stream details
     */
    suspend fun getMovieInfo(vodId: Int): Result<XtreamMovieInfo> = withContext(Dispatchers.IO) {
        try {
            val credentials = XtreamClient.getCredentials()
            val service = XtreamClient.getService()
            
            val response = service.getVodInfo(
                username = credentials.username,
                password = credentials.password,
                vodId = vodId
            )
            
            if (response.isSuccessful && response.body() != null) {
                val movieInfo = response.body()!!
                android.util.Log.d(TAG, "Loaded movie info for $vodId: ${movieInfo.info?.name}")
                Result.success(movieInfo)
            } else {
                Result.failure(Exception("Failed to get movie info: ${response.code()}"))
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting movie info for $vodId", e)
            Result.failure(e)
        }
    }
    
    /**
     * Build stream URL for a movie
     */
    fun buildMovieStreamUrl(streamId: Int, extension: String?): String {
        val credentials = XtreamClient.getCredentials()
        val ext = extension ?: "mkv"
        return credentials.buildMovieStreamUrl(streamId, ext)
    }
    
    /**
     * Convert Xtream movie to app Movie model
     */
    fun convertXtreamMovieToAppMovie(
        xtreamMovie: XtreamMovie,
        categoryName: String
    ): Movie {
        val credentials = XtreamClient.getCredentials()
        val ext = xtreamMovie.containerExtension ?: "mkv"
        val streamUrl = credentials.buildMovieStreamUrl(xtreamMovie.streamId, ext)
        
        return Movie(
            id = "xtream_${xtreamMovie.streamId}",
            name = xtreamMovie.name,
            streamUrl = streamUrl,
            cover = xtreamMovie.streamIcon,
            category = categoryName,
            rating = xtreamMovie.rating,
            year = null,
            duration = null,
            plot = null
        )
    }
    
    // ==================== Live TV Methods ====================
    
    /**
     * Get all Live TV categories
     * Returns: List of categories like "SPORTS", "NEWS", "FR HD", etc.
     */
    suspend fun getLiveCategories(): Result<List<XtreamLiveCategory>> = withContext(Dispatchers.IO) {
        try {
            val credentials = XtreamClient.getCredentials()
            val service = XtreamClient.getService()
            
            val response = service.getLiveCategories(
                username = credentials.username,
                password = credentials.password
            )
            
            if (response.isSuccessful && response.body() != null) {
                val categories = response.body()!!
                android.util.Log.d(TAG, "Loaded ${categories.size} live TV categories")
                Result.success(categories)
            } else {
                Result.failure(Exception("Failed to get live categories: ${response.code()}"))
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting live categories", e)
            Result.failure(e)
        }
    }
    
    /**
     * Get Live TV streams/channels for a specific category
     */
    suspend fun getLiveStreamsByCategory(categoryId: String): Result<List<XtreamLiveStream>> = withContext(Dispatchers.IO) {
        try {
            val credentials = XtreamClient.getCredentials()
            val service = XtreamClient.getService()
            
            val response = service.getLiveStreams(
                username = credentials.username,
                password = credentials.password,
                categoryId = categoryId
            )
            
            if (response.isSuccessful && response.body() != null) {
                val streams = response.body()!!
                android.util.Log.d(TAG, "Loaded ${streams.size} live streams for category $categoryId")
                Result.success(streams)
            } else {
                Result.failure(Exception("Failed to get live streams: ${response.code()}"))
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting live streams for category $categoryId", e)
            Result.failure(e)
        }
    }
    
    /**
     * Get all Live TV streams (useful for home page preview)
     */
    suspend fun getAllLiveStreams(): Result<List<XtreamLiveStream>> = withContext(Dispatchers.IO) {
        try {
            val credentials = XtreamClient.getCredentials()
            val service = XtreamClient.getService()
            
            val response = service.getAllLiveStreams(
                username = credentials.username,
                password = credentials.password
            )
            
            if (response.isSuccessful && response.body() != null) {
                val streams = response.body()!!
                android.util.Log.d(TAG, "Loaded ${streams.size} total live streams")
                Result.success(streams)
            } else {
                Result.failure(Exception("Failed to get all live streams: ${response.code()}"))
            }
        } catch (e: Exception) {
            android.util.Log.e(TAG, "Error getting all live streams", e)
            Result.failure(e)
        }
    }
    
    /**
     * Build stream URL for a Live TV channel
     */
    fun buildLiveStreamUrl(streamId: Int, extension: String = "m3u8"): String {
        val credentials = XtreamClient.getCredentials()
        return credentials.buildLiveStreamUrl(streamId, extension)
    }
    
    /**
     * Convert Xtream live stream to app Channel model
     */
    fun convertXtreamLiveToChannel(
        stream: XtreamLiveStream,
        categoryName: String
    ): Channel {
        val credentials = XtreamClient.getCredentials()
        val streamUrl = credentials.buildLiveStreamUrl(stream.streamId, "m3u8")
        
        return Channel(
            id = "xtream_live_${stream.streamId}",
            num = stream.num ?: stream.streamId,
            name = stream.name,
            streamUrl = streamUrl,
            logo = stream.streamIcon,
            category = categoryName,
            epgChannelId = stream.epgChannelId,
            tvgId = stream.epgChannelId
        )
    }
    
    /**
     * Convert Xtream categories to app SeriesCategory model
     * Note: This creates lightweight category objects without loading all series
     */
    suspend fun convertToAppCategories(
        xtreamCategories: List<XtreamSeriesCategory>
    ): List<SeriesCategory> {
        return xtreamCategories.map { xtreamCat ->
            SeriesCategory(
                id = "xtream_cat_${xtreamCat.categoryId}",
                name = xtreamCat.categoryName,
                seriesList = emptyList() // Will be loaded on demand
            )
        }
    }
    
    /**
     * Convert Xtream series to app SeriesInfo model
     */
    fun convertToAppSeriesInfo(
        xtreamSeries: List<XtreamSeries>,
        categoryName: String
    ): List<SeriesInfo> {
        return xtreamSeries.map { series ->
            SeriesInfo(
                id = "xtream_${series.seriesId}",
                name = series.name,
                cover = series.cover,
                category = categoryName,
                totalSeasons = 0, // Unknown until we load series info
                totalEpisodes = 0
            )
        }
    }
    
    /**
     * Convert Xtream series info to app Series model with full details
     */
    fun convertToAppSeries(
        seriesId: Int,
        seriesInfo: XtreamSeriesInfo,
        categoryName: String
    ): Series {
        val credentials = XtreamClient.getCredentials()
        val info = seriesInfo.info
        
        // Convert episodes map to seasons
        val seasons = seriesInfo.episodes?.map { (seasonNum, episodes) ->
            Season(
                seasonNumber = seasonNum.toIntOrNull() ?: 1,
                episodes = episodes.map { ep ->
                    Episode(
                        id = "xtream_ep_${ep.id}",
                        episodeNumber = ep.episodeNum,
                        name = ep.title ?: "Episode ${ep.episodeNum}",
                        streamUrl = credentials.buildSeriesStreamUrl(
                            ep.id,
                            ep.containerExtension ?: "mkv"
                        ),
                        cover = ep.info?.coverBig ?: ep.info?.movieImage,
                        duration = ep.info?.duration,
                        plot = ep.info?.plot
                    )
                }.sortedBy { it.episodeNumber }
            )
        }?.sortedBy { it.seasonNumber } ?: emptyList()
        
        return Series(
            id = "xtream_$seriesId",
            name = info?.name ?: "Unknown Series",
            cover = info?.cover,
            category = categoryName,
            rating = info?.rating,
            year = info?.releaseDate ?: info?.releaseDateAlt,
            plot = info?.plot,
            seasons = seasons
        )
    }
}














