package com.oxoplayer.tv.data.api

import com.oxoplayer.tv.BuildConfig
import com.oxoplayer.tv.data.models.XtreamCredentials
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Dynamic Xtream API Client
 * 
 * This client is created dynamically based on the Xtream credentials
 * extracted from the M3U URL. Each provider has a different host.
 */
object XtreamClient {
    
    private var currentCredentials: XtreamCredentials? = null
    private var xtreamApiService: XtreamApiService? = null
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BASIC
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }
    
    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()
    
    /**
     * Initialize the Xtream client with credentials
     */
    @Synchronized
    fun initialize(credentials: XtreamCredentials) {
        // Only recreate if credentials changed
        if (currentCredentials == credentials && xtreamApiService != null) {
            return
        }
        
        currentCredentials = credentials
        
        // Ensure host has http:// or https:// prefix
        var host = credentials.host
        if (!host.startsWith("http://") && !host.startsWith("https://")) {
            host = "http://$host"
        }
        
        // Ensure host ends with /
        val baseUrl = if (host.endsWith("/")) {
            host
        } else {
            "$host/"
        }
        
        val retrofit = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        
        xtreamApiService = retrofit.create(XtreamApiService::class.java)
        
        android.util.Log.d("XtreamClient", "Initialized with host: $baseUrl")
    }
    
    /**
     * Get the API service (must call initialize first)
     */
    fun getService(): XtreamApiService {
        return xtreamApiService 
            ?: throw IllegalStateException("XtreamClient not initialized. Call initialize() first.")
    }
    
    /**
     * Get current credentials
     */
    fun getCredentials(): XtreamCredentials {
        return currentCredentials
            ?: throw IllegalStateException("XtreamClient not initialized. Call initialize() first.")
    }
    
    /**
     * Check if client is initialized
     */
    fun isInitialized(): Boolean {
        return currentCredentials != null && xtreamApiService != null
    }
    
    /**
     * Clear the client (logout)
     */
    @Synchronized
    fun clear() {
        currentCredentials = null
        xtreamApiService = null
    }
}






