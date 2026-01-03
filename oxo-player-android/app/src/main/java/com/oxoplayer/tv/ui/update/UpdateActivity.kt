package com.oxoplayer.tv.ui.update

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.oxoplayer.tv.BuildConfig
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.AppVersionInfo
import com.oxoplayer.tv.data.update.UpdateManager
import com.oxoplayer.tv.ui.intro.IntroActivity
import java.io.File

class UpdateActivity : AppCompatActivity() {
    
    companion object {
        const val EXTRA_VERSION_INFO = "version_info"
        const val EXTRA_IS_MANDATORY = "is_mandatory"
        private const val TAG = "UpdateActivity"
    }
    
    private lateinit var updateManager: UpdateManager
    private var versionInfo: AppVersionInfo? = null
    private var isMandatory: Boolean = false
    private var downloadedApk: File? = null
    private var isWaitingForInstall: Boolean = false
    private val handler = Handler(Looper.getMainLooper())
    
    // Views
    private lateinit var titleText: TextView
    private lateinit var currentVersionText: TextView
    private lateinit var newVersionText: TextView
    private lateinit var changelogText: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var progressText: TextView
    private lateinit var downloadButton: Button
    private lateinit var installButton: Button
    private lateinit var laterButton: Button
    private lateinit var statusText: TextView
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_update)
        
        updateManager = UpdateManager(this)
        
        // Get intent extras
        versionInfo = intent.getSerializableExtra(EXTRA_VERSION_INFO) as? AppVersionInfo
        isMandatory = intent.getBooleanExtra(EXTRA_IS_MANDATORY, false)
        
        if (versionInfo == null) {
            finish()
            return
        }
        
        initViews()
        setupUI()
    }
    
    private fun initViews() {
        titleText = findViewById(R.id.titleText)
        currentVersionText = findViewById(R.id.currentVersionText)
        newVersionText = findViewById(R.id.newVersionText)
        changelogText = findViewById(R.id.changelogText)
        progressBar = findViewById(R.id.progressBar)
        progressText = findViewById(R.id.progressText)
        downloadButton = findViewById(R.id.downloadButton)
        installButton = findViewById(R.id.installButton)
        laterButton = findViewById(R.id.laterButton)
        statusText = findViewById(R.id.statusText)
    }
    
    private fun setupUI() {
        val info = versionInfo ?: return
        
        // Set version info
        currentVersionText.text = "Version actuelle: ${BuildConfig.VERSION_NAME}"
        newVersionText.text = "Nouvelle version: ${info.versionName}"
        
        // Set changelog
        if (!info.changelog.isNullOrBlank()) {
            changelogText.text = info.changelog
            changelogText.visibility = View.VISIBLE
        } else {
            changelogText.visibility = View.GONE
        }
        
        // Set title based on mandatory status
        if (isMandatory) {
            titleText.text = "⚠️ Mise à jour obligatoire"
            laterButton.visibility = View.GONE
        } else {
            titleText.text = "🎉 Nouvelle version disponible"
            laterButton.visibility = View.VISIBLE
        }
        
        // Initial state
        progressBar.visibility = View.GONE
        progressText.visibility = View.GONE
        installButton.visibility = View.GONE
        statusText.visibility = View.GONE
        
        // Button click listeners
        downloadButton.setOnClickListener { startDownload() }
        installButton.setOnClickListener { installUpdate() }
        laterButton.setOnClickListener { skipUpdate() }
        
        // Focus on download button
        downloadButton.requestFocus()
    }
    
    private fun startDownload() {
        val info = versionInfo ?: return
        
        // Show progress
        downloadButton.visibility = View.GONE
        laterButton.visibility = View.GONE
        progressBar.visibility = View.VISIBLE
        progressText.visibility = View.VISIBLE
        statusText.visibility = View.VISIBLE
        statusText.text = "Téléchargement en cours..."
        
        progressBar.isIndeterminate = false
        progressBar.progress = 0
        
        updateManager.downloadUpdate(
            versionInfo = info,
            onProgress = { progress ->
                runOnUiThread {
                    progressBar.progress = progress
                    progressText.text = "$progress%"
                }
            },
            onComplete = { apkFile ->
                runOnUiThread {
                    if (apkFile != null) {
                        downloadedApk = apkFile
                        showInstallReady()
                    } else {
                        showError("Fichier APK introuvable")
                    }
                }
            },
            onError = { error ->
                runOnUiThread {
                    showError(error)
                }
            }
        )
    }
    
    private fun showInstallReady() {
        progressBar.visibility = View.GONE
        progressText.visibility = View.GONE
        statusText.text = "✅ Téléchargement terminé"
        statusText.visibility = View.VISIBLE
        
        installButton.visibility = View.VISIBLE
        installButton.requestFocus()
        
        if (!isMandatory) {
            laterButton.visibility = View.VISIBLE
            laterButton.text = "Plus tard"
        }
    }
    
    private fun showError(message: String) {
        progressBar.visibility = View.GONE
        progressText.visibility = View.GONE
        statusText.text = "❌ Erreur: $message"
        statusText.visibility = View.VISIBLE
        
        downloadButton.text = "Réessayer"
        downloadButton.visibility = View.VISIBLE
        downloadButton.requestFocus()
        
        if (!isMandatory) {
            laterButton.visibility = View.VISIBLE
        }
    }
    
    private fun installUpdate() {
        downloadedApk?.let { apk ->
            try {
                // Save pending install state to SharedPreferences
                val prefs = getSharedPreferences("update_prefs", MODE_PRIVATE)
                prefs.edit()
                    .putBoolean("pending_install", true)
                    .putInt("target_version", versionInfo?.versionCode ?: 0)
                    .apply()
                
                isWaitingForInstall = true
                statusText.text = "Installation en cours..."
                installButton.visibility = View.GONE
                updateManager.installUpdate(apk)
            } catch (e: Exception) {
                clearPendingInstall()
                isWaitingForInstall = false
                showError("Impossible d'installer: ${e.message}")
            }
        }
    }
    
    override fun onResume() {
        super.onResume()
        
        // Check if we were waiting for install
        val prefs = getSharedPreferences("update_prefs", MODE_PRIVATE)
        val pendingInstall = prefs.getBoolean("pending_install", false)
        val targetVersion = prefs.getInt("target_version", 0)
        
        Log.d(TAG, "onResume - pendingInstall: $pendingInstall, targetVersion: $targetVersion, currentVersion: ${BuildConfig.VERSION_CODE}")
        
        if (pendingInstall || isWaitingForInstall) {
            // Give Android a moment
            handler.postDelayed({
                checkIfUpdateInstalled(targetVersion)
            }, 500)
        }
    }
    
    private fun checkIfUpdateInstalled(targetVersionCode: Int) {
        val currentVersionCode = BuildConfig.VERSION_CODE
        
        Log.d(TAG, "Checking install - Current: $currentVersionCode, Target: $targetVersionCode")
        
        if (targetVersionCode > 0 && currentVersionCode >= targetVersionCode) {
            // Update was installed successfully
            Log.d(TAG, "Update installed successfully! Clearing state and restarting...")
            clearPendingInstall()
            restartApp()
        } else {
            // User cancelled installation or it failed - show install button again
            Log.d(TAG, "Update not installed yet, showing install button")
            isWaitingForInstall = false
            statusText.text = "✅ Prêt à installer"
            installButton.visibility = View.VISIBLE
            installButton.requestFocus()
        }
    }
    
    private fun clearPendingInstall() {
        val prefs = getSharedPreferences("update_prefs", MODE_PRIVATE)
        prefs.edit()
            .remove("pending_install")
            .remove("target_version")
            .apply()
    }
    
    private fun restartApp() {
        Log.d(TAG, "Restarting app...")
        clearPendingInstall()
        
        val intent = Intent(this, IntroActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        }
        startActivity(intent)
        finish()
        
        // Force kill to ensure fresh start with new code
        handler.postDelayed({
            android.os.Process.killProcess(android.os.Process.myPid())
        }, 200)
    }
    
    private fun skipUpdate() {
        versionInfo?.let { info ->
            updateManager.skipVersion(info.versionCode)
        }
        finish()
    }
    
    override fun onBackPressed() {
        if (isMandatory) {
            // Don't allow back for mandatory updates
            return
        }
        super.onBackPressed()
    }
    
    override fun onDestroy() {
        super.onDestroy()
        // Cancel download if activity is destroyed
        updateManager.cancelDownload()
    }
}


