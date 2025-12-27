package com.oxoplayer.tv.ui.home

import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.Channel

/**
 * Netflix-style adapter for live TV channels
 */
class ChannelAdapter(
    private val channels: List<Channel>,
    private val onChannelClick: (Channel) -> Unit
) : RecyclerView.Adapter<ChannelAdapter.ChannelViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChannelViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_channel_card, parent, false)
        return ChannelViewHolder(view)
    }

    override fun onBindViewHolder(holder: ChannelViewHolder, position: Int) {
        holder.bind(channels[position])
    }

    override fun getItemCount() = channels.size

    inner class ChannelViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val card: CardView = itemView.findViewById(R.id.channelCard)
        private val channelLogo: ImageView = itemView.findViewById(R.id.channelLogo)
        private val channelName: TextView = itemView.findViewById(R.id.channelName)
        private val channelCategory: TextView = itemView.findViewById(R.id.channelCategory)

        fun bind(channel: Channel) {
            channelName.text = channel.name
            channelCategory.text = channel.category
            
            Log.d("ChannelAdapter", "Binding channel: ${channel.name}, Logo URL: ${channel.logo}")
            
            // Load channel logo with Glide - Use OXO logo as placeholder
            if (!channel.logo.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(channel.logo)
                    .fitCenter()
                    .placeholder(R.drawable.oxo_logo)
                    .error(R.drawable.oxo_logo)
                    .diskCacheStrategy(DiskCacheStrategy.ALL)
                    .into(channelLogo)
            } else {
                Log.w("ChannelAdapter", "Channel ${channel.name} has no logo - using OXO logo")
                channelLogo.setImageResource(R.drawable.oxo_logo)
            }

            card.setOnClickListener {
                onChannelClick(channel)
            }

            // Netflix-style focus animation
            card.setOnFocusChangeListener { v, hasFocus ->
                v.animate()
                    .scaleX(if (hasFocus) 1.1f else 1.0f)
                    .scaleY(if (hasFocus) 1.1f else 1.0f)
                    .setDuration(200)
                    .start()
                
                if (v is CardView) {
                    v.cardElevation = if (hasFocus) 16f else 8f
                }
            }
        }
    }
}

