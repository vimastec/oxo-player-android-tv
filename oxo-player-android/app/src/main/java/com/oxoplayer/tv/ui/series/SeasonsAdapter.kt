package com.oxoplayer.tv.ui.series

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.Season

/**
 * Adapter for displaying seasons horizontally
 */
class SeasonsAdapter(
    private val seasons: List<Season>,
    private var selectedPosition: Int,
    private val onSeasonClick: (Season, Int) -> Unit
) : RecyclerView.Adapter<SeasonsAdapter.ViewHolder>() {
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val seasonName: TextView = view.findViewById(R.id.seasonName)
        
        fun bind(season: Season, position: Int) {
            seasonName.text = "Saison ${season.seasonNumber}"
            
            // Highlight selected season
            itemView.setBackgroundResource(
                if (position == selectedPosition) 
                    R.drawable.item_category_selected 
                else 
                    R.drawable.item_category
            )
            
            itemView.setOnClickListener {
                onSeasonClick(season, position)
            }
            
            // Focus handling for TV
            itemView.isFocusable = true
            itemView.isFocusableInTouchMode = false
        }
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_season, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(seasons[position], position)
    }
    
    override fun getItemCount() = seasons.size
}








