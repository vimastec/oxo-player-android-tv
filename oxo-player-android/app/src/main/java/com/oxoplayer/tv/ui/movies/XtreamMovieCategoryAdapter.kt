package com.oxoplayer.tv.ui.movies

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.XtreamMovieCategory

/**
 * Adapter for displaying Xtream movie categories
 */
class XtreamMovieCategoryAdapter(
    private val categories: List<XtreamMovieCategory>,
    private val onCategoryClick: (XtreamMovieCategory, Int) -> Unit
) : RecyclerView.Adapter<XtreamMovieCategoryAdapter.ViewHolder>() {
    
    private var selectedPosition = 0
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val name: TextView = view.findViewById(R.id.categoryName)
        val count: TextView = view.findViewById(R.id.categoryCount)
        
        fun bind(category: XtreamMovieCategory, position: Int) {
            name.text = category.categoryName
            count.text = "" // Count will be shown when category is selected
            
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
                onCategoryClick(category, position)
            }
            
            // Focus handling for TV
            itemView.isFocusable = true
            itemView.isFocusableInTouchMode = false
            
            itemView.setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    itemView.setBackgroundResource(R.drawable.item_category_selected)
                } else if (position != selectedPosition) {
                    itemView.setBackgroundResource(R.drawable.item_category)
                }
            }
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






