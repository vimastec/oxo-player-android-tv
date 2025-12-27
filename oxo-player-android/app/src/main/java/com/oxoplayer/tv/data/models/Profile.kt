package com.oxoplayer.tv.data.models

import java.util.UUID

/**
 * User Profile - like Netflix profiles
 * Each profile has separate watch history, favorites, and continue watching
 */
data class Profile(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val avatarIndex: Int = 0, // Index of avatar image
    val isKidsProfile: Boolean = false,
    val pin: String? = null, // Optional 4-digit PIN code
    val createdAt: Long = System.currentTimeMillis()
) {
    val hasPin: Boolean get() = !pin.isNullOrEmpty()
}

