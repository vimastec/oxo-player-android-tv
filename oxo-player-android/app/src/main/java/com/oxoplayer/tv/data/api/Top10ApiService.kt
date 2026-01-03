package com.oxoplayer.tv.data.api

import com.oxoplayer.tv.BuildConfig
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query

/**
 * OXO Server API for fetching pre-calculated Top 10 content
 * This provides instant Top 10 results without heavy client-side processing
 */
interface Top10Api {
    
    @GET("top10")
    suspend fun getTop10(
        @Query("host") host: String
    ): Response<Top10Response>
}

/**
 * Response from /api/top10?host=xxx
 */
data class Top10Response(
    val host: String,
    val name: String?,
    val found: Boolean,
    val movies: List<Top10ItemResponse>,
    val series: List<Top10ItemResponse>,
    val last_update: String?,
    val message: String?
)

/**
 * Individual Top 10 item from server
 */
data class Top10ItemResponse(
    val rank: Int,
    val title: String,
    val posterUrl: String?,
    val xtreamId: Int,
    val isMovie: Boolean,
    val badge: String?,
    val streamIcon: String?,
    val cover: String?,
    val containerExtension: String?
)

/**
 * Top 10 API Client
 */
object Top10ApiClient {
    
    private val retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
    
    val service: Top10Api = retrofit.create(Top10Api::class.java)
    
    /**
     * Extract host from Xtream credentials
     * e.g., "http://iptv-gold.com:8080" -> "iptv-gold.com:8080"
     */
    fun extractHost(fullUrl: String): String {
        var host = fullUrl
        
        // Remove protocol
        host = host.replace(Regex("^https?://"), "")
        
        // Remove trailing slashes
        host = host.trimEnd('/')
        
        // Remove paths (e.g., /player_api.php)
        val pathIndex = host.indexOf('/')
        if (pathIndex > 0) {
            host = host.substring(0, pathIndex)
        }
        
        return host.lowercase()
    }
    
    /**
     * Get Top 10 from server for a given Xtream host
     * Returns null if host not found or error
     */
    suspend fun getTop10ForHost(xtreamHost: String): Top10Response? {
        return try {
            val normalizedHost = extractHost(xtreamHost)
            android.util.Log.d("Top10ApiClient", "Fetching Top 10 for host: $normalizedHost")
            
            val response = service.getTop10(normalizedHost)
            
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                if (body.found) {
                    android.util.Log.d("Top10ApiClient", "✅ Got Top 10 from server: ${body.movies.size} movies, ${body.series.size} series")
                    body
                } else {
                    android.util.Log.d("Top10ApiClient", "⚠️ Host not registered for Top 10: ${body.message}")
                    null
                }
            } else {
                android.util.Log.w("Top10ApiClient", "❌ Server error: ${response.code()}")
                null
            }
        } catch (e: Exception) {
            android.util.Log.e("Top10ApiClient", "❌ Error fetching Top 10 from server", e)
            null
        }
    }
}

