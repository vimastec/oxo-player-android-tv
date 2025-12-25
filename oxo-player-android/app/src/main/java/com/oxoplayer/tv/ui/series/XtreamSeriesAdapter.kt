package com.oxoplayer.tv.ui.series

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.OvershootInterpolator
import android.widget.ImageView
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.XtreamSeries

/**
 * Adapter for displaying Xtream series in a grid
 */
class XtreamSeriesAdapter(
    private val seriesList: List<XtreamSeries>,
    private val onSeriesClick: (XtreamSeries) -> Unit
) : RecyclerView.Adapter<XtreamSeriesAdapter.ViewHolder>() {
    
    // Animation constants
    private val SCALE_FOCUSED = 1.15f
    private val SCALE_NORMAL = 1.0f
    private val ELEVATION_FOCUSED = 24f
    private val ELEVATION_NORMAL = 4f
    private val ANIMATION_DURATION = 200L
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val card: CardView = view.findViewById(R.id.seriesCard)
        val cover: ImageView = view.findViewById(R.id.seriesCover)
        val name: TextView = view.findViewById(R.id.seriesName)
        val info: TextView = view.findViewById(R.id.seriesInfo)
        
        fun bind(series: XtreamSeries) {
            name.text = series.name
            
            // Show rating if available
            val ratingText = series.rating5Based?.let { 
                String.format("★ %.1f", it) 
            } ?: series.rating?.let { "★ $it" } ?: ""
            
            info.text = ratingText
            info.visibility = if (ratingText.isEmpty()) View.GONE else View.VISIBLE
            
            // Load cover image
            if (!series.cover.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(series.cover)
                    .placeholder(R.drawable.placeholder_series)
                    .error(R.drawable.placeholder_series)
                    .centerCrop()
                    .into(cover)
            } else {
                cover.setImageResource(R.drawable.placeholder_series)
            }
            
            itemView.setOnClickListener {
                onSeriesClick(series)
            }
            
            // Focus handling for TV - Netflix-style animation
            itemView.isFocusable = true
            itemView.isFocusableInTouchMode = false
            
            itemView.setOnFocusChangeListener { v, hasFocus ->
                if (hasFocus) {
                    // Scale up and bring to front
                    v.animate()
                        .scaleX(SCALE_FOCUSED)
                        .scaleY(SCALE_FOCUSED)
                        .setDuration(ANIMATION_DURATION)
                        .setInterpolator(OvershootInterpolator(1.2f))
                        .start()
                    
                    // Increase elevation to appear on top
                    card.animate()
                        .translationZ(ELEVATION_FOCUSED)
                        .setDuration(ANIMATION_DURATION)
                        .start()
                    
                    // Bring to front in parent
                    v.parent?.let { parent ->
                        (parent as? ViewGroup)?.let { vg ->
                            vg.clipChildren = false
                            vg.clipToPadding = false
                        }
                    }
                } else {
                    // Scale back to normal
                    v.animate()
                        .scaleX(SCALE_NORMAL)
                        .scaleY(SCALE_NORMAL)
                        .setDuration(ANIMATION_DURATION)
                        .setInterpolator(OvershootInterpolator(1.0f))
                        .start()
                    
                    // Reset elevation
                    card.animate()
                        .translationZ(ELEVATION_NORMAL)
                        .setDuration(ANIMATION_DURATION)
                        .start()
                }
            }
        }
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_series_info, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(seriesList[position])
    }
    
    override fun getItemCount() = seriesList.size
}






