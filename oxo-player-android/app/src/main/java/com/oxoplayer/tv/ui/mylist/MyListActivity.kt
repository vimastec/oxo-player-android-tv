package com.oxoplayer.tv.ui.mylist

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.MyListManager
import com.oxoplayer.tv.ui.home.MyListAdapter
import com.oxoplayer.tv.ui.movies.MovieDetailActivity
import com.oxoplayer.tv.ui.series.SeriesDetailActivity

/**
 * Activity to display the user's "My List" - saved movies and series
 * with separate sections for each type
 */
class MyListActivity : AppCompatActivity() {

    private lateinit var moviesSection: LinearLayout
    private lateinit var seriesSection: LinearLayout
    private lateinit var emptyState: LinearLayout
    private lateinit var moviesRecycler: RecyclerView
    private lateinit var seriesRecycler: RecyclerView
    private lateinit var itemCount: TextView

    private var moviesAdapter: MyListAdapter? = null
    private var seriesAdapter: MyListAdapter? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_my_list)

        initViews()
        setupBackButton()
        loadMyList()
    }

    override fun onResume() {
        super.onResume()
        // Refresh list when returning (in case items were added/removed)
        loadMyList()
    }

    private fun initViews() {
        moviesSection = findViewById(R.id.moviesSection)
        seriesSection = findViewById(R.id.seriesSection)
        emptyState = findViewById(R.id.emptyState)
        moviesRecycler = findViewById(R.id.moviesRecycler)
        seriesRecycler = findViewById(R.id.seriesRecycler)
        itemCount = findViewById(R.id.itemCount)

        // Setup RecyclerViews with horizontal layout
        moviesRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        seriesRecycler.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
    }

    private fun setupBackButton() {
        val btnBack = findViewById<ImageView>(R.id.btnBack)
        btnBack.setOnClickListener {
            finish()
        }

        // Focus animation
        btnBack.setOnFocusChangeListener { v, hasFocus ->
            val scale = if (hasFocus) 1.2f else 1.0f
            v.animate()
                .scaleX(scale)
                .scaleY(scale)
                .setDuration(150)
                .start()
        }
    }

    private fun loadMyList() {
        val movies = MyListManager.getMovies(50)
        val series = MyListManager.getSeries(50)
        val totalCount = movies.size + series.size

        // Update item count
        itemCount.text = when (totalCount) {
            0 -> "Aucun élément"
            1 -> "1 élément"
            else -> "$totalCount éléments"
        }

        // Show/hide empty state
        if (totalCount == 0) {
            emptyState.visibility = View.VISIBLE
            moviesSection.visibility = View.GONE
            seriesSection.visibility = View.GONE
        } else {
            emptyState.visibility = View.GONE

            // Movies section
            if (movies.isNotEmpty()) {
                moviesSection.visibility = View.VISIBLE
                setupMoviesAdapter(movies)
            } else {
                moviesSection.visibility = View.GONE
            }

            // Series section
            if (series.isNotEmpty()) {
                seriesSection.visibility = View.VISIBLE
                setupSeriesAdapter(series)
            } else {
                seriesSection.visibility = View.GONE
            }
        }
    }

    private fun setupMoviesAdapter(movies: List<MyListManager.MyListItem>) {
        moviesAdapter = MyListAdapter(
            items = movies,
            onItemClick = { item -> openMovieDetail(item) },
            onLongClick = { item -> showRemoveDialog(item) }
        )
        moviesRecycler.adapter = moviesAdapter
    }

    private fun setupSeriesAdapter(series: List<MyListManager.MyListItem>) {
        seriesAdapter = MyListAdapter(
            items = series,
            onItemClick = { item -> openSeriesDetail(item) },
            onLongClick = { item -> showRemoveDialog(item) }
        )
        seriesRecycler.adapter = seriesAdapter
    }

    private fun openMovieDetail(item: MyListManager.MyListItem) {
        val streamId = item.streamId ?: return
        
        val intent = Intent(this, MovieDetailActivity::class.java).apply {
            putExtra("STREAM_ID", streamId)
            putExtra("MOVIE_NAME", item.title)
            putExtra("MOVIE_COVER", item.cover)
            putExtra("CONTAINER_EXTENSION", item.containerExtension ?: "mp4")
        }
        startActivity(intent)
    }

    private fun openSeriesDetail(item: MyListManager.MyListItem) {
        val seriesId = item.seriesId ?: return
        
        val intent = Intent(this, SeriesDetailActivity::class.java).apply {
            putExtra("IS_XTREAM", true)  // Important: Use Xtream mode
            putExtra("SERIES_ID", seriesId)
            putExtra("SERIES_NAME", item.title)
            putExtra("SERIES_COVER", item.cover)
        }
        startActivity(intent)
    }

    private fun showRemoveDialog(item: MyListManager.MyListItem) {
        AlertDialog.Builder(this)
            .setTitle("Retirer de Ma Liste")
            .setMessage("Voulez-vous retirer \"${item.title}\" de votre liste ?")
            .setPositiveButton("Retirer") { _, _ ->
                MyListManager.remove(item.id)
                loadMyList() // Refresh the list
                Toast.makeText(this, "\"${item.title}\" retiré de Ma Liste", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Annuler", null)
            .show()
    }
}

