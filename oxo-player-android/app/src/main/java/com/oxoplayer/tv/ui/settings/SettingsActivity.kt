package com.oxoplayer.tv.ui.settings

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.oxoplayer.tv.OXOApplication
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.DataManager
import com.oxoplayer.tv.data.api.XtreamClient
import com.oxoplayer.tv.data.models.PlaylistItem
import com.oxoplayer.tv.data.models.XtreamCredentials
import com.oxoplayer.tv.data.repository.DeviceRepository
import com.oxoplayer.tv.data.repository.XtreamRepository
import com.oxoplayer.tv.ui.activation.ActivationActivity
import kotlinx.coroutines.launch

class SettingsActivity : AppCompatActivity() {
    
    private lateinit var deviceRepository: DeviceRepository
    private lateinit var currentPlaylistName: TextView
    private var selectedPlaylistId: Int? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        
        deviceRepository = DeviceRepository(this)
        val prefs = OXOApplication.getInstance().preferencesManager
        
        // Display device info
        findViewById<TextView>(R.id.macAddressValue).text = prefs.macAddress ?: "N/A"
        findViewById<TextView>(R.id.deviceKeyValue).text = prefs.deviceKey ?: "------"
        findViewById<TextView>(R.id.statusValue).text = when(prefs.deviceStatus) {
            "active" -> "✅ Actif"
            "trial" -> "⏳ Période d'essai"
            "expired" -> "❌ Expiré"
            else -> prefs.deviceStatus ?: "N/A"
        }
        findViewById<TextView>(R.id.expirationValue).text = prefs.expirationDate ?: "N/A"
        findViewById<TextView>(R.id.daysValue).text = "${prefs.daysRemaining} jours"
        
        // Current playlist name
        currentPlaylistName = findViewById(R.id.currentPlaylistName)
        currentPlaylistName.text = prefs.currentPlaylistName ?: "Playlist par défaut"
        
        // Change playlist button
        findViewById<Button>(R.id.changePlaylistButton).apply {
            setOnClickListener {
                showPlaylistSelector()
            }
            requestFocus()
        }
    }
    
    private fun showPlaylistSelector() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_playlist_selector, null)
        val loadingProgress = dialogView.findViewById<ProgressBar>(R.id.loadingProgress)
        val emptyText = dialogView.findViewById<TextView>(R.id.emptyText)
        val recyclerView = dialogView.findViewById<RecyclerView>(R.id.playlistsRecyclerView)
        
        val dialog = AlertDialog.Builder(this, R.style.Theme_OXOPlayer_Dialog)
            .setView(dialogView)
            .setNegativeButton("Annuler", null)
            .create()
        
        dialog.show()
        
        // Load playlists
        lifecycleScope.launch {
            val result = deviceRepository.getAllPlaylists()
            
            result.onSuccess { response ->
                loadingProgress.visibility = View.GONE
                
                if (response.playlists.isEmpty()) {
                    emptyText.visibility = View.VISIBLE
                } else {
                    recyclerView.visibility = View.VISIBLE
                    recyclerView.layoutManager = LinearLayoutManager(this@SettingsActivity)
                    recyclerView.adapter = PlaylistAdapter(response.playlists) { playlist ->
                        dialog.dismiss()
                        selectPlaylist(playlist)
                    }
                }
            }
            
            result.onFailure { error ->
                loadingProgress.visibility = View.GONE
                emptyText.visibility = View.VISIBLE
                emptyText.text = "Erreur: ${error.message}"
            }
        }
    }
    
    private fun selectPlaylist(playlist: PlaylistItem) {
        // Show loading
        val loadingDialog = AlertDialog.Builder(this, R.style.Theme_OXOPlayer_Dialog)
            .setMessage("Changement de playlist...")
            .setCancelable(false)
            .create()
        loadingDialog.show()
        
        lifecycleScope.launch {
            // First, set this playlist as active in the database
            val setActiveResult = deviceRepository.setActivePlaylist(playlist.id)
            
            setActiveResult.onFailure { error ->
                loadingDialog.dismiss()
                AlertDialog.Builder(this@SettingsActivity, R.style.Theme_OXOPlayer_Dialog)
                    .setTitle("❌ Erreur")
                    .setMessage("Impossible de changer la playlist: ${error.message}")
                    .setPositiveButton("OK", null)
                    .show()
                return@launch
            }
            
            // Then get the playlist details
            val result = deviceRepository.getPlaylistById(playlist.id)
            
            result.onSuccess { playlistResponse ->
                // Save current playlist name
                OXOApplication.getInstance().preferencesManager.currentPlaylistName = playlist.name
                currentPlaylistName.text = playlist.name
                
                // Initialize playlist based on type
                if (playlistResponse.playlistType == "xtream" && playlistResponse.xtream != null) {
                    // Xtream mode
                    val credentials = XtreamCredentials(
                        host = playlistResponse.xtream.host,
                        username = playlistResponse.xtream.username,
                        password = playlistResponse.xtream.password
                    )
                    
                    XtreamClient.initialize(credentials)
                    DataManager.initXtreamCredentials(credentials)
                    
                    // Reload categories
                    loadXtreamCategories()
                } else if (playlistResponse.playlistUrl != null) {
                    // M3U mode - reload from URL
                    val m3uCredentials = com.oxoplayer.tv.data.parser.M3UParser.extractXtreamCredentialsFromUrl(playlistResponse.playlistUrl)
                    
                    if (m3uCredentials != null) {
                        XtreamClient.initialize(m3uCredentials)
                        DataManager.initXtreamCredentials(m3uCredentials)
                        loadXtreamCategories()
                    } else {
                        // Pure M3U - need to reload
                        // For now, restart the app
                        loadingDialog.dismiss()
                        restartApp()
                        return@onSuccess
                    }
                }
                
                loadingDialog.dismiss()
                
                // Show success and restart
                AlertDialog.Builder(this@SettingsActivity, R.style.Theme_OXOPlayer_Dialog)
                    .setTitle("✅ Playlist changée")
                    .setMessage("La playlist \"${playlist.name}\" a été sélectionnée.\n\nL'application va redémarrer pour appliquer les changements.")
                    .setPositiveButton("OK") { _, _ ->
                        restartApp()
                    }
                    .setCancelable(false)
                    .show()
            }
            
            result.onFailure { error ->
                loadingDialog.dismiss()
                AlertDialog.Builder(this@SettingsActivity, R.style.Theme_OXOPlayer_Dialog)
                    .setTitle("❌ Erreur")
                    .setMessage("Impossible de charger la playlist: ${error.message}")
                    .setPositiveButton("OK", null)
                    .show()
            }
        }
    }
    
    private suspend fun loadXtreamCategories() {
        try {
            val xtreamRepo = XtreamRepository()
            
            // Load Live TV categories
            xtreamRepo.getLiveCategories().onSuccess { categories ->
                DataManager.initXtreamLiveCategories(categories)
            }
            
            // Load Movie categories
            xtreamRepo.getMovieCategories().onSuccess { categories ->
                DataManager.initXtreamMovieCategories(categories)
            }
            
            // Load Series categories
            xtreamRepo.getSeriesCategories().onSuccess { categories ->
                DataManager.initXtreamSeriesCategories(categories)
            }
        } catch (e: Exception) {
            android.util.Log.e("SettingsActivity", "Error loading Xtream categories", e)
        }
    }
    
    private fun restartApp() {
        val intent = Intent(this, ActivationActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
    
    // Playlist Adapter
    inner class PlaylistAdapter(
        private val playlists: List<PlaylistItem>,
        private val onPlaylistSelected: (PlaylistItem) -> Unit
    ) : RecyclerView.Adapter<PlaylistAdapter.ViewHolder>() {
        
        inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
            val icon: ImageView = view.findViewById(R.id.playlistIcon)
            val name: TextView = view.findViewById(R.id.playlistName)
            val type: TextView = view.findViewById(R.id.playlistType)
            val activeIndicator: ImageView = view.findViewById(R.id.activeIndicator)
        }
        
        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_playlist_selector, parent, false)
            return ViewHolder(view)
        }
        
        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val playlist = playlists[position]
            
            holder.name.text = playlist.name
            holder.type.text = when(playlist.playlistType) {
                "xtream" -> "📡 Xtream Code"
                else -> "📋 M3U"
            }
            
            holder.activeIndicator.visibility = if (playlist.isActive) View.VISIBLE else View.GONE
            
            holder.itemView.setOnClickListener {
                onPlaylistSelected(playlist)
            }
            
            // Focus handling for TV remote
            holder.itemView.isFocusable = true
            holder.itemView.setOnFocusChangeListener { view, hasFocus ->
                view.setBackgroundColor(
                    if (hasFocus) resources.getColor(R.color.primary, null)
                    else resources.getColor(android.R.color.transparent, null)
                )
            }
        }
        
        override fun getItemCount() = playlists.size
    }
}
