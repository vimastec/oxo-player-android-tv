package com.oxoplayer.tv.ui.movies

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
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

