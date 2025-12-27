package com.oxoplayer.tv.ui.main

import android.graphics.Color
import android.view.ViewGroup
import androidx.leanback.widget.ImageCardView
import androidx.leanback.widget.Presenter
import com.bumptech.glide.Glide
import com.oxoplayer.tv.R
import com.oxoplayer.tv.data.models.Channel
import com.oxoplayer.tv.data.models.Movie
import com.oxoplayer.tv.data.models.Series

class CardPresenter : Presenter() {
    
    private val CARD_WIDTH = 313
    private val CARD_HEIGHT = 176
    
    override fun onCreateViewHolder(parent: ViewGroup): ViewHolder {
        val cardView = object : ImageCardView(parent.context) {
            override fun setSelected(selected: Boolean) {
                updateCardBackgroundColor(this, selected)
                super.setSelected(selected)
            }
        }
        
        cardView.isFocusable = true
        cardView.isFocusableInTouchMode = true
        updateCardBackgroundColor(cardView, false)
        
        return ViewHolder(cardView)
    }
    
    override fun onBindViewHolder(viewHolder: ViewHolder, item: Any?) {
        if (item == null) return
        val cardView = viewHolder.view as ImageCardView
        
        when (item) {
            is Channel -> {
                cardView.titleText = item.name
                cardView.contentText = item.category
                cardView.setMainImageDimensions(CARD_WIDTH, CARD_HEIGHT)
                
                if (!item.logo.isNullOrEmpty()) {
                    cardView.mainImageView?.let { imageView ->
                        Glide.with(viewHolder.view.context)
                            .load(item.logo)
                            .centerCrop()
                            .error(R.drawable.default_card_image)
                            .into(imageView)
                    }
                } else {
                    cardView.mainImage = viewHolder.view.context.getDrawable(R.drawable.default_card_image)
                }
            }
            
            is Movie -> {
                cardView.titleText = item.name
                cardView.contentText = item.category
                cardView.setMainImageDimensions(CARD_WIDTH, CARD_HEIGHT)
                
                if (!item.cover.isNullOrEmpty()) {
                    cardView.mainImageView?.let { imageView ->
                        Glide.with(viewHolder.view.context)
                            .load(item.cover)
                            .centerCrop()
                            .error(R.drawable.default_card_image)
                            .into(imageView)
                    }
                } else {
                    cardView.mainImage = viewHolder.view.context.getDrawable(R.drawable.default_card_image)
                }
            }
            
            is Series -> {
                cardView.titleText = item.name
                cardView.contentText = "${item.seasons.size} saison(s)"
                cardView.setMainImageDimensions(CARD_WIDTH, CARD_HEIGHT)
                
                if (!item.cover.isNullOrEmpty()) {
                    cardView.mainImageView?.let { imageView ->
                        Glide.with(viewHolder.view.context)
                            .load(item.cover)
                            .centerCrop()
                            .error(R.drawable.default_card_image)
                            .into(imageView)
                    }
                } else {
                    cardView.mainImage = viewHolder.view.context.getDrawable(R.drawable.default_card_image)
                }
            }
            
            is MainFragment.SettingsItem -> {
                cardView.titleText = item.title
                cardView.contentText = item.description
                cardView.setMainImageDimensions(CARD_WIDTH, CARD_HEIGHT)
                cardView.mainImage = viewHolder.view.context.getDrawable(R.drawable.default_card_image)
            }
        }
    }
    
    override fun onUnbindViewHolder(viewHolder: ViewHolder) {
        val cardView = viewHolder.view as ImageCardView
        cardView.badgeImage = null
        cardView.mainImage = null
    }
    
    private fun updateCardBackgroundColor(view: ImageCardView, selected: Boolean) {
        val color = if (selected) {
            view.context.getColor(R.color.selected_card_background)
        } else {
            view.context.getColor(R.color.default_card_background)
        }
        view.setBackgroundColor(color)
        view.setInfoAreaBackgroundColor(color)
    }
}

