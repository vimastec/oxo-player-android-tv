package com.oxoplayer.tv.ui.movies

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.XtreamMovie

/**
 * Adapter for displaying Xtream movies in a grid
 */
class XtreamMovieAdapter(
    private val moviesList: List<XtreamMovie>,
    private val onMovieClick: (XtreamMovie) -> Unit
) : RecyclerView.Adapter<XtreamMovieAdapter.ViewHolder>() {
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val poster: ImageView = view.findViewById(R.id.moviePoster)
        val name: TextView = view.findViewById(R.id.movieName)
        
        fun bind(movie: XtreamMovie) {
            name.text = movie.name
            
            // Load poster image
            if (!movie.streamIcon.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(movie.streamIcon)
                    .placeholder(R.drawable.placeholder_poster)
                    .error(R.drawable.placeholder_poster)
                    .centerCrop()
                    .into(poster)
            } else {
                poster.setImageResource(R.drawable.placeholder_poster)
            }
            
            itemView.setOnClickListener {
                onMovieClick(movie)
            }
            
            // Focus handling for TV
            itemView.isFocusable = true
            itemView.isFocusableInTouchMode = false
            
            itemView.setOnFocusChangeListener { v, hasFocus ->
                val scale = if (hasFocus) 1.08f else 1.0f
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
            .inflate(R.layout.item_movie, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(moviesList[position])
    }
    
    override fun getItemCount() = moviesList.size
}





