package com.oxoplayer.tv.ui.series

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.SeriesCategory

/**
 * Adapter for displaying series categories
 */
class SeriesCategoryAdapter(
    private val categories: List<SeriesCategory>,
    private val onCategoryClick: (SeriesCategory) -> Unit
) : RecyclerView.Adapter<SeriesCategoryAdapter.ViewHolder>() {
    
    private var selectedPosition = 0
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val name: TextView = view.findViewById(R.id.categoryName)
        val count: TextView = view.findViewById(R.id.categoryCount)
        
        fun bind(category: SeriesCategory, position: Int) {
            name.text = category.name
            count.text = "${category.seriesList.size} séries"
            
            // Highlight selected category
            itemView.setBackgroundResource(
                if (position == selectedPosition) 
                    R.drawable.item_category_selected 
                else 
                    R.drawable.item_category
            )
            
            itemView.setOnClickListener {
                val oldPosition = selectedPosition
                selectedPosition = position
                notifyItemChanged(oldPosition)
                notifyItemChanged(selectedPosition)
                onCategoryClick(category)
            }
            
            // Focus handling for TV
            itemView.isFocusable = true
            itemView.isFocusableInTouchMode = false
        }
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_series_category, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(categories[position], position)
    }
    
    override fun getItemCount() = categories.size
    
    fun setSelectedPosition(position: Int) {
        val oldPosition = selectedPosition
        selectedPosition = position
        notifyItemChanged(oldPosition)
        notifyItemChanged(selectedPosition)
    }
}







