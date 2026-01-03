package com.oxoplayer.tv.ui.common

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.oxoplayer.tv.R

/**
 * Adapter for category/sort selection dialogs with proper TV focus handling
 */
class DialogCategoryAdapter(
    private val items: List<String>,
    private val onItemClick: (Int) -> Unit
) : RecyclerView.Adapter<DialogCategoryAdapter.ViewHolder>() {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val textView: TextView = view.findViewById(R.id.categoryName)

        fun bind(item: String, position: Int) {
            textView.text = item

            itemView.setOnClickListener {
                onItemClick(position)
            }

            // Focus handling for TV remote - change text color on focus
            itemView.setOnFocusChangeListener { v, hasFocus ->
                if (hasFocus) {
                    textView.setTextColor(Color.BLACK)
                    v.animate()
                        .scaleX(1.05f)
                        .scaleY(1.05f)
                        .setDuration(150)
                        .start()
                } else {
                    textView.setTextColor(Color.WHITE)
                    v.animate()
                        .scaleX(1.0f)
                        .scaleY(1.0f)
                        .setDuration(150)
                        .start()
                }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_dialog_category, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position], position)
    }

    override fun getItemCount() = items.size
}






