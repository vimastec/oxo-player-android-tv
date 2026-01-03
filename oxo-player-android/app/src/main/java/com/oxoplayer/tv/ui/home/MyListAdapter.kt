package com.oxoplayer.tv.ui.home

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.MyListManager

/**
 * Adapter for displaying "My List" items (movies and series saved for later)
 */
class MyListAdapter(
    private var items: List<MyListManager.MyListItem>,
    private val onItemClick: (MyListManager.MyListItem) -> Unit,
    private val onLongClick: ((MyListManager.MyListItem) -> Unit)? = null
) : RecyclerView.Adapter<MyListAdapter.ViewHolder>() {

    inner class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val poster: ImageView = itemView.findViewById(R.id.itemPoster)
        val title: TextView = itemView.findViewById(R.id.itemTitle)
        val typeIcon: ImageView = itemView.findViewById(R.id.itemTypeIcon)
        
        init {
            itemView.isFocusable = true
            itemView.isFocusableInTouchMode = true
            
            itemView.setOnClickListener {
                val position = adapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onItemClick(items[position])
                }
            }
            
            itemView.setOnLongClickListener {
                val position = adapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onLongClick?.invoke(items[position])
                }
                true
            }
            
            // Focus animation
            itemView.setOnFocusChangeListener { v, hasFocus ->
                val scale = if (hasFocus) 1.1f else 1.0f
                v.animate()
                    .scaleX(scale)
                    .scaleY(scale)
                    .setDuration(150)
                    .start()
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_my_list, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]
        
        holder.title.text = item.title
        
        // Show type icon (movie or series)
        holder.typeIcon.setImageResource(
            if (item.type == "MOVIE") R.drawable.ic_movie else R.drawable.ic_series
        )
        
        // Load poster
        Glide.with(holder.itemView.context)
            .load(item.cover)
            .placeholder(R.drawable.placeholder_poster)
            .error(R.drawable.placeholder_poster)
            .transition(DrawableTransitionOptions.withCrossFade())
            .centerCrop()
            .into(holder.poster)
    }

    override fun getItemCount(): Int = items.size
    
    fun updateItems(newItems: List<MyListManager.MyListItem>) {
        items = newItems
        notifyDataSetChanged()
    }
}

