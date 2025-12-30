package com.oxoplayer.tv.ui.home

import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions
import com.oxoplayer.tv.R

/**
 * Data class for Top 10 items
 */
data class Top10Item(
    val rank: Int,                    // 1-10
    val title: String,
    val posterUrl: String?,
    val xtreamId: Int,                // Xtream stream_id or series_id
    val isMovie: Boolean,             // true = movie, false = series
    val badge: String? = null,        // "New Episode", "Recently Added", etc.
    // Extra data for direct navigation
    val streamIcon: String? = null,   // For movies
    val cover: String? = null,        // For series
    val containerExtension: String? = null // For movies (mp4, mkv, etc.)
)

/**
 * Adapter for Top 10 Netflix-style row
 */
class Top10Adapter(
    private val items: MutableList<Top10Item> = mutableListOf(),
    private val onItemClick: (Top10Item) -> Unit
) : RecyclerView.Adapter<Top10Adapter.Top10ViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Top10ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_top10, parent, false)
        return Top10ViewHolder(view)
    }

    override fun onBindViewHolder(holder: Top10ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    fun updateItems(newItems: List<Top10Item>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }

    inner class Top10ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvRankNumber: TextView = itemView.findViewById(R.id.tvRankNumber)
        private val ivPoster: ImageView = itemView.findViewById(R.id.ivPoster)
        private val tvBadge: TextView = itemView.findViewById(R.id.tvBadge)
        private val cardPoster: CardView = itemView.findViewById(R.id.cardPoster)
        private val focusBorder: View = itemView.findViewById(R.id.focusBorder)

        fun bind(item: Top10Item) {
            // Set rank number with stroke effect
            tvRankNumber.text = item.rank.toString()
            
            // Apply stroke effect to number (outline style like Netflix)
            tvRankNumber.apply {
                setTextColor(Color.TRANSPARENT)
                paint.strokeWidth = 4f
                paint.style = Paint.Style.STROKE
                setTextColor(Color.parseColor("#404040"))
                setShadowLayer(0f, 0f, 0f, Color.TRANSPARENT)
            }

            // Load poster
            if (!item.posterUrl.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(item.posterUrl)
                    .transition(DrawableTransitionOptions.withCrossFade())
                    .centerCrop()
                    .placeholder(R.drawable.placeholder_poster)
                    .error(R.drawable.placeholder_poster)
                    .into(ivPoster)
            }

            // Show badge if available
            if (!item.badge.isNullOrEmpty()) {
                tvBadge.text = item.badge
                tvBadge.visibility = View.VISIBLE
            } else {
                tvBadge.visibility = View.GONE
            }

            // Click listener
            itemView.setOnClickListener {
                onItemClick(item)
            }

            // Focus handling for TV remote - Netflix style with bigger scale and white border
            itemView.setOnFocusChangeListener { v, hasFocus ->
                if (hasFocus) {
                    // Scale up the entire item
                    itemView.animate()
                        .scaleX(1.15f)
                        .scaleY(1.15f)
                        .setDuration(200)
                        .start()
                    // Increase elevation for shadow effect
                    cardPoster.cardElevation = 24f
                    // Show white border
                    focusBorder.visibility = View.VISIBLE
                    // Make rank number more visible on focus
                    tvRankNumber.setTextColor(Color.parseColor("#666666"))
                } else {
                    // Scale back to normal
                    itemView.animate()
                        .scaleX(1.0f)
                        .scaleY(1.0f)
                        .setDuration(200)
                        .start()
                    // Reset elevation
                    cardPoster.cardElevation = 8f
                    // Hide border
                    focusBorder.visibility = View.GONE
                    // Reset rank number color
                    tvRankNumber.setTextColor(Color.parseColor("#404040"))
                }
            }
        }
    }
}