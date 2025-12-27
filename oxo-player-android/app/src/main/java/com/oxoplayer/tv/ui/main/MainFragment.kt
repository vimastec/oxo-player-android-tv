package com.oxoplayer.tv.ui.main

import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.os.Bundle
import android.util.DisplayMetrics
import androidx.leanback.app.BackgroundManager
import androidx.leanback.app.BrowseSupportFragment
import androidx.leanback.widget.*
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.*
import com.oxoplayer.tv.ui.player.PlayerActivity

class MainFragment : BrowseSupportFragment() {
    
    private lateinit var rowsAdapter: ArrayObjectAdapter
    private lateinit var backgroundManager: BackgroundManager
    private var defaultBackground: Drawable? = null
    private lateinit var metrics: DisplayMetrics
    
    override fun onActivityCreated(savedInstanceState: Bundle?) {
        super.onActivityCreated(savedInstanceState)
        
        setupUI()
        setupBackgroundManager()
        setupEventListeners()
        loadContent()
    }
    
    private fun setupUI() {
        title = getString(R.string.app_name)
        headersState = HEADERS_ENABLED
        isHeadersTransitionOnBackEnabled = true
        
        brandColor = resources.getColor(R.color.primary, null)
        searchAffordanceColor = resources.getColor(R.color.secondary, null)
    }
    
    private fun setupBackgroundManager() {
        backgroundManager = BackgroundManager.getInstance(activity)
        backgroundManager.attach(activity?.window)
        defaultBackground = resources.getDrawable(R.drawable.default_background, null)
        metrics = DisplayMetrics()
        activity?.windowManager?.defaultDisplay?.getMetrics(metrics)
    }
    
    private fun setupEventListeners() {
        onItemViewClickedListener = ItemViewClickedListener()
        onItemViewSelectedListener = ItemViewSelectedListener()
    }
    
    fun loadContent() {
        val mainActivity = activity as? MainActivity ?: return
        
        android.util.Log.d("MainFragment", "loadContent() called")
        android.util.Log.d("MainFragment", "Channels: ${mainActivity.channels.size}, Movies: ${mainActivity.movies.size}, Series: ${mainActivity.series.size}")
        
        rowsAdapter = ArrayObjectAdapter(ListRowPresenter())
        
        // Live TV Section
        if (mainActivity.channels.isNotEmpty()) {
            android.util.Log.d("MainFragment", "Adding ${mainActivity.channels.size} channels")
            val channelCategories = mainActivity.channels.groupBy { it.category }
            channelCategories.forEach { (category, channels) ->
                val cardPresenter = CardPresenter()
                val listRowAdapter = ArrayObjectAdapter(cardPresenter)
                
                channels.forEach { channel ->
                    listRowAdapter.add(channel)
                }
                
                val header = HeaderItem(rowsAdapter.size().toLong(), "📺 $category")
                rowsAdapter.add(ListRow(header, listRowAdapter))
            }
        }
        
        // Movies Section
        if (mainActivity.movies.isNotEmpty()) {
            val movieCategories = mainActivity.movies.groupBy { it.category }
            movieCategories.forEach { (category, movies) ->
                val cardPresenter = CardPresenter()
                val listRowAdapter = ArrayObjectAdapter(cardPresenter)
                
                movies.forEach { movie ->
                    listRowAdapter.add(movie)
                }
                
                val header = HeaderItem(rowsAdapter.size().toLong(), "🎬 $category")
                rowsAdapter.add(ListRow(header, listRowAdapter))
            }
        }
        
        // Series Section
        if (mainActivity.series.isNotEmpty()) {
            val seriesCategories = mainActivity.series.groupBy { it.category }
            seriesCategories.forEach { (category, seriesList) ->
                val cardPresenter = CardPresenter()
                val listRowAdapter = ArrayObjectAdapter(cardPresenter)
                
                seriesList.forEach { series ->
                    listRowAdapter.add(series)
                }
                
                val header = HeaderItem(rowsAdapter.size().toLong(), "📺 $category")
                rowsAdapter.add(ListRow(header, listRowAdapter))
            }
        }
        
        // Settings Row
        val settingsPresenter = CardPresenter()
        val settingsAdapter = ArrayObjectAdapter(settingsPresenter)
        settingsAdapter.add(SettingsItem("⚙️ Paramètres", "Configuration de l'application"))
        settingsAdapter.add(SettingsItem("🔄 Actualiser", "Recharger la playlist"))
        
        val settingsHeader = HeaderItem(rowsAdapter.size().toLong(), "Paramètres")
        rowsAdapter.add(ListRow(settingsHeader, settingsAdapter))
        
        android.util.Log.d("MainFragment", "Total rows added: ${rowsAdapter.size()}")
        
        adapter = rowsAdapter
    }
    
    private inner class ItemViewClickedListener : OnItemViewClickedListener {
        override fun onItemClicked(
            itemViewHolder: Presenter.ViewHolder?,
            item: Any?,
            rowViewHolder: RowPresenter.ViewHolder?,
            row: Row?
        ) {
            when (item) {
                is Channel -> {
                    val intent = Intent(activity, PlayerActivity::class.java)
                    intent.putExtra("STREAM_URL", item.streamUrl)
                    intent.putExtra("TITLE", item.name)
                    intent.putExtra("TYPE", "LIVE")
                    startActivity(intent)
                }
                is Movie -> {
                    val intent = Intent(activity, PlayerActivity::class.java)
                    intent.putExtra("STREAM_URL", item.streamUrl)
                    intent.putExtra("TITLE", item.name)
                    intent.putExtra("TYPE", "MOVIE")
                    startActivity(intent)
                }
                is Series -> {
                    // Navigate to series details
                    // TODO: Implement SeriesDetailsActivity
                }
                is SettingsItem -> {
                    when (item.title) {
                        "🔄 Actualiser" -> {
                            (activity as? MainActivity)?.refreshPlaylist()
                        }
                    }
                }
            }
        }
    }
    
    private inner class ItemViewSelectedListener : OnItemViewSelectedListener {
        override fun onItemSelected(
            itemViewHolder: Presenter.ViewHolder?,
            item: Any?,
            rowViewHolder: RowPresenter.ViewHolder?,
            row: Row?
        ) {
            // Update background when item is selected
            // You can load channel/movie cover here
        }
    }
    
    data class SettingsItem(
        val title: String,
        val description: String
    )
}

