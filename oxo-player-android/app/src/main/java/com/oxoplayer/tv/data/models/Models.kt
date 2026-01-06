package com.oxoplayer.tv.data.models

import com.google.gson.annotations.SerializedName

/**
 * Device Registration
 */
data class DeviceRegisterRequest(
    @SerializedName("mac_address")
    val macAddress: String,
    @SerializedName("device_info")
    val deviceInfo: String
)

data class DeviceRegisterResponse(
    @SerializedName("mac_address")
    val macAddress: String,
    @SerializedName("device_key")
    val deviceKey: String?,
    val status: String,
    @SerializedName("trial_start")
    val trialStart: String?,
    @SerializedName("activation_date")
    val activationDate: String?,
    @SerializedName("expiration_date")
    val expirationDate: String?,
    @SerializedName("days_remaining")
    val daysRemaining: Int,
    @SerializedName("has_playlist")
    val hasPlaylist: Boolean,
    @SerializedName("playlist_type")
    val playlistType: String? // "m3u" or "xtream"
)

/**
 * Device Status
 */
data class DeviceStatusResponse(
    val registered: Boolean,
    val status: String,
    @SerializedName("has_playlist")
    val hasPlaylist: Boolean,
    @SerializedName("playlist_type")
    val playlistType: String?, // "m3u" or "xtream"
    @SerializedName("days_remaining")
    val daysRemaining: Int,
    @SerializedName("expiration_date")
    val expirationDate: String?
)

/**
 * Playlist
 */
data class PlaylistResponse(
    @SerializedName("mac_address")
    val macAddress: String,
    val status: String,
    @SerializedName("playlist_type")
    val playlistType: String?, // "m3u" or "xtream"
    @SerializedName("playlist_url")
    val playlistUrl: String?,
    @SerializedName("playlist_content")
    val playlistContent: String?,
    @SerializedName("expiration_date")
    val expirationDate: String?,
    val xtream: XtreamApiCredentials?,
    val error: String?,
    val message: String?
)

/**
 * Xtream Code Credentials from API
 */
data class XtreamApiCredentials(
    val host: String,
    val username: String,
    val password: String
)

/**
 * Playlist Item (for playlist selector)
 */
data class PlaylistItem(
    val id: Int,
    val name: String,
    @SerializedName("playlist_type")
    val playlistType: String,
    @SerializedName("is_active")
    val isActive: Boolean,
    @SerializedName("created_at")
    val createdAt: String?
)

/**
 * Playlists Response
 */
data class PlaylistsResponse(
    @SerializedName("mac_address")
    val macAddress: String,
    val playlists: List<PlaylistItem>
)

/**
 * Single Playlist Response (when selecting a specific playlist)
 */
data class SinglePlaylistResponse(
    val id: Int,
    val name: String,
    @SerializedName("mac_address")
    val macAddress: String,
    val status: String,
    @SerializedName("playlist_type")
    val playlistType: String?,
    @SerializedName("playlist_url")
    val playlistUrl: String?,
    @SerializedName("expiration_date")
    val expirationDate: String?,
    val xtream: XtreamApiCredentials?
)

/**
 * Set Active Playlist Response
 */
data class SetActiveResponse(
    val success: Boolean,
    val message: String?,
    @SerializedName("active_playlist")
    val activePlaylist: ActivePlaylistInfo?
)

data class ActivePlaylistInfo(
    val id: Int,
    val name: String
)

/**
 * Channel (Live TV)
 */
data class Channel(
    val id: String,
    val num: Int,
    val name: String,
    val streamUrl: String,
    val logo: String?,
    val category: String,
    val epgChannelId: String?,
    val tvgId: String?,
    val isFavorite: Boolean = false
)

/**
 * Movie (VOD)
 */
data class Movie(
    val id: String,
    val name: String,
    val streamUrl: String,
    val cover: String?,
    val category: String,
    val rating: String?,
    val year: String?,
    val duration: String?,
    val plot: String?,
    val isFavorite: Boolean = false
)

/**
 * Series Category - A category that contains multiple series
 * Example: "RAMADAN 2025", "VOD - DOCUMENTARIES"
 */
data class SeriesCategory(
    val id: String,
    val name: String,
    val seriesList: List<SeriesInfo>
)

/**
 * Series Info - Information about a series (without full details)
 * Used for listing series in a category
 */
data class SeriesInfo(
    val id: String,
    val name: String,
    val cover: String?,
    val category: String,
    val totalSeasons: Int,
    val totalEpisodes: Int
)

/**
 * Series - Full series with all seasons and episodes
 */
data class Series(
    val id: String,
    val name: String,
    val cover: String?,
    val category: String,
    val rating: String?,
    val year: String?,
    val plot: String?,
    val seasons: List<Season>,
    val isFavorite: Boolean = false
)

data class Season(
    val seasonNumber: Int,
    val episodes: List<Episode>
)

data class Episode(
    val id: String,
    val episodeNumber: Int,
    val name: String,
    val streamUrl: String,
    val cover: String?,
    val duration: String?,
    val plot: String?
)

/**
 * Category
 */
data class Category(
    val id: String,
    val name: String,
    val type: ContentType
)

enum class ContentType {
    LIVE_TV,
    MOVIES,
    SERIES
}

/**
 * Playback Progress
 */
data class PlaybackProgress(
    val contentId: String,
    val position: Long,
    val duration: Long,
    val timestamp: Long
)

/**
 * Series Playback Configuration
 * Customizable settings for intro skip and next episode timing
 */
data class SeriesPlaybackConfig(
    val seriesId: String,
    val seasonNumber: Int?, // null = applies to all seasons
    val skipIntroShowAtMs: Long, // When to show "Skip Intro" button (e.g., 10000ms = 10 seconds)
    val skipIntroJumpToMs: Long, // Where to jump when skipping intro (e.g., 120000ms = 2 minutes)
    val nextEpisodeThresholdMs: Long, // When to show "Next Episode" button before end (e.g., 60000ms = 1 minute)
    val applyToAllSeasons: Boolean // If true, applies to all seasons of this series
)

/**
 * App Version Response (for OTA updates)
 */
data class AppVersionResponse(
    val updateAvailable: Boolean,
    val isMandatory: Boolean?,
    val currentVersion: Int?,
    val message: String?,
    val latestVersion: AppVersionInfo?
)

data class AppVersionInfo(
    val versionCode: Int,
    val versionName: String,
    val downloadUrl: String,
    val changelog: String?,
    val isMandatory: Boolean,
    val minSupportedVersion: Int?,
    val releaseDate: String?
) : java.io.Serializable

/**
 * Link Code - For easy device activation
 */
data class LinkCodeRequest(
    @SerializedName("mac_address")
    val macAddress: String
)

data class LinkCodeResponse(
    val code: String,
    @SerializedName("expires_at")
    val expiresAt: String
)




