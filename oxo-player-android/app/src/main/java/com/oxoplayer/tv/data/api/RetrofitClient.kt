package com.oxoplayer.tv.data.api

import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import com.oxoplayer.tv.BuildConfig
import com.oxoplayer.tv.data.auth.FirebaseAuthHelper
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

object RetrofitClient {
    
    private const val TAG = "RetrofitClient"
    private const val BASE_URL = BuildConfig.API_BASE_URL
    
    private var appContext: Context? = null
    
    /**
     * Initialize with application context (call from Application class)
     */
    fun init(context: Context) {
        appContext = context.applicationContext
    }
    
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }
    
    /**
     * Interceptor that adds security headers to all requests
     */
    private val securityInterceptor = Interceptor { chain ->
        val originalRequest = chain.request()
        
        val requestBuilder = originalRequest.newBuilder()
        
        // Add Firebase ID Token if available
        try {
            val token = runBlocking { FirebaseAuthHelper.getIdToken() }
            if (token != null) {
                requestBuilder.addHeader("Authorization", "Bearer $token")
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get Firebase token: ${e.message}")
        }
        
        // Add app verification headers
        requestBuilder.addHeader("X-App-Package", BuildConfig.APPLICATION_ID)
        requestBuilder.addHeader("X-App-Version", BuildConfig.VERSION_NAME)
        
        // Add app signature hash (for verification)
        appContext?.let { ctx ->
            getAppSignature(ctx)?.let { signature ->
                requestBuilder.addHeader("X-App-Signature", signature)
            }
        }
        
        chain.proceed(requestBuilder.build())
    }
    
    /**
     * Get the SHA-256 signature of the app (for server verification)
     */
    private fun getAppSignature(context: Context): String? {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(
                context.packageName,
                PackageManager.GET_SIGNATURES
            )
            val signatures = packageInfo.signatures
            if (signatures.isNotEmpty()) {
                val signature = signatures[0]
                val md = MessageDigest.getInstance("SHA-256")
                val digest = md.digest(signature.toByteArray())
                digest.joinToString(":") { "%02X".format(it) }
            } else null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get app signature", e)
            null
        }
    }
    
    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(securityInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()
    
    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
    
    val apiService: ApiService = retrofit.create(ApiService::class.java)
}














