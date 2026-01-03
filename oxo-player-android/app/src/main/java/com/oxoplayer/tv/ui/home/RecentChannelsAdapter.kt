package com.oxoplayer.tv.ui.home

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.WatchProgressManager

/**
 * Adapter for displaying recently watched live TV channels
 */
class RecentChannelsAdapter(
    private val channels: List<WatchProgressManager.RecentChannel>,
    private val onChannelClick: (WatchProgressManager.RecentChannel) -> Unit
) : RecyclerView.Adapter<RecentChannelsAdapter.ViewHolder>() {
    
    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val cardView: CardView = view.findViewById(R.id.cardView)
        val logoImage: ImageView = view.findViewById(R.id.logoImage)
        val channelName: TextView = view.findViewById(R.id.channelName)
        val categoryText: TextView = view.findViewById(R.id.categoryText)
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_recent_channel, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val channel = channels[position]
        
        holder.channelName.text = channel.name
        holder.categoryText.text = channel.category ?: "Live TV"
        
        // Load logo
        if (!channel.logo.isNullOrEmpty()) {
            Glide.with(holder.itemView.context)
                .load(channel.logo)
                .placeholder(R.drawable.default_card_image)
                .error(R.drawable.default_card_image)
                .centerInside()
                .into(holder.logoImage)
        } else {
            holder.logoImage.setImageResource(R.drawable.default_card_image)
        }
        
        // Click listener
        holder.cardView.setOnClickListener {
            onChannelClick(channel)
        }
        
        // Focus animation
        holder.cardView.setOnFocusChangeListener { v, hasFocus ->
            v.animate()
                .scaleX(if (hasFocus) 1.08f else 1.0f)
                .scaleY(if (hasFocus) 1.08f else 1.0f)
                .setDuration(200)
                .start()
            
            (v as CardView).cardElevation = if (hasFocus) 16f else 8f
        }
    }
    
    override fun getItemCount() = channels.size
}







