package com.oxoplayer.tv.ui.intro

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.content.Intent
import android.media.MediaPlayer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.oxoplayer.tv.OXOApplication
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.AppVersionInfo
import com.oxoplayer.tv.data.update.UpdateManager
import com.oxoplayer.tv.ui.update.UpdateActivity
import com.oxoplayer.tv.ui.welcome.WelcomeActivity
import kotlinx.coroutines.launch

class IntroActivity : AppCompatActivity() {

    private lateinit var logoImage: ImageView
    private lateinit var dot1: View
    private lateinit var dot2: View
    private lateinit var dot3: View
    private lateinit var versionText: TextView
    private lateinit var updateManager: UpdateManager
    
    private val handler = Handler(Looper.getMainLooper())
    private var hasNavigated = false
    private var animatorSet: AnimatorSet? = null
    private var updateCheckComplete = false
    private var splashComplete = false
    private var pendingUpdateInfo: AppVersionInfo? = null
    private var pendingIsMandatory = false
    private var mediaPlayer: MediaPlayer? = null

    companion object {
        private const val TAG = "IntroActivity"
        private const val SPLASH_DURATION_MS = 7000L // 7 seconds (match audio duration)
    }
    
    private fun clearPendingUpdateState() {
        // Clear update pending state if we just started fresh
        val prefs = getSharedPreferences("update_prefs", MODE_PRIVATE)
        val pendingInstall = prefs.getBoolean("pending_install", false)
        if (pendingInstall) {
            Log.d(TAG, "Clearing pending update state - app started fresh after update")
            prefs.edit()
                .remove("pending_install")
                .remove("target_version")
                .apply()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_intro)

        // Clear any pending update state (in case we just got updated)
        clearPendingUpdateState()

        logoImage = findViewById(R.id.logoImage)
        dot1 = findViewById(R.id.dot1)
        dot2 = findViewById(R.id.dot2)
        dot3 = findViewById(R.id.dot3)
        versionText = findViewById(R.id.versionText)
        updateManager = UpdateManager(this)
        
        // Set version
        versionText.text = "OXO Player TV v${com.oxoplayer.tv.BuildConfig.VERSION_NAME}"

        // Start animations
        startLogoAnimation()
        startLoadingDotsAnimation()
        
        // Play intro audio
        playIntroAudio()

        // Check for updates if auto-update is enabled
        checkForUpdatesIfEnabled()

        // Navigate after splash duration
        handler.postDelayed({
            splashComplete = true
            tryNavigate()
        }, SPLASH_DURATION_MS)
    }
    
    private fun checkForUpdatesIfEnabled() {
        val prefs = OXOApplication.getInstance().preferencesManager
        
        if (!prefs.autoUpdateEnabled) {
            Log.d(TAG, "Auto-update disabled, skipping check")
            updateCheckComplete = true
            return
        }
        
        lifecycleScope.launch {
            try {
                Log.d(TAG, "Checking for updates...")
                val result = updateManager.checkForUpdate(forceCheck = true)
                
                if (result.hasUpdate && result.versionInfo != null) {
                    Log.d(TAG, "Update available: ${result.versionInfo.versionName}")
                    pendingUpdateInfo = result.versionInfo
                    pendingIsMandatory = result.isMandatory
                } else {
                    Log.d(TAG, "No update available or error: ${result.error}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error checking for updates", e)
            } finally {
                updateCheckComplete = true
                tryNavigate()
            }
        }
    }
    
    private fun tryNavigate() {
        // Wait for both splash and update check to complete
        if (!splashComplete || !updateCheckComplete) {
            return
        }
        
        if (pendingUpdateInfo != null) {
            navigateToUpdate(pendingUpdateInfo!!, pendingIsMandatory)
        } else {
            navigateToWelcome()
        }
    }

    private fun playIntroAudio() {
        try {
            mediaPlayer = MediaPlayer.create(this, R.raw.oxointroaudio)
            mediaPlayer?.apply {
                setVolume(1.0f, 1.0f)
                start()
                Log.d(TAG, "Intro audio started")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing intro audio", e)
        }
    }
    
    private fun stopIntroAudio() {
        try {
            mediaPlayer?.apply {
                if (isPlaying) {
                    stop()
                }
                release()
            }
            mediaPlayer = null
            Log.d(TAG, "Intro audio stopped")
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping intro audio", e)
        }
    }

    private fun startLogoAnimation() {
        // Fade in and scale up animation for logo
        logoImage.alpha = 0f
        logoImage.scaleX = 0.8f
        logoImage.scaleY = 0.8f
        
        logoImage.animate()
            .alpha(1f)
            .scaleX(1f)
            .scaleY(1f)
            .setDuration(800)
            .setInterpolator(AccelerateDecelerateInterpolator())
            .start()
    }

    private fun startLoadingDotsAnimation() {
        // Netflix-style pulsing dots animation
        val dots = listOf(dot1, dot2, dot3)
        
        animatorSet = AnimatorSet()
        val animators = mutableListOf<ObjectAnimator>()
        
        dots.forEachIndexed { index, dot ->
            // Scale up animation
            val scaleUpX = ObjectAnimator.ofFloat(dot, "scaleX", 1f, 1.5f, 1f).apply {
                duration = 600
                startDelay = (index * 150).toLong()
                repeatCount = ObjectAnimator.INFINITE
                interpolator = AccelerateDecelerateInterpolator()
            }
            val scaleUpY = ObjectAnimator.ofFloat(dot, "scaleY", 1f, 1.5f, 1f).apply {
                duration = 600
                startDelay = (index * 150).toLong()
                repeatCount = ObjectAnimator.INFINITE
                interpolator = AccelerateDecelerateInterpolator()
            }
            // Alpha animation
            val alpha = ObjectAnimator.ofFloat(dot, "alpha", 0.4f, 1f, 0.4f).apply {
                duration = 600
                startDelay = (index * 150).toLong()
                repeatCount = ObjectAnimator.INFINITE
                interpolator = AccelerateDecelerateInterpolator()
            }
            
            animators.add(scaleUpX)
            animators.add(scaleUpY)
            animators.add(alpha)
        }
        
        animatorSet?.playTogether(animators as Collection<android.animation.Animator>)
        animatorSet?.start()
    }

    private fun navigateToWelcome() {
        if (hasNavigated) return
        hasNavigated = true

        // Stop animations and audio
        animatorSet?.cancel()
        stopIntroAudio()

        // Navigate to WelcomeActivity
        val intent = Intent(this, WelcomeActivity::class.java)
        startActivity(intent)
        
        // Fade out transition
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }
    
    private fun navigateToUpdate(versionInfo: AppVersionInfo, isMandatory: Boolean) {
        if (hasNavigated) return
        hasNavigated = true

        // Stop animations and audio
        animatorSet?.cancel()
        stopIntroAudio()

        // Navigate to UpdateActivity
        val intent = Intent(this, UpdateActivity::class.java).apply {
            putExtra(UpdateActivity.EXTRA_VERSION_INFO, versionInfo)
            putExtra(UpdateActivity.EXTRA_IS_MANDATORY, isMandatory)
        }
        startActivity(intent)
        
        // Fade out transition
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        
        // If not mandatory, still navigate to welcome after update activity
        if (!isMandatory) {
            // Don't finish - let user go back
        } else {
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        animatorSet?.cancel()
        stopIntroAudio()
    }
}
