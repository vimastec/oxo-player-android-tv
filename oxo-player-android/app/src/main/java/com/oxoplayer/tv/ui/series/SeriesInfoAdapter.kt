package com.oxoplayer.tv.ui.series

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.SeriesInfo

/**
 * Adapter for displaying series info in a grid
 */
class SeriesInfoAdapter(
    private val seriesList: List<SeriesInfo>,
    private val onSeriesClick: (SeriesInfo) -> Unit
) : RecyclerView.Adapter<SeriesInfoAdapter.ViewHolder>() {
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val cover: ImageView = view.findViewById(R.id.seriesCover)
        val name: TextView = view.findViewById(R.id.seriesName)
        val info: TextView = view.findViewById(R.id.seriesInfo)
        
        fun bind(series: SeriesInfo) {
            name.text = series.name
            info.text = "${series.totalSeasons} saisons • ${series.totalEpisodes} épisodes"
            
            // Load cover image
            if (!series.cover.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(series.cover)
                    .placeholder(R.drawable.placeholder_series)
                    .error(R.drawable.placeholder_series)
                    .into(cover)
            } else {
                cover.setImageResource(R.drawable.placeholder_series)
            }
            
            itemView.setOnClickListener {
                onSeriesClick(series)
            }
            
            // Focus handling for TV
            itemView.isFocusable = true
            itemView.isFocusableInTouchMode = false
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















