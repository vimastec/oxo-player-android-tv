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
     * Get device MAC address - PERSISTENT across reinstalls
     * Once generated, the MAC address is saved and reused forever
     */
    fun getMacAddress(): String {
        // IMPORTANT: Check if we already have a saved MAC address
        val savedMac = preferencesManager.macAddress
        if (!savedMac.isNullOrEmpty()) {
            // Reuse the previously saved MAC address
            return savedMac
        }
        
        // Generate new MAC address (first install only)
        val newMac = generateMacAddress()
        
        // Save it permanently to survive reinstalls
        preferencesManager.macAddress = newMac
        
        return newMac
    }
    
    /**
     * Generate MAC address from device hardware
     */
    private fun generateMacAddress(): String {
        try {
            // Try to get real MAC address
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
            e.printStackTrace()
        }
        
        // Fallback: Use Android ID as pseudo-MAC
        val androidId = android.provider.Settings.Secure.getString(
            context.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        ) ?: UUID.randomUUID().toString()
        
        // Convert Android ID to MAC format
        val mac = androidId.take(12).chunked(2).joinToString(":")
        return mac.uppercase()
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

