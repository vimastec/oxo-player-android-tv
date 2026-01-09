package com.oxoplayer.tv.ui.welcome

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.animation.AlphaAnimation
import android.widget.ImageView
import androidx.appcompat.app.AppCompatActivity
import com.oxoplayer.tv.R
import com.oxoplayer.tv.ui.activation.ActivationActivity

class WelcomeActivity : AppCompatActivity() {

    private lateinit var welcomeImage: ImageView
    private val handler = Handler(Looper.getMainLooper())
    private var hasNavigated = false

    companion object {
        private const val DISPLAY_DURATION_MS = 4000L // 4 seconds
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_welcome)

        welcomeImage = findViewById(R.id.welcomeImage)

        // Fade in animation
        val fadeIn = AlphaAnimation(0f, 1f).apply {
            duration = 500
            fillAfter = true
        }
        welcomeImage.startAnimation(fadeIn)

        // Auto-navigate after 4 seconds
        handler.postDelayed({
            navigateToActivation()
        }, DISPLAY_DURATION_MS)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        // Allow skipping with any button press
        when (keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_BUTTON_A,
            KeyEvent.KEYCODE_BACK -> {
                navigateToActivation()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun navigateToActivation() {
        if (hasNavigated) return
        hasNavigated = true

        // Remove pending callbacks
        handler.removeCallbacksAndMessages(null)

        // Navigate to ActivationActivity
        val intent = Intent(this, ActivationActivity::class.java)
        startActivity(intent)

        // Fade out transition
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
    }
}








