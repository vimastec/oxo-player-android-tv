package com.oxoplayer.tv.data.auth

import android.content.Context
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Helper class for Firebase Authentication
 * Uses anonymous authentication to get ID tokens for API verification
 */
object FirebaseAuthHelper {
    
    private const val TAG = "FirebaseAuthHelper"
    
    private val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }
    
    /**
     * Get the current Firebase user, signing in anonymously if needed
     */
    suspend fun ensureAuthenticated(): FirebaseUser? = withContext(Dispatchers.IO) {
        try {
            // Check if already signed in
            var user = auth.currentUser
            
            if (user == null) {
                // Sign in anonymously
                Log.d(TAG, "Signing in anonymously...")
                val result = auth.signInAnonymously().await()
                user = result.user
                Log.d(TAG, "Anonymous sign-in successful: ${user?.uid}")
            } else {
                Log.d(TAG, "Already signed in: ${user.uid}")
            }
            
            user
        } catch (e: Exception) {
            Log.e(TAG, "Authentication failed", e)
            null
        }
    }
    
    /**
     * Get a fresh Firebase ID Token for API requests
     * Returns null if authentication fails
     */
    suspend fun getIdToken(forceRefresh: Boolean = false): String? = withContext(Dispatchers.IO) {
        try {
            val user = ensureAuthenticated() ?: return@withContext null
            
            // Get the ID token
            val tokenResult = user.getIdToken(forceRefresh).await()
            val token = tokenResult.token
            
            Log.d(TAG, "Got ID token: ${token?.take(20)}...")
            token
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get ID token", e)
            null
        }
    }
    
    /**
     * Check if user is currently authenticated
     */
    fun isAuthenticated(): Boolean = auth.currentUser != null
    
    /**
     * Get current user UID
     */
    fun getCurrentUserId(): String? = auth.currentUser?.uid
    
    /**
     * Sign out (rarely needed for anonymous auth)
     */
    fun signOut() {
        auth.signOut()
        Log.d(TAG, "Signed out")
    }
}


