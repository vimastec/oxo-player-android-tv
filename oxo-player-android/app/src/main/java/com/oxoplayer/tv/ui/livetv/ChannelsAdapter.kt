package com.oxoplayer.tv.ui.livetv

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.Channel

class ChannelsAdapter(
    private val channels: List<Channel>,
    private val onChannelClick: (Channel, Int, Boolean) -> Unit
) : RecyclerView.Adapter<ChannelsAdapter.ViewHolder>() {
    
    private var selectedPosition = 0
    private var lastClickTime = 0L
    private var lastClickPosition = -1
    
    // For TV remote double-click detection
    private var lastKeyPressTime = 0L
    private var lastKeyPressPosition = -1
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val card: CardView = view.findViewById(R.id.channelCard)
        val logo: ImageView = view.findViewById(R.id.channelLogo)
        val name: TextView = view.findViewById(R.id.channelName)
        val category: TextView = view.findViewById(R.id.channelCategory)
        
        fun bind(channel: Channel, position: Int) {
            name.text = channel.name
            category.text = channel.category
            
            // Load logo - Use OXO logo as placeholder
            if (!channel.logo.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(channel.logo)
                    .fitCenter()
                    .placeholder(R.drawable.oxo_logo)
                    .error(R.drawable.oxo_logo)
                    .diskCacheStrategy(com.bumptech.glide.load.engine.DiskCacheStrategy.ALL)
                    .into(logo)
            } else {
                logo.setImageResource(R.drawable.oxo_logo)
            }
            
            // Highlight selected
            card.setCardBackgroundColor(
                if (position == selectedPosition) {
                    itemView.context.getColor(R.color.selected_card_background)
                } else {
                    itemView.context.getColor(R.color.default_card_background)
                }
            )
            
            // Handle clicks (for touch input)
            card.setOnClickListener {
                val currentTime = System.currentTimeMillis()
                val isDoubleClick = (position == lastClickPosition && 
                                    currentTime - lastClickTime < 1000) // 1 second window
                
                lastClickTime = currentTime
                lastClickPosition = position
                
                val oldPosition = selectedPosition
                selectedPosition = position
                notifyItemChanged(oldPosition)
                notifyItemChanged(position)
                onChannelClick(channel, position, isDoubleClick)
            }
            
            // Handle focus (for TV remote) - Only visual feedback, no auto-play
            card.setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    card.setCardBackgroundColor(itemView.context.getColor(R.color.selected_card_background))
                    // Only update visual selection, don't play video
                    if (position != selectedPosition) {
                        val oldPosition = selectedPosition
                        selectedPosition = position
                        notifyItemChanged(oldPosition)
                        notifyItemChanged(position)
                        // Don't call onChannelClick here - user must press OK to play
                    }
                } else if (position != selectedPosition) {
                    card.setCardBackgroundColor(itemView.context.getColor(R.color.default_card_background))
                }
            }
            
            // Handle Enter/OK button on TV remote - This plays the channel
            // Double-press detection: 1st press = mini preview, 2nd press = fullscreen
            card.setOnKeyListener { _, keyCode, event ->
                if (event.action == android.view.KeyEvent.ACTION_DOWN &&
                    (keyCode == android.view.KeyEvent.KEYCODE_DPAD_CENTER ||
                     keyCode == android.view.KeyEvent.KEYCODE_ENTER)) {
                    
                    val currentTime = System.currentTimeMillis()
                    val isDoublePress = (currentTime - lastKeyPressTime < 800) && (lastKeyPressPosition == position)
                    lastKeyPressTime = currentTime
                    lastKeyPressPosition = position
                    
                    onChannelClick(channel, position, isDoublePress)
                    true
                } else {
                    false
                }
            }
        }
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_channel, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(channels[position], position)
    }
    
    override fun getItemCount() = channels.size
}


