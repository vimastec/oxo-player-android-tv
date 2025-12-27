package com.oxoplayer.tv.ui.movies

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.OvershootInterpolator
import android.widget.ImageView
import android.widget.TextView
import androidx.cardview.widget.CardView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.Movie

class MoviesAdapter(
    private val movies: List<Movie>,
    private val onMovieClick: (Movie) -> Unit
) : RecyclerView.Adapter<MoviesAdapter.ViewHolder>() {
    
    // Animation constants
    private val SCALE_FOCUSED = 1.15f
    private val SCALE_NORMAL = 1.0f
    private val ELEVATION_FOCUSED = 24f
    private val ELEVATION_NORMAL = 4f
    private val ANIMATION_DURATION = 200L
    
    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val card: CardView = view.findViewById(R.id.movieCard)
        val poster: ImageView = view.findViewById(R.id.moviePoster)
        val name: TextView = view.findViewById(R.id.movieName)
        
        fun bind(movie: Movie) {
            name.text = movie.name
            
            // Load poster
            if (!movie.cover.isNullOrEmpty()) {
                Glide.with(itemView.context)
                    .load(movie.cover)
                    .centerCrop()
                    .placeholder(R.drawable.default_card_image)
                    .error(R.drawable.default_card_image)
                    .into(poster)
            } else {
                poster.setImageResource(R.drawable.default_card_image)
            }
            
            card.setOnClickListener {
                onMovieClick(movie)
            }
            
            // Focus handling for TV - Netflix-style animation
            itemView.isFocusable = true
            itemView.isFocusableInTouchMode = false
            
            itemView.setOnFocusChangeListener { v, hasFocus ->
                if (hasFocus) {
                    // Scale up and bring to front
                    v.animate()
                        .scaleX(SCALE_FOCUSED)
                        .scaleY(SCALE_FOCUSED)
                        .setDuration(ANIMATION_DURATION)
                        .setInterpolator(OvershootInterpolator(1.2f))
                        .start()
                    
                    // Increase elevation to appear on top
                    card.animate()
                        .translationZ(ELEVATION_FOCUSED)
                        .setDuration(ANIMATION_DURATION)
                        .start()
                    
                    // Bring to front in parent
                    v.parent?.let { parent ->
                        (parent as? ViewGroup)?.let { vg ->
                            vg.clipChildren = false
                            vg.clipToPadding = false
                        }
                    }
                } else {
                    // Scale back to normal
                    v.animate()
                        .scaleX(SCALE_NORMAL)
                        .scaleY(SCALE_NORMAL)
                        .setDuration(ANIMATION_DURATION)
                        .setInterpolator(OvershootInterpolator(1.0f))
                        .start()
                    
                    // Reset elevation
                    card.animate()
                        .translationZ(ELEVATION_NORMAL)
                        .setDuration(ANIMATION_DURATION)
                        .start()
                }
            }
        }
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_movie, parent, false)
        return ViewHolder(view)
    }
    
    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(movies[position])
    }
    
    override fun getItemCount() = movies.size
}

