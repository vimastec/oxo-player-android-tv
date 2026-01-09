package com.oxoplayer.tv.ui.series

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.Episode

/**
 * Adapter for displaying episodes in a vertical list
 */
class EpisodesAdapter(
    private val episodes: List<Episode>,
    private val onEpisodeClick: (Episode) -> Unit
) : RecyclerView.Adapter<EpisodesAdapter.ViewHolder>() {
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val episodeThumbnail: ImageView = view.findViewById(R.id.episodeThumbnail)
        val episodeNumber: TextView = view.findViewById(R.id.episodeNumber)
        val episodeName: TextView = view.findViewById(R.id.episodeName)
        
        fun bind(episode: Episode) {
            episodeNumber.text = "Épisode ${episode.episodeNumber}"
            episodeName.text = episode.name
            
            // Load episode thumbnail
            if (!episode.cover.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(episode.cover)
                    .placeholder(R.drawable.placeholder_series)
                    .error(R.drawable.placeholder_series)
                    .into(episodeThumbnail)
            } else {
                episodeThumbnail.setImageResource(R.drawable.placeholder_series)
            }
            
            itemView.setOnClickListener {
                onEpisodeClick(episode)
            }
            
            // Focus handling for TV
            itemView.isFocusable = true
            itemView.isFocusableInTouchMode = false
        }
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_episode, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(episodes[position])
    }
    
    override fun getItemCount() = episodes.size
}















