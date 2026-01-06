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
import com.oxoplayer.tv.OXOApplication
import com.oxoplayer.tv.data.api.RetrofitClient
import com.oxoplayer.tv.data.models.AppVersionInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import android.os.Handler
import android.os.Looper

/**
 * Manages app updates - checks for new versions and handles APK download/install
 */
class UpdateManager(private val context: Context) {
    
    companion object {
        private const val TAG = "UpdateManager"
        private const val APK_FILE_NAME = "oxo-player-update.apk"
        private const val CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000L // 6 hours
    }
    
    private val prefs = OXOApplication.getInstance().preferencesManager
    private var downloadId: Long = -1
    private var pendingInstallInfo: AppVersionInfo? = null
    private val progressHandler = Handler(Looper.getMainLooper())
    private var progressRunnable: Runnable? = null
    
    data class UpdateCheckResult(
        val hasUpdate: Boolean,
        val isMandatory: Boolean = false,
        val versionInfo: AppVersionInfo? = null,
        val error: String? = null
    )
    
    /**
     * Check if there's a new version available
     */
    suspend fun checkForUpdate(forceCheck: Boolean = false): UpdateCheckResult {
        return withContext(Dispatchers.IO) {
            try {
                // Check if we should skip (unless forced)
                if (!forceCheck && !shouldCheckForUpdate()) {
                    Log.d(TAG, "Skipping update check - not enough time passed")
                    return@withContext UpdateCheckResult(hasUpdate = false)
                }
                
                val currentVersionCode = BuildConfig.VERSION_CODE
                Log.d(TAG, "Checking for updates. Current version code: $currentVersionCode")
                
                val response = RetrofitClient.apiService.checkForUpdate(currentVersionCode)
                
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    
                    // Update last check time
                    prefs.lastUpdateCheck = System.currentTimeMillis()
                    
                    if (body.updateAvailable && body.latestVersion != null) {
                        val latestVersion = body.latestVersion
                        
                        // Check if user has skipped this version (unless mandatory)
                        val isMandatory = body.isMandatory == true || latestVersion.isMandatory
                        if (!isMandatory && latestVersion.versionCode == prefs.skippedVersion) {
                            Log.d(TAG, "User has skipped version ${latestVersion.versionCode}")
                            return@withContext UpdateCheckResult(hasUpdate = false)
                        }
                        
                        Log.d(TAG, "Update available: ${latestVersion.versionName} (${latestVersion.versionCode})")
                        return@withContext UpdateCheckResult(
                            hasUpdate = true,
                            isMandatory = isMandatory,
                            versionInfo = latestVersion
                        )
                    } else {
                        Log.d(TAG, "No update available")
                        return@withContext UpdateCheckResult(hasUpdate = false)
                    }
                } else {
                    val errorMsg = "Failed to check for updates: ${response.code()}"
                    Log.e(TAG, errorMsg)
                    return@withContext UpdateCheckResult(hasUpdate = false, error = errorMsg)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error checking for updates", e)
                return@withContext UpdateCheckResult(hasUpdate = false, error = e.message)
            }
        }
    }
    
    /**
     * Check if enough time has passed since last update check
     */
    private fun shouldCheckForUpdate(): Boolean {
        val lastCheck = prefs.lastUpdateCheck
        val now = System.currentTimeMillis()
        return (now - lastCheck) >= CHECK_INTERVAL_MS
    }
    
    /**
     * Download the APK update
     */
    fun downloadUpdate(versionInfo: AppVersionInfo, onProgress: (Int) -> Unit, onComplete: (File?) -> Unit, onError: (String) -> Unit) {
        try {
            pendingInstallInfo = versionInfo
            
            // Delete old APK if exists
            val apkFile = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILE_NAME)
            if (apkFile.exists()) {
                apkFile.delete()
            }
            
            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            
            val request = DownloadManager.Request(Uri.parse(versionInfo.downloadUrl))
                .setTitle("OXO Player v${versionInfo.versionName}")
                .setDescription("Téléchargement de la mise à jour...")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, APK_FILE_NAME)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)
            
            downloadId = downloadManager.enqueue(request)
            Log.d(TAG, "Download started with ID: $downloadId")
            
            // Register receiver for download completion
            val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(object : BroadcastReceiver() {
                    override fun onReceive(ctx: Context?, intent: Intent?) {
                        val id = intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) ?: -1
                        if (id == downloadId) {
                            context.unregisterReceiver(this)
                            handleDownloadComplete(downloadManager, onComplete, onError)
                        }
                    }
                }, filter, Context.RECEIVER_EXPORTED)
            } else {
                @Suppress("UnspecifiedRegisterReceiverFlag")
                context.registerReceiver(object : BroadcastReceiver() {
                    override fun onReceive(ctx: Context?, intent: Intent?) {
                        val id = intent?.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) ?: -1
                        if (id == downloadId) {
                            context.unregisterReceiver(this)
                            handleDownloadComplete(downloadManager, onComplete, onError)
                        }
                    }
                }, filter)
            }
            
            // Start progress monitoring
            startProgressMonitoring(downloadManager, onProgress)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error starting download", e)
            onError(e.message ?: "Erreur lors du téléchargement")
        }
    }
    
    /**
     * Monitor download progress and report it via callback
     */
    private fun startProgressMonitoring(downloadManager: DownloadManager, onProgress: (Int) -> Unit) {
        progressRunnable = object : Runnable {
            override fun run() {
                val query = DownloadManager.Query().setFilterById(downloadId)
                val cursor = downloadManager.query(query)
                
                if (cursor.moveToFirst()) {
                    val bytesDownloadedIndex = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                    val bytesTotalIndex = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
                    val statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                    
                    val bytesDownloaded = cursor.getLong(bytesDownloadedIndex)
                    val bytesTotal = cursor.getLong(bytesTotalIndex)
                    val status = cursor.getInt(statusIndex)
                    
                    if (bytesTotal > 0) {
                        val progress = ((bytesDownloaded * 100) / bytesTotal).toInt()
                        onProgress(progress)
                        Log.d(TAG, "Download progress: $progress% ($bytesDownloaded / $bytesTotal)")
                    }
                    
                    // Continue monitoring if still downloading
                    if (status == DownloadManager.STATUS_RUNNING || status == DownloadManager.STATUS_PENDING) {
                        progressHandler.postDelayed(this, 500) // Check every 500ms
                    }
                }
                cursor.close()
            }
        }
        
        // Start monitoring
        progressHandler.post(progressRunnable!!)
    }
    
    /**
     * Stop progress monitoring
     */
    private fun stopProgressMonitoring() {
        progressRunnable?.let { progressHandler.removeCallbacks(it) }
        progressRunnable = null
    }
    
    private fun handleDownloadComplete(downloadManager: DownloadManager, onComplete: (File?) -> Unit, onError: (String) -> Unit) {
        // Stop progress monitoring
        stopProgressMonitoring()
        
        val query = DownloadManager.Query().setFilterById(downloadId)
        val cursor = downloadManager.query(query)
        
        if (cursor.moveToFirst()) {
            val statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
            val status = cursor.getInt(statusIndex)
            
            when (status) {
                DownloadManager.STATUS_SUCCESSFUL -> {
                    val apkFile = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), APK_FILE_NAME)
                    if (apkFile.exists()) {
                        Log.d(TAG, "Download complete: ${apkFile.absolutePath}")
                        onComplete(apkFile)
                    } else {
                        onError("Fichier APK introuvable")
                    }
                }
                DownloadManager.STATUS_FAILED -> {
                    val reasonIndex = cursor.getColumnIndex(DownloadManager.COLUMN_REASON)
                    val reason = cursor.getInt(reasonIndex)
                    Log.e(TAG, "Download failed with reason: $reason")
                    onError("Échec du téléchargement (code: $reason)")
                }
                else -> {
                    onError("État de téléchargement inconnu")
                }
            }
        }
        cursor.close()
    }
    
    /**
     * Install the downloaded APK
     */
    fun installUpdate(apkFile: File) {
        try {
            val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    apkFile
                )
            } else {
                Uri.fromFile(apkFile)
            }
            
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            
            context.startActivity(intent)
            Log.d(TAG, "Install intent started for: ${apkFile.absolutePath}")
            
        } catch (e: Exception) {
            Log.e(TAG, "Error installing update", e)
            throw e
        }
    }
    
    /**
     * Skip this version (user chose to skip)
     */
    fun skipVersion(versionCode: Int) {
        prefs.skippedVersion = versionCode
        Log.d(TAG, "Skipping version: $versionCode")
    }
    
    /**
     * Cancel ongoing download
     */
    fun cancelDownload() {
        if (downloadId != -1L) {
            val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            downloadManager.remove(downloadId)
            downloadId = -1L
            Log.d(TAG, "Download cancelled")
        }
    }
}


