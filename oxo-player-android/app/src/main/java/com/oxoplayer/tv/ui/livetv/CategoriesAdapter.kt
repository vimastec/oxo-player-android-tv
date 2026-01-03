package com.oxoplayer.tv.ui.livetv

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.RecyclerView
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.Category

class CategoriesAdapter(
    private val categories: List<Category>,
    private val onCategoryClick: (Category) -> Unit
) : RecyclerView.Adapter<CategoriesAdapter.ViewHolder>() {
    
    private var selectedPosition = 0
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val card: CardView = view.findViewById(R.id.categoryCard)
        val name: TextView = view.findViewById(R.id.categoryName)
        
        fun bind(category: Category, position: Int) {
            name.text = category.name
            
            // Highlight selected category
            card.setCardBackgroundColor(
                if (position == selectedPosition) {
                    itemView.context.getColor(R.color.category_selected)
                } else {
                    itemView.context.getColor(R.color.category_normal)
                }
            )
            
            card.setOnClickListener {
                val oldPosition = selectedPosition
                selectedPosition = position
                notifyItemChanged(oldPosition)
                notifyItemChanged(position)
                onCategoryClick(category)
            }
            
            card.setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    val oldPosition = selectedPosition
                    selectedPosition = position
                    notifyItemChanged(oldPosition)
                    notifyItemChanged(position)
                    onCategoryClick(category)
                }
            }
        }
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_category, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(categories[position], position)
    }
    
    override fun getItemCount() = categories.size
}















