package com.oxoplayer.tv.data.update

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.util.Log
import androidx.core.content.FileProvider
import com.oxoplayer.tv.BuildConfig
import com.oxoplayer.tv.data.api.RetrofitClient
import com.oxoplayer.tv.data.models.UpdateCheckResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/**
 * UpdateManager - Handles OTA updates for OXO Player
 * 
 * Features:
 * - Check for updates from API
 * - Download APK from Cloudflare R2
 * - Install APK using system installer
 */
object UpdateManager {
    
    private const val TAG = "UpdateManager"
    private const val APK_FILE_NAME = "oxo-player-update.apk"
    
    private var downloadId: Long = -1
    private var onDownloadComplete: ((Boolean) -> Unit)? = null
    
    /**
     * Check if an update is available
     * 
     * @return UpdateCheckResponse with update info, or null if error
     */
    suspend fun checkForUpdate(): Result<UpdateCheckResponse> = withContext(Dispatchers.IO) {
        try {
            val currentVersionCode = BuildConfig.VERSION_CODE
            Log.d(TAG, "Checking for updates. Current version code: $currentVersionCode")
            
            val response = RetrofitClient.apiService.checkUpdate(currentVersionCode)
            
            if (response.isSuccessful && response.body() != null) {
                val updateResponse = response.body()!!
                Log.d(TAG, "Update check result: updateAvailable=${updateResponse.updateAvailable}")
                Result.success(updateResponse)
            } else {
                val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                Log.e(TAG, "Update check failed: $errorMsg")
                Result.failure(Exception("Failed to check for updates: $errorMsg"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking for updates", e)
            Result.failure(e)
        }
    }
    
    /**
     * Download the update APK
     * 
     * @param context Application context
     * @param downloadUrl URL of the APK to download
     * @param onProgress Progress callback (0-100)
     * @param onComplete Completion callback (success: Boolean)
     */
    fun downloadUpdate(
        context: Context,
        downloadUrl: String,
        versionName: String,
        onComplete: (Boolean) -> Unit
    ) {
        try {
            Log.d(TAG, "Starting download from: $downloadUrl")
            
            // Delete old APK if exists
            val apkFile = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILE_NAME)
            if (apkFile.exists()) {
                apkFile.delete()
            }
            
            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            
            val request = DownloadManager.Request(Uri.parse(downloadUrl)).apply {
                setTitle("OXO Player v$versionName")
                setDescription("Téléchargement de la mise à jour...")
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, APK_FILE_NAME)
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
            }
            
            downloadId = downloadManager.enqueue(request)
            onDownloadComplete = onComplete
            
            // Register receiver for download complete
            val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(downloadReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                context.registerReceiver(downloadReceiver, filter)
            }
            
            Log.d(TAG, "Download started with ID: $downloadId")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error starting download", e)
            onComplete(false)
        }
    }
    
    /**
     * BroadcastReceiver for download completion
     */
    private val downloadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val id = intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) ?: -1
            
            if (id == downloadId && context != null) {
                Log.d(TAG, "Download completed for ID: $id")
                
                val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                val query = DownloadManager.Query().setFilterById(downloadId)
                val cursor = downloadManager.query(query)
                
                if (cursor.moveToFirst()) {
                    val statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                    val status = cursor.getInt(statusIndex)
                    
                    val success = status == DownloadManager.STATUS_SUCCESSFUL
                    Log.d(TAG, "Download status: $status, success: $success")
                    
                    onDownloadComplete?.invoke(success)
                    
                    // Unregister receiver
                    try {
                        context.unregisterReceiver(this)
                    } catch (e: Exception) {
                        Log.w(TAG, "Receiver already unregistered")
                    }
                }
                cursor.close()
            }
        }
    }
    
    /**
     * Install the downloaded APK
     * 
     * @param context Application context
     */
    fun installUpdate(context: Context) {
        try {
            val apkFile = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILE_NAME)
            
            if (!apkFile.exists()) {
                Log.e(TAG, "APK file not found: ${apkFile.absolutePath}")
                return
            }
            
            Log.d(TAG, "Installing APK from: ${apkFile.absolutePath}")
            
            val apkUri: Uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    apkFile
                )
            } else {
                Uri.fromFile(apkFile)
            }
            
            val installIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            
            context.startActivity(installIntent)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error installing update", e)
        }
    }
    
    /**
     * Get the downloaded APK file
     */
    fun getDownloadedApkFile(context: Context): File? {
        val apkFile = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILE_NAME)
        return if (apkFile.exists()) apkFile else null
    }
    
    /**
     * Delete the downloaded APK file
     */
    fun deleteDownloadedApk(context: Context) {
        val apkFile = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILE_NAME)
        if (apkFile.exists()) {
            apkFile.delete()
            Log.d(TAG, "Deleted old APK file")
        }
    }
}
