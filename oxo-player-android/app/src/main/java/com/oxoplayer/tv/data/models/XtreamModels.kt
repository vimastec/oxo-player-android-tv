package com.oxoplayer.tv.data.models

import com.google.gson.annotations.SerializedName

/**
 * Xtream API Credentials extracted from M3U URL
 */
data class XtreamCredentials(
    val host: String,
    val username: String,
    val password: String
) {
    /**
     * Get properly formatted host with http:// prefix
     */
    private fun getFormattedHost(): String {
        return if (host.startsWith("http://") || host.startsWith("https://")) {
            host
        } else {
            "http://$host"
        }
    }
    
    /**
     * Build API URL for Xtream endpoints
     */
    fun buildApiUrl(action: String, params: Map<String, String> = emptyMap()): String {
        val baseParams = "username=$username&password=$password&action=$action"
        val extraParams = if (params.isNotEmpty()) {
            "&" + params.entries.joinToString("&") { "${it.key}=${it.value}" }
        } else ""
        return "${getFormattedHost()}/player_api.php?$baseParams$extraParams"
    }
    
    /**
     * Build stream URL for series episode
     */
    fun buildSeriesStreamUrl(episodeId: String, extension: String): String {
        return "${getFormattedHost()}/series/$username/$password/$episodeId.$extension"
    }
    
    /**
     * Build stream URL for VOD/movie
     */
    fun buildMovieStreamUrl(streamId: Int, extension: String): String {
        return "${getFormattedHost()}/movie/$username/$password/$streamId.$extension"
    }
    
    /**
     * Build stream URL for Live TV channel
     * Format: http://host:port/live/username/password/stream_id.ts (or .m3u8)
     */
    fun buildLiveStreamUrl(streamId: Int, extension: String = "m3u8"): String {
        return "${getFormattedHost()}/live/$username/$password/$streamId.$extension"
    }
}

/**
 * Xtream Series Category
 * From: player_api.php?action=get_series_categories
 */
data class XtreamSeriesCategory(
    @SerializedName("category_id")
    val categoryId: String,
    
    @SerializedName("category_name")
    val categoryName: String,
    
    @SerializedName("parent_id")
    val parentId: Int = 0
)

/**
 * Xtream Series (in category list)
 * From: player_api.php?action=get_series&category_id=...
 */
data class XtreamSeries(
    @SerializedName("series_id")
    val seriesId: Int,
    
    @SerializedName("name")
    val name: String,
    
    @SerializedName("cover")
    val cover: String?,
    
    @SerializedName("plot")
    val plot: String?,
    
    @SerializedName("cast")
    val cast: String?,
    
    @SerializedName("director")
    val director: String?,
    
    @SerializedName("genre")
    val genre: String?,
    
    @SerializedName("releaseDate")
    val releaseDate: String?,
    
    @SerializedName("release_date")
    val releaseDateAlt: String?,
    
    @SerializedName("rating")
    val rating: String?,
    
    @SerializedName("rating_5based")
    val rating5Based: Double?,
    
    @SerializedName("backdrop_path")
    val backdropPath: List<String>?,
    
    @SerializedName("youtube_trailer")
    val youtubeTrailer: String?,
    
    @SerializedName("episode_run_time")
    val episodeRunTime: String?,
    
    @SerializedName("category_id")
    val categoryId: String?,
    
    @SerializedName("category_ids")
    val categoryIds: List<Int>?
)

/**
 * Xtream Series Info (full details with seasons/episodes)
 * From: player_api.php?action=get_series_info&series_id=...
 */
data class XtreamSeriesInfo(
    @SerializedName("seasons")
    val seasons: List<XtreamSeason>?,
    
    @SerializedName("info")
    val info: XtreamSeriesDetails?,
    
    @SerializedName("episodes")
    val episodes: Map<String, List<XtreamEpisode>>?
)

/**
 * Xtream Season info
 */
data class XtreamSeason(
    @SerializedName("season_number")
    val seasonNumber: Int,
    
    @SerializedName("name")
    val name: String?,
    
    @SerializedName("cover")
    val cover: String?,
    
    @SerializedName("air_date")
    val airDate: String?,
    
    @SerializedName("episode_count")
    val episodeCount: Int?
)

/**
 * Xtream Series Details
 */
data class XtreamSeriesDetails(
    @SerializedName("name")
    val name: String?,
    
    @SerializedName("cover")
    val cover: String?,
    
    @SerializedName("plot")
    val plot: String?,
    
    @SerializedName("cast")
    val cast: String?,
    
    @SerializedName("director")
    val director: String?,
    
    @SerializedName("genre")
    val genre: String?,
    
    @SerializedName("releaseDate")
    val releaseDate: String?,
    
    @SerializedName("release_date")
    val releaseDateAlt: String?,
    
    @SerializedName("rating")
    val rating: String?,
    
    @SerializedName("rating_5based")
    val rating5Based: Double?,
    
    @SerializedName("backdrop_path")
    val backdropPath: List<String>?,
    
    @SerializedName("youtube_trailer")
    val youtubeTrailer: String?,
    
    @SerializedName("episode_run_time")
    val episodeRunTime: String?,
    
    @SerializedName("category_id")
    val categoryId: String?,
    
    @SerializedName("category_ids")
    val categoryIds: List<Int>?
)

/**
 * Xtream Episode
 */
data class XtreamEpisode(
    @SerializedName("id")
    val id: String,
    
    @SerializedName("episode_num")
    val episodeNum: Int,
    
    @SerializedName("title")
    val title: String?,
    
    @SerializedName("container_extension")
    val containerExtension: String?,
    
    @SerializedName("info")
    val info: XtreamEpisodeInfo?,
    
    @SerializedName("custom_sid")
    val customSid: String?,
    
    @SerializedName("added")
    val added: String?,
    
    @SerializedName("season")
    val season: Int,
    
    @SerializedName("direct_source")
    val directSource: String?
)

/**
 * Xtream Episode Info (metadata)
 */
data class XtreamEpisodeInfo(
    @SerializedName("air_date")
    val airDate: String?,
    
    @SerializedName("rating")
    val rating: Double?,
    
    @SerializedName("duration_secs")
    val durationSecs: Int?,
    
    @SerializedName("duration")
    val duration: String?,
    
    @SerializedName("plot")
    val plot: String?,
    
    @SerializedName("cover_big")
    val coverBig: String?,
    
    @SerializedName("movie_image")
    val movieImage: String?
)

// ==================== Xtream VOD/Movies Models ====================

/**
 * Xtream VOD/Movie Category
 * From: player_api.php?action=get_vod_categories
 */
data class XtreamMovieCategory(
    @SerializedName("category_id")
    val categoryId: String,
    
    @SerializedName("category_name")
    val categoryName: String,
    
    @SerializedName("parent_id")
    val parentId: Int = 0
)

/**
 * Xtream VOD/Movie (in category list)
 * From: player_api.php?action=get_vod_streams&category_id=...
 */
data class XtreamMovie(
    @SerializedName("stream_id")
    val streamId: Int,
    
    @SerializedName("num")
    val num: Int?,
    
    @SerializedName("name")
    val name: String,
    
    @SerializedName("stream_type")
    val streamType: String?,
    
    @SerializedName("stream_icon")
    val streamIcon: String?,
    
    @SerializedName("rating")
    val rating: String?,
    
    @SerializedName("rating_5based")
    val rating5Based: Double?,
    
    @SerializedName("added")
    val added: String?,
    
    @SerializedName("is_adult")
    val isAdult: String?,
    
    @SerializedName("category_id")
    val categoryId: String?,
    
    @SerializedName("category_ids")
    val categoryIds: List<Int>?,
    
    @SerializedName("container_extension")
    val containerExtension: String?,
    
    @SerializedName("custom_sid")
    val customSid: String?,
    
    @SerializedName("direct_source")
    val directSource: String?
)

/**
 * Xtream VOD/Movie Info (full details)
 * From: player_api.php?action=get_vod_info&vod_id=...
 */
data class XtreamMovieInfo(
    @SerializedName("info")
    val info: XtreamMovieDetails?,
    
    @SerializedName("movie_data")
    val movieData: XtreamMovieData?
)

/**
 * Xtream Movie Details
 */
data class XtreamMovieDetails(
    @SerializedName("movie_image")
    val movieImage: String?,
    
    @SerializedName("tmdb_id")
    val tmdbId: Int?,
    
    @SerializedName("name")
    val name: String?,
    
    @SerializedName("o_name")
    val originalName: String?,
    
    @SerializedName("cover_big")
    val coverBig: String?,
    
    @SerializedName("releasedate")
    val releaseDate: String?,
    
    @SerializedName("release_date")
    val releaseDateAlt: String?,
    
    @SerializedName("episode_run_time")
    val episodeRunTime: String?,
    
    @SerializedName("youtube_trailer")
    val youtubeTrailer: String?,
    
    @SerializedName("director")
    val director: String?,
    
    @SerializedName("actors")
    val actors: String?,
    
    @SerializedName("cast")
    val cast: String?,
    
    @SerializedName("description")
    val description: String?,
    
    @SerializedName("plot")
    val plot: String?,
    
    @SerializedName("age")
    val age: String?,
    
    @SerializedName("country")
    val country: String?,
    
    @SerializedName("genre")
    val genre: String?,
    
    @SerializedName("backdrop_path")
    val backdropPath: List<String>?,
    
    @SerializedName("rating")
    val rating: String?,
    
    @SerializedName("duration_secs")
    val durationSecs: Int?,
    
    @SerializedName("duration")
    val duration: String?,
    
    @SerializedName("bitrate")
    val bitrate: Int?,
    
    @SerializedName("video")
    val video: XtreamVideoInfo?,
    
    @SerializedName("audio")
    val audio: XtreamAudioInfo?
)

/**
 * Xtream Movie Data (stream info)
 */
data class XtreamMovieData(
    @SerializedName("stream_id")
    val streamId: Int?,
    
    @SerializedName("name")
    val name: String?,
    
    @SerializedName("added")
    val added: String?,
    
    @SerializedName("category_id")
    val categoryId: String?,
    
    @SerializedName("container_extension")
    val containerExtension: String?,
    
    @SerializedName("custom_sid")
    val customSid: String?,
    
    @SerializedName("direct_source")
    val directSource: String?
)

/**
 * Video stream info
 */
data class XtreamVideoInfo(
    @SerializedName("codec_name")
    val codecName: String?,
    
    @SerializedName("width")
    val width: Int?,
    
    @SerializedName("height")
    val height: Int?
)

/**
 * Audio stream info
 */
data class XtreamAudioInfo(
    @SerializedName("codec_name")
    val codecName: String?,
    
    @SerializedName("channels")
    val channels: Int?,
    
    @SerializedName("sample_rate")
    val sampleRate: String?
)

// ==================== Xtream Live TV Models ====================

/**
 * Xtream Live TV Category
 * From: player_api.php?action=get_live_categories
 */
data class XtreamLiveCategory(
    @SerializedName("category_id")
    val categoryId: String,
    
    @SerializedName("category_name")
    val categoryName: String,
    
    @SerializedName("parent_id")
    val parentId: Int = 0
)

/**
 * Xtream Live TV Stream/Channel
 * From: player_api.php?action=get_live_streams&category_id=...
 */
data class XtreamLiveStream(
    @SerializedName("num")
    val num: Int?,
    
    @SerializedName("name")
    val name: String,
    
    @SerializedName("stream_type")
    val streamType: String?,
    
    @SerializedName("stream_id")
    val streamId: Int,
    
    @SerializedName("stream_icon")
    val streamIcon: String?,
    
    @SerializedName("epg_channel_id")
    val epgChannelId: String?,
    
    @SerializedName("added")
    val added: String?,
    
    @SerializedName("is_adult")
    val isAdult: String?,
    
    @SerializedName("category_id")
    val categoryId: String?,
    
    @SerializedName("category_ids")
    val categoryIds: List<Int>?,
    
    @SerializedName("custom_sid")
    val customSid: String?,
    
    @SerializedName("tv_archive")
    val tvArchive: Int?,
    
    @SerializedName("direct_source")
    val directSource: String?,
    
    @SerializedName("tv_archive_duration")
    val tvArchiveDuration: Int?
)










