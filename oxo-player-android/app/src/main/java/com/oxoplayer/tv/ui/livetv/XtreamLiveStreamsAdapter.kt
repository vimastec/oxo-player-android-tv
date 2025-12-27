package com.oxoplayer.tv.ui.livetv

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.XtreamLiveStream

/**
 * Adapter for displaying Xtream Live TV streams/channels
 */
class XtreamLiveStreamsAdapter(
    private val streams: List<XtreamLiveStream>,
    private val onStreamClick: (XtreamLiveStream, Int, Boolean) -> Unit
) : RecyclerView.Adapter<XtreamLiveStreamsAdapter.ViewHolder>() {
    
    private var selectedPosition = 0
    private var lastClickTime = 0L
    private var lastClickedPosition = -1
    
    // For TV remote double-click detection
    private var lastKeyPressTime = 0L
    private var lastKeyPressPosition = -1
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val logo: ImageView = view.findViewById(R.id.channelLogo)
        val name: TextView = view.findViewById(R.id.channelName)
        val category: TextView = view.findViewById(R.id.channelCategory)
        
        fun bind(stream: XtreamLiveStream, position: Int) {
            name.text = stream.name
            category.text = "${stream.num ?: (position + 1)}"
            
            // Load logo - Use OXO logo as placeholder/error image
            if (!stream.streamIcon.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(stream.streamIcon)
                    .placeholder(R.drawable.oxo_logo)
                    .error(R.drawable.oxo_logo)
                    .centerInside()
                    .into(logo)
            } else {
                logo.setImageResource(R.drawable.oxo_logo)
            }
            
            // Highlight selected
            itemView.setBackgroundResource(
                if (position == selectedPosition)
                    R.drawable.item_category_selected
                else
                    R.drawable.item_category
            )
            
            itemView.setOnClickListener {
                val currentTime = System.currentTimeMillis()
                val isDoubleClick = (currentTime - lastClickTime < 500) && (lastClickedPosition == position)
                lastClickTime = currentTime
                lastClickedPosition = position
                
                val oldPosition = selectedPosition
                selectedPosition = position
                notifyItemChanged(oldPosition)
                notifyItemChanged(selectedPosition)
                
                onStreamClick(stream, position, isDoubleClick)
            }
            
            // Focus handling for TV - Only visual feedback, no auto-play
            itemView.isFocusable = true
            itemView.isFocusableInTouchMode = false
            
            itemView.setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    itemView.setBackgroundResource(R.drawable.item_category_selected)
                    // Only update visual selection, don't play video
                    if (position != selectedPosition) {
                        val oldPosition = selectedPosition
                        selectedPosition = position
                        notifyItemChanged(oldPosition)
                        notifyItemChanged(selectedPosition)
                        // Don't call onStreamClick here - user must press OK to play
                    }
                } else if (position != selectedPosition) {
                    itemView.setBackgroundResource(R.drawable.item_category)
                }
            }
            
            // Handle Enter/OK button on TV remote - This plays the channel
            // Double-press detection: 1st press = mini preview, 2nd press = fullscreen
            itemView.setOnKeyListener { _, keyCode, event ->
                if (event.action == android.view.KeyEvent.ACTION_DOWN &&
                    (keyCode == android.view.KeyEvent.KEYCODE_DPAD_CENTER ||
                     keyCode == android.view.KeyEvent.KEYCODE_ENTER)) {
                    
                    val currentTime = System.currentTimeMillis()
                    val isDoublePress = (currentTime - lastKeyPressTime < 800) && (lastKeyPressPosition == position)
                    lastKeyPressTime = currentTime
                    lastKeyPressPosition = position
                    
                    onStreamClick(stream, position, isDoublePress)
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
        holder.bind(streams[position], position)
    }
    
    override fun getItemCount() = streams.size
}


