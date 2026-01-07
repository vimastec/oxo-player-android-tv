package com.oxoplayer.tv.ui.series

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.Series

class SeriesAdapter(
    private val series: List<Series>,
    private val onSeriesClick: (Series) -> Unit
) : RecyclerView.Adapter<SeriesAdapter.ViewHolder>() {
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val card: CardView = view.findViewById(R.id.movieCard)
        val poster: ImageView = view.findViewById(R.id.moviePoster)
        val name: TextView = view.findViewById(R.id.movieName)
        
        fun bind(series: Series) {
            name.text = series.name
            
            if (!series.cover.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(series.cover)
                    .centerCrop()
                    .placeholder(R.drawable.default_card_image)
                    .error(R.drawable.default_card_image)
                    .into(poster)
            } else {
                poster.setImageResource(R.drawable.default_card_image)
            }
            
            card.setOnClickListener {
                onSeriesClick(series)
            }
        }
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_movie, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(series[position])
    }
    
    override fun getItemCount() = series.size
}
















