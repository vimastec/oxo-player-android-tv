package com.oxoplayer.tv.data.repository

import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
import com.oxoplayer.tv.data.api.RetrofitClient
import com.oxoplayer.tv.data.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.NetworkInterface
import java.util.*

class DeviceRepository(private val context: Context) {
    
    private val apiService = RetrofitClient.apiService
    private val preferencesManager = com.oxoplayer.tv.data.preferences.PreferencesManager(context)
    
    /**
     * Get device MAC address - PERSISTENT across reinstalls using Android ID
     * 
     * Priority:
     * 1. If user already has a saved MAC (migration), keep it
     * 2. Otherwise, generate from Android ID (persists across reinstalls)
     */
    fun getMacAddress(): String {
        // Check if we have a saved MAC from before (migration for existing users)
        val savedMac = preferencesManager.macAddress
        if (!savedMac.isNullOrEmpty()) {
            return savedMac
        }
        
        // Generate MAC from Android ID (persistent across reinstalls)
        val mac = generateMacFromAndroidId()
        
        // Save it for consistency
        preferencesManager.macAddress = mac
        
        return mac
    }
    
    /**
     * Generate MAC address from Android ID
     * This is PERSISTENT even after app uninstall/reinstall
     * Only changes on factory reset or Google account change
     */
    private fun generateMacFromAndroidId(): String {
        // Get Android ID (persistent identifier)
        val androidId = android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        )
        
        if (!androidId.isNullOrEmpty() && androidId.length >= 12) {
            // Convert Android ID to MAC format (take first 12 chars)
            val mac = androidId.take(12).uppercase().chunked(2).joinToString(":")
            android.util.Log.d("DeviceRepository", "Generated MAC from Android ID: $mac")
            return mac
        }
        
        // Fallback: try to get real hardware MAC (rare case)
        val hardwareMac = getHardwareMacAddress()
        if (hardwareMac != null) {
            return hardwareMac
        }
        
        // Last resort: generate random but save it
        val randomMac = generateRandomMac()
        android.util.Log.w("DeviceRepository", "Using random MAC as fallback: $randomMac")
        return randomMac
    }
    
    /**
     * Try to get real hardware MAC address (works on some devices)
     */
    private fun getHardwareMacAddress(): String? {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                if (networkInterface.name.equals("wlan0", ignoreCase = true) ||
                    networkInterface.name.equals("eth0", ignoreCase = true)) {
                    val mac = networkInterface.hardwareAddress
                    if (mac != null && mac.isNotEmpty()) {
                        val sb = StringBuilder()
                        for (b in mac) {
                            sb.append(String.format("%02X:", b))
                        }
                        if (sb.isNotEmpty()) {
                            sb.deleteCharAt(sb.length - 1)
                        }
                        return sb.toString()
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("DeviceRepository", "Error getting hardware MAC", e)
        }
        return null
    }
    
    /**
     * Generate random MAC (last resort fallback)
     */
    private fun generateRandomMac(): String {
        val uuid = UUID.randomUUID().toString().replace("-", "")
        return uuid.take(12).uppercase().chunked(2).joinToString(":")
    }
    
    /**
     * Get device info string
     */
    fun getDeviceInfo(): String {
        return "Android TV ${Build.VERSION.RELEASE} - ${Build.MANUFACTURER} ${Build.MODEL}"
    }
    
    /**
     * Register device with API
     */
    suspend fun registerDevice(): Result<DeviceRegisterResponse> = withContext(Dispatchers.IO) {
        try {
            val macAddress = getMacAddress()
            val deviceInfo = getDeviceInfo()
            
            val request = DeviceRegisterRequest(
                macAddress = macAddress,
                deviceInfo = deviceInfo
            )
            
            val response = apiService.registerDevice(request)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Registration failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Get device status
     */
    suspend fun getDeviceStatus(): Result<DeviceStatusResponse> = withContext(Dispatchers.IO) {
        try {
            val macAddress = getMacAddress().replace(":", "")
            val response = apiService.getDeviceStatus(macAddress)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to get status: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Get playlist info
     */
    suspend fun getPlaylist(): Result<PlaylistResponse> = withContext(Dispatchers.IO) {
        try {
            val macAddress = getMacAddress().replace(":", "")
            val response = apiService.getPlaylist(macAddress)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to get playlist: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Get playlist content (M3U) - Returns InputStream for streaming
     */
    suspend fun getPlaylistContentStream(): Result<java.io.InputStream> = withContext(Dispatchers.IO) {
        try {
            val macAddress = getMacAddress().replace(":", "")
            val response = apiService.getPlaylistContent(macAddress)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.byteStream())
            } else {
                Result.failure(Exception("Failed to get playlist content: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Get playlist content (M3U) - Legacy String version
     */
    suspend fun getPlaylistContent(): Result<String> = withContext(Dispatchers.IO) {
        try {
            val macAddress = getMacAddress().replace(":", "")
            val response = apiService.getPlaylistContent(macAddress)
            
            if (response.isSuccessful && response.body() != null) {
                // Read the response body as string
                val content = response.body()!!.string()
                Result.success(content)
            } else {
                Result.failure(Exception("Failed to get playlist content: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Download M3U directly from URL - bypasses backend for large playlists
     * More memory efficient for very large M3U files
     */
    suspend fun downloadM3UDirectly(m3uUrl: String): Result<java.io.InputStream> = withContext(Dispatchers.IO) {
        try {
            android.util.Log.d("DeviceRepository", "Downloading M3U directly from: $m3uUrl")
            
            val client = okhttp3.OkHttpClient.Builder()
                .connectTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
                .build()
            
            val request = okhttp3.Request.Builder()
                .url(m3uUrl)
                .header("User-Agent", "OXO Player TV/1.0")
                .build()
            
            val response = client.newCall(request).execute()
            
            if (response.isSuccessful && response.body != null) {
                Result.success(response.body!!.byteStream())
            } else {
                Result.failure(Exception("Failed to download M3U: ${response.code}"))
            }
        } catch (e: Exception) {
            android.util.Log.e("DeviceRepository", "Error downloading M3U directly", e)
            Result.failure(e)
        }
    }
    
    /**
     * Get all playlists for device
     */
    suspend fun getAllPlaylists(): Result<PlaylistsResponse> = withContext(Dispatchers.IO) {
        try {
            val macAddress = getMacAddress().replace(":", "")
            val response = apiService.getAllPlaylists(macAddress)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to get playlists: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Get specific playlist by ID
     */
    suspend fun getPlaylistById(playlistId: Int): Result<SinglePlaylistResponse> = withContext(Dispatchers.IO) {
        try {
            val macAddress = getMacAddress().replace(":", "")
            val response = apiService.getPlaylistById(macAddress, playlistId)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to get playlist: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    /**
     * Set active playlist for device
     */
    suspend fun setActivePlaylist(playlistId: Int): Result<SetActiveResponse> = withContext(Dispatchers.IO) {
        try {
            val macAddress = getMacAddress().replace(":", "")
            val response = apiService.setActivePlaylist(macAddress, playlistId)
            
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to set active playlist: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

