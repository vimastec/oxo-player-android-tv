package com.oxoplayer.tv.ui.home

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
import com.oxoplayer.tv.data.models.XtreamSeries

/**
 * Adapter for displaying Xtream series on the home page
 */
class XtreamSeriesHomeAdapter(
    private val seriesList: List<XtreamSeries>,
    private val onSeriesClick: (XtreamSeries) -> Unit
) : RecyclerView.Adapter<XtreamSeriesHomeAdapter.ViewHolder>() {
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val card: CardView = view.findViewById(R.id.contentCard)
        private val posterImage: ImageView = view.findViewById(R.id.posterImage)
        private val titleText: TextView = view.findViewById(R.id.titleText)
        
        fun bind(series: XtreamSeries) {
            titleText.text = series.name
            
            // Load poster image
            if (!series.cover.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(series.cover)
                    .centerCrop()
                    .placeholder(R.drawable.oxo_logo)
                    .error(R.drawable.oxo_logo)
                    .diskCacheStrategy(DiskCacheStrategy.ALL)
                    .into(posterImage)
            } else {
                posterImage.setImageResource(R.drawable.oxo_logo)
            }
            
            card.setOnClickListener {
                onSeriesClick(series)
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
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_content_card, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(seriesList[position])
    }
    
    override fun getItemCount() = seriesList.size
}








