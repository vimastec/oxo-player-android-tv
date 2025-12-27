package com.oxoplayer.tv.ui.home

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.WatchProgressManager

/**
 * Adapter for displaying "Continue Watching" items with progress bar
 */
class ContinueWatchingAdapter(
    private val items: List<WatchProgressManager.WatchProgress>,
    private val onItemClick: (WatchProgressManager.WatchProgress) -> Unit
) : RecyclerView.Adapter<ContinueWatchingAdapter.ViewHolder>() {
    
    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val cardView: CardView = view.findViewById(R.id.cardView)
        val coverImage: ImageView = view.findViewById(R.id.coverImage)
        val titleText: TextView = view.findViewById(R.id.titleText)
        val progressBar: ProgressBar = view.findViewById(R.id.progressBar)
        val progressText: TextView = view.findViewById(R.id.progressText)
        val playIcon: ImageView = view.findViewById(R.id.playIcon)
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_continue_watching, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        
        holder.titleText.text = item.title
        
        // Set progress bar
        holder.progressBar.progress = (item.progressPercent * 100).toInt()
        
        // Format remaining time
        val remainingMs = item.durationMs - item.positionMs
        holder.progressText.text = "${WatchProgressManager.formatTime(remainingMs)} restant"
        
        // Load cover image if available
        if (!item.cover.isNullOrEmpty()) {
            Glide.with(holder.itemView.context)
                .load(item.cover)
                .placeholder(R.drawable.default_card_image)
                .error(R.drawable.default_card_image)
                .centerCrop()
                .into(holder.coverImage)
        } else {
            holder.coverImage.setImageResource(R.drawable.default_card_image)
        }
        
        // Click listener
        holder.cardView.setOnClickListener {
            onItemClick(item)
        }
        
        // Focus animation
        holder.cardView.setOnFocusChangeListener { v, hasFocus ->
            v.animate()
                .scaleX(if (hasFocus) 1.08f else 1.0f)
                .scaleY(if (hasFocus) 1.08f else 1.0f)
                .setDuration(200)
                .start()
            
            (v as CardView).cardElevation = if (hasFocus) 16f else 8f
            holder.playIcon.visibility = if (hasFocus) View.VISIBLE else View.GONE
        }
    }
    
    override fun getItemCount() = items.size
}



