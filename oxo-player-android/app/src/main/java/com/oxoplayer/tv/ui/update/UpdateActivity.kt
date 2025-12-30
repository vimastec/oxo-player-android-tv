package com.oxoplayer.tv.ui.update

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.oxoplayer.tv.BuildConfig
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.LatestVersionInfo
import com.oxoplayer.tv.data.update.UpdateManager
import com.oxoplayer.tv.ui.activation.ActivationActivity
import kotlinx.coroutines.launch

/**
 * UpdateActivity - Shows update dialog and handles download/install
 * 
 * Extras:
 * - EXTRA_VERSION_NAME: New version name
 * - EXTRA_VERSION_CODE: New version code
 * - EXTRA_DOWNLOAD_URL: APK download URL
 * - EXTRA_CHANGELOG: What's new
 * - EXTRA_IS_MANDATORY: If true, user cannot skip
 */
class UpdateActivity : AppCompatActivity() {
    
    companion object {
        const val EXTRA_VERSION_NAME = "version_name"
        const val EXTRA_VERSION_CODE = "version_code"
        const val EXTRA_DOWNLOAD_URL = "download_url"
        const val EXTRA_CHANGELOG = "changelog"
        const val EXTRA_IS_MANDATORY = "is_mandatory"
        
        fun createIntent(
            activity: AppCompatActivity,
            latestVersion: LatestVersionInfo,
            isMandatory: Boolean
        ): Intent {
            return Intent(activity, UpdateActivity::class.java).apply {
                putExtra(EXTRA_VERSION_NAME, latestVersion.versionName)
                putExtra(EXTRA_VERSION_CODE, latestVersion.versionCode)
                putExtra(EXTRA_DOWNLOAD_URL, latestVersion.downloadUrl)
                putExtra(EXTRA_CHANGELOG, latestVersion.changelog)
                putExtra(EXTRA_IS_MANDATORY, isMandatory)
            }
        }
    }
    
    private lateinit var titleText: TextView
    private lateinit var currentVersionText: TextView
    private lateinit var newVersionText: TextView
    private lateinit var changelogText: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var progressText: TextView
    private lateinit var updateButton: Button
    private lateinit var laterButton: Button
    
    private var versionName: String = ""
    private var versionCode: Int = 0
    private var downloadUrl: String = ""
    private var changelog: String = ""
    private var isMandatory: Boolean = false
    
    private var isDownloading = false
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_update)
        
        // Get extras
        versionName = intent.getStringExtra(EXTRA_VERSION_NAME) ?: ""
        versionCode = intent.getIntExtra(EXTRA_VERSION_CODE, 0)
        downloadUrl = intent.getStringExtra(EXTRA_DOWNLOAD_URL) ?: ""
        changelog = intent.getStringExtra(EXTRA_CHANGELOG) ?: ""
        isMandatory = intent.getBooleanExtra(EXTRA_IS_MANDATORY, false)
        
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
        updateButton = findViewById(R.id.updateButton)
        laterButton = findViewById(R.id.laterButton)
        
        updateButton.setOnClickListener { startDownload() }
        laterButton.setOnClickListener { skipUpdate() }
    }
    
    private fun setupUI() {
        // Set version info
        currentVersionText.text = "Version actuelle : v${BuildConfig.VERSION_NAME}"
        newVersionText.text = "Nouvelle version : v$versionName"
        
        // Set changelog
        if (changelog.isNotEmpty()) {
            changelogText.text = changelog
            changelogText.visibility = View.VISIBLE
        } else {
            changelogText.visibility = View.GONE
        }
        
        // Hide progress initially
        progressBar.visibility = View.GONE
        progressText.visibility = View.GONE
        
        // Handle mandatory update
        if (isMandatory) {
            titleText.text = "🔴 Mise à jour obligatoire"
            laterButton.visibility = View.GONE
        } else {
            titleText.text = "🆕 Mise à jour disponible"
            laterButton.visibility = View.VISIBLE
        }
        
        // Focus on update button
        updateButton.requestFocus()
    }
    
    private fun startDownload() {
        if (isDownloading) return
        isDownloading = true
        
        // Update UI
        updateButton.isEnabled = false
        updateButton.text = "Téléchargement..."
        laterButton.visibility = View.GONE
        progressBar.visibility = View.VISIBLE
        progressBar.isIndeterminate = true
        progressText.visibility = View.VISIBLE
        progressText.text = "Téléchargement en cours..."
        
        // Start download
        UpdateManager.downloadUpdate(
            context = this,
            downloadUrl = downloadUrl,
            versionName = versionName
        ) { success ->
            runOnUiThread {
                if (success) {
                    onDownloadComplete()
                } else {
                    onDownloadFailed()
                }
            }
        }
    }
    
    private fun onDownloadComplete() {
        progressBar.visibility = View.GONE
        progressText.text = "✅ Téléchargement terminé !"
        updateButton.text = "Installer maintenant"
        updateButton.isEnabled = true
        
        updateButton.setOnClickListener {
            UpdateManager.installUpdate(this)
        }
        
        updateButton.requestFocus()
    }
    
    private fun onDownloadFailed() {
        isDownloading = false
        progressBar.visibility = View.GONE
        progressText.text = "❌ Échec du téléchargement"
        updateButton.text = "Réessayer"
        updateButton.isEnabled = true
        
        if (!isMandatory) {
            laterButton.visibility = View.VISIBLE
        }
        
        updateButton.setOnClickListener { startDownload() }
    }
    
    private fun skipUpdate() {
        if (isMandatory) {
            // Cannot skip mandatory update
            return
        }
        
        // Go to main app
        navigateToMain()
    }
    
    private fun navigateToMain() {
        val intent = Intent(this, ActivationActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
    
    override fun onBackPressed() {
        if (isMandatory) {
            // Cannot go back on mandatory update
            return
        }
        super.onBackPressed()
    }
}
