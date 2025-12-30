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
import com.oxoplayer.tv.data.models.Movie
import com.oxoplayer.tv.data.models.Series

/**
 * Netflix-style adapter for movies and series
 */
class ContentAdapter(
    private val items: List<Any>,
    private val onItemClick: (Any) -> Unit
) : RecyclerView.Adapter<ContentAdapter.ContentViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ContentViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_content_card, parent, false)
        return ContentViewHolder(view)
    }

    override fun onBindViewHolder(holder: ContentViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount() = items.size

    inner class ContentViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val card: CardView = itemView.findViewById(R.id.contentCard)
        private val posterImage: ImageView = itemView.findViewById(R.id.posterImage)
        private val titleText: TextView = itemView.findViewById(R.id.titleText)

        fun bind(item: Any) {
            when (item) {
                is Movie -> {
                    titleText.text = item.name
                    Log.d("ContentAdapter", "Binding Movie: ${item.name}, Cover: ${item.cover}")
                    
                    // Load poster image with Glide - Use OXO logo as fallback
                    if (!item.cover.isNullOrEmpty()) {
                        Glide.with(itemView.context)
                            .load(item.cover)
                            .centerCrop()
                            .placeholder(R.drawable.oxo_logo)
                            .error(R.drawable.oxo_logo)
                            .diskCacheStrategy(DiskCacheStrategy.ALL)
                            .into(posterImage)
                    } else {
                        Log.w("ContentAdapter", "Movie ${item.name} has no cover - using OXO logo")
                        posterImage.setImageResource(R.drawable.oxo_logo)
                    }
                }
                is Series -> {
                    titleText.text = item.name
                    Log.d("ContentAdapter", "Binding Series: ${item.name}, Cover: ${item.cover}")
                    
                    // Load poster image with Glide - Use OXO logo as fallback
                    if (!item.cover.isNullOrEmpty()) {
                        Glide.with(itemView.context)
                            .load(item.cover)
                            .centerCrop()
                            .placeholder(R.drawable.oxo_logo)
                            .error(R.drawable.oxo_logo)
                            .diskCacheStrategy(DiskCacheStrategy.ALL)
                            .into(posterImage)
                    } else {
                        Log.w("ContentAdapter", "Series ${item.name} has no cover - using OXO logo")
                        posterImage.setImageResource(R.drawable.oxo_logo)
                    }
                }
            }

            card.setOnClickListener {
                onItemClick(item)
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
