package com.oxoplayer.tv.data.parser

import com.oxoplayer.tv.data.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.yield
import java.io.BufferedReader
import java.io.InputStream
import java.io.StringReader
import java.net.URL

object M3UParser {
    
    // Limits to prevent OutOfMemoryError
    private const val MAX_CHANNELS = 5000
    private const val MAX_MOVIES = 3000
    private const val MAX_SERIES_EPISODES = 5000
    
    /**
     * Extract Xtream credentials from M3U URL or content
     * 
     * Supports formats:
     * - http://host:port/get.php?username=xxx&password=yyy&type=m3u_plus
     * - http://host:port/player_api.php?username=xxx&password=yyy
     * - From first line of M3U content containing the URL
     * 
     * @return XtreamCredentials if extraction successful, null otherwise
     */
    fun extractXtreamCredentials(urlOrContent: String): XtreamCredentials? {
        try {
            // Try to find URL in content (might be in first lines or as a comment)
            val urlToProcess = findUrlInContent(urlOrContent)
            
            if (urlToProcess.isNullOrEmpty()) {
                android.util.Log.w("M3UParser", "No URL found in content")
                return null
            }
            
            android.util.Log.d("M3UParser", "Processing URL: $urlToProcess")
            
            // Parse URL
            val url = URL(urlToProcess)
            val host = buildHost(url)
            
            // Extract query parameters
            val params = parseQueryParams(url.query ?: "")
            
            val username = params["username"]
            val password = params["password"]
            
            if (username.isNullOrEmpty() || password.isNullOrEmpty()) {
                android.util.Log.w("M3UParser", "Missing username or password in URL")
                return null
            }
            
            val credentials = XtreamCredentials(
                host = host,
                username = username,
                password = password
            )
            
            android.util.Log.d("M3UParser", "Extracted credentials - Host: $host, Username: $username")
            return credentials
            
        } catch (e: Exception) {
            android.util.Log.e("M3UParser", "Error extracting Xtream credentials", e)
            return null
        }
    }
    
    /**
     * Extract Xtream credentials from a playlist URL directly
     */
    fun extractXtreamCredentialsFromUrl(playlistUrl: String): XtreamCredentials? {
        return extractXtreamCredentials(playlistUrl)
    }
    
    /**
     * Find URL in M3U content (could be a direct URL or embedded in content)
     */
    private fun findUrlInContent(content: String): String? {
        val trimmed = content.trim()
        
        // If it's directly a URL
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            // Extract just the first line if it's a URL
            val firstLine = trimmed.lineSequence().firstOrNull { it.startsWith("http") }
            if (firstLine != null && (firstLine.contains("username=") || firstLine.contains("get.php") || firstLine.contains("player_api"))) {
                return firstLine.trim()
            }
        }
        
        // Search in content for Xtream-style URLs
        val urlPattern = """(https?://[^\s]+(?:get\.php|player_api\.php)[^\s]*)""".toRegex()
        val match = urlPattern.find(content)
        if (match != null) {
            return match.value
        }
        
        // Search for any URL with username/password params
        val paramUrlPattern = """(https?://[^\s]+username=[^\s]+password=[^\s]+)""".toRegex()
        val paramMatch = paramUrlPattern.find(content)
        if (paramMatch != null) {
            return paramMatch.value.split("&type=")[0] // Clean up trailing params
        }
        
        return null
    }
    
    /**
     * Build host URL (protocol + host + port)
     */
    private fun buildHost(url: URL): String {
        val port = if (url.port != -1 && url.port != url.defaultPort) {
            ":${url.port}"
        } else if (url.port == -1) {
            // Default to 8080 for Xtream servers if no port specified
            ":8080"
        } else {
            ""
        }
        return "${url.protocol}://${url.host}$port"
    }
    
    /**
     * Parse query string to map
     */
    private fun parseQueryParams(query: String): Map<String, String> {
        if (query.isEmpty()) return emptyMap()
        
        return query.split("&")
            .mapNotNull { param ->
                val parts = param.split("=", limit = 2)
                if (parts.size == 2) {
                    parts[0] to java.net.URLDecoder.decode(parts[1], "UTF-8")
                } else null
            }
            .toMap()
    }
    
    /**
     * Check if M3U content/URL is from an Xtream server
     */
    fun isXtreamPlaylist(urlOrContent: String): Boolean {
        return extractXtreamCredentials(urlOrContent) != null
    }
    
    private val VOD_KEYWORDS = listOf(
        "VOD", "FILM", "FILMS", "MOVIE", "MOVIES",
        "CINEMA", "CINÉMA", "PELICULAS",
        "FR FILMS", "AR FILMS", "EN FILMS",
        "أفلام", "فيلم"
    )
    
    private val SERIES_KEYWORDS = listOf(
        "SERIES", "SÉRIE", "SÉRIES", "SERIE",
        "EPISODE", "ÉPISODE", "EPISODES",
        "SAISON", "SEASON", "TV SHOWS",
        "مسلسلات", "مسلسل"
    )
    
    private val LIVE_TV_KEYWORDS = listOf(
        "SPORT", "SPORTS", "CHANNEL", "CHANNELS",
        "HD", "FHD", "4K", "UHD", "SD",
        "LIVE", "EN DIRECT", "DIRECT",
        "NEWS", "ACTUALITÉ", "BEIN", "BT SPORT",
        "FOOTBALL", "SOCCER", "NBA", "UFC",
        "قنوات", "قناة", "مباشر"
    )
    
    private val VOD_URL_PATTERNS = listOf("/MOVIE/", "/MOVIES/")
    private val SERIES_URL_PATTERNS = listOf("/SERIES/")
    
    /**
     * Parse M3U content from InputStream - OPTIMIZED for large files
     * Reads line by line to avoid loading entire content in memory
     */
    suspend fun parseM3UFromStream(inputStream: InputStream): ParseResult = withContext(Dispatchers.Default) {
        val channels = mutableListOf<Channel>()
        val movies = mutableListOf<Movie>()
        val seriesMap = mutableMapOf<String, MutableList<SeriesEpisode>>()
        
        val liveCategories = mutableSetOf<String>()
        val movieCategories = mutableSetOf<String>()
        val seriesCategories = mutableSetOf<String>()
        
        var currentItem: M3UItem? = null
        var channelId = 1
        var movieId = 1
        var totalParsed = 0
        var seriesEpisodeCount = 0
        
        android.util.Log.d("M3UParser", "Starting optimized M3U parsing...")
        
        try {
            inputStream.bufferedReader(Charsets.UTF_8).useLines { lines ->
                for (line in lines) {
                    val trimmedLine = line.trim()
                    
                    // Check limits to prevent OOM
                    if (channels.size >= MAX_CHANNELS && 
                        movies.size >= MAX_MOVIES && 
                        seriesEpisodeCount >= MAX_SERIES_EPISODES) {
                        android.util.Log.w("M3UParser", "Reached limits - stopping parse to prevent OOM")
                        return@useLines
                    }
                    
                    when {
                        trimmedLine.startsWith("#EXTINF:") -> {
                            currentItem = parseExtInf(trimmedLine)
                        }
                        
                        trimmedLine.isNotEmpty() && !trimmedLine.startsWith("#") && currentItem != null -> {
                            val url = trimmedLine
                            val contentType = detectContentType(url, currentItem!!.group, currentItem!!.name)
                            
                            when (contentType) {
                                ContentType.LIVE_TV -> {
                                    if (channels.size < MAX_CHANNELS) {
                                        channels.add(
                                            Channel(
                                                id = "ch_${channelId++}",
                                                num = channelId - 1,
                                                name = currentItem!!.name,
                                                streamUrl = url,
                                                logo = currentItem!!.logo,
                                                category = currentItem!!.group,
                                                epgChannelId = currentItem!!.tvgId,
                                                tvgId = currentItem!!.tvgId
                                            )
                                        )
                                        liveCategories.add(currentItem!!.group)
                                    }
                                }
                                
                                ContentType.MOVIES -> {
                                    if (movies.size < MAX_MOVIES) {
                                        movies.add(
                                            Movie(
                                                id = "mv_${movieId++}",
                                                name = currentItem!!.name,
                                                streamUrl = url,
                                                cover = currentItem!!.logo,
                                                category = currentItem!!.group,
                                                rating = null,
                                                year = null,
                                                duration = null,
                                                plot = null
                                            )
                                        )
                                        movieCategories.add(currentItem!!.group)
                                    }
                                }
                                
                                ContentType.SERIES -> {
                                    if (seriesEpisodeCount < MAX_SERIES_EPISODES) {
                                        val episodeInfo = extractEpisodeInfo(currentItem!!.name)
                                        val seriesName = episodeInfo.seriesName
                                        
                                        if (!seriesMap.containsKey(seriesName)) {
                                            seriesMap[seriesName] = mutableListOf()
                                        }
                                        
                                        seriesMap[seriesName]!!.add(
                                            SeriesEpisode(
                                                name = currentItem!!.name,
                                                streamUrl = url,
                                                logo = currentItem!!.logo,
                                                category = currentItem!!.group,
                                                seasonNumber = episodeInfo.seasonNumber,
                                                episodeNumber = episodeInfo.episodeNumber
                                            )
                                        )
                                        seriesCategories.add(currentItem!!.group)
                                        seriesEpisodeCount++
                                    }
                                }
                            }
                            
                            currentItem = null
                            totalParsed++
                            
                            // Log progress every 1000 items
                            if (totalParsed % 1000 == 0) {
                                android.util.Log.d("M3UParser", "Parsed $totalParsed items (CH: ${channels.size}, MV: ${movies.size}, EP: $seriesEpisodeCount)")
                            }
                            
                            // Yield periodically to prevent ANR
                            if (totalParsed % 500 == 0) {
                                yield()
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("M3UParser", "Error parsing M3U stream", e)
        }
        
        android.util.Log.d("M3UParser", "Parsing complete: ${channels.size} channels, ${movies.size} movies, ${seriesMap.size} series")
        
        // Convert series map to Series objects
        val series = convertSeriesToObjects(seriesMap)
        val seriesCategoriesList = buildSeriesCategories(series)
        
        // Force garbage collection after parsing
        System.gc()
        
        ParseResult(
            channels = channels,
            movies = movies,
            series = series,
            seriesCategories = seriesCategoriesList,
            liveCategories = liveCategories.map { Category(it, it, ContentType.LIVE_TV) },
            movieCategories = movieCategories.map { Category(it, it, ContentType.MOVIES) }
        )
    }
    
    /**
     * Parse M3U content - OPTIMIZED version
     * For backward compatibility, converts String to stream
     */
    suspend fun parseM3U(content: String): ParseResult = withContext(Dispatchers.Default) {
        android.util.Log.d("M3UParser", "Parsing M3U content (${content.length} chars)...")
        
        // Use streaming approach even for string content
        val inputStream = content.byteInputStream(Charsets.UTF_8)
        parseM3UFromStream(inputStream)
    }
    
    /**
     * Convert series episodes map to Series objects
     */
    private fun convertSeriesToObjects(seriesMap: Map<String, List<SeriesEpisode>>): List<Series> {
        return seriesMap.map { (seriesName, episodes) ->
            createSeriesFromEpisodes(seriesName, episodes)
        }
    }
    
    /**
     * Build series categories from series list
     */
    private fun buildSeriesCategories(series: List<Series>): List<SeriesCategory> {
        val categorizedSeries = mutableMapOf<String, MutableList<Series>>()
        
        for (seriesObj in series) {
            val originalCategory = seriesObj.category
            
            val categoryName = if (originalCategory == seriesObj.name || 
                                    originalCategory.contains(seriesObj.name.take(20))) {
                extractSmartCategory(seriesObj.name)
            } else {
                originalCategory
            }
            
            if (!categorizedSeries.containsKey(categoryName)) {
                categorizedSeries[categoryName] = mutableListOf()
            }
            
            categorizedSeries[categoryName]!!.add(seriesObj)
        }
        
        return categorizedSeries.map { (categoryName, seriesList) ->
            val seriesInfoList = seriesList.map { seriesObj ->
                SeriesInfo(
                    id = seriesObj.id,
                    name = seriesObj.name,
                    cover = seriesObj.cover,
                    category = categoryName,
                    totalSeasons = seriesObj.seasons.size,
                    totalEpisodes = seriesObj.seasons.sumOf { it.episodes.size }
                )
            }
            
            SeriesCategory(
                id = "cat_${categoryName.hashCode()}",
                name = categoryName,
                seriesList = seriesInfoList.sortedBy { it.name }
            )
        }.sortedBy { it.name }
    }
    
    /**
     * Helper function to create a Series object from episodes
     */
    private fun createSeriesFromEpisodes(seriesName: String, episodes: List<SeriesEpisode>): Series {
        val groupedBySeasons = episodes.groupBy { it.seasonNumber }
        val seasons = groupedBySeasons.map { (seasonNum, seasonEpisodes) ->
            Season(
                seasonNumber = seasonNum,
                episodes = seasonEpisodes.mapIndexed { idx, ep ->
                    Episode(
                        id = "ep_${seriesName}_${seasonNum}_${idx}",
                        episodeNumber = ep.episodeNumber,
                        name = ep.name,
                        streamUrl = ep.streamUrl,
                        cover = ep.logo,
                        duration = null,
                        plot = null
                    )
                }.sortedBy { it.episodeNumber }
            )
        }.sortedBy { it.seasonNumber }
        
        return Series(
            id = "sr_${seriesName.hashCode()}",
            name = seriesName,
            cover = episodes.firstOrNull()?.logo,
            category = episodes.firstOrNull()?.category ?: "Unknown",
            rating = null,
            year = null,
            plot = null,
            seasons = seasons
        )
    }
    
    private fun parseExtInf(line: String): M3UItem {
        val info = line.substring(8) // Remove "#EXTINF:"
        
        val tvgIdRegex = """tvg-id="([^"]*)"""".toRegex()
        val tvgNameRegex = """tvg-name="([^"]*)"""".toRegex()
        val tvgLogoRegex = """tvg-logo="([^"]*)"""".toRegex()
        val groupRegex = """group-title="([^"]*)"""".toRegex()
        
        val tvgId = tvgIdRegex.find(info)?.groupValues?.get(1) ?: ""
        val tvgName = tvgNameRegex.find(info)?.groupValues?.get(1) ?: ""
        val logo = tvgLogoRegex.find(info)?.groupValues?.get(1) ?: ""
        val group = groupRegex.find(info)?.groupValues?.get(1) ?: "Autres"
        
        val nameMatch = """,\s*(.+)$""".toRegex().find(info)
        val name = nameMatch?.groupValues?.get(1)?.trim() ?: "Unknown"
        
        return M3UItem(
            name = name,
            tvgId = tvgId,
            tvgName = tvgName,
            logo = logo,
            group = group
        )
    }
    
    private fun detectContentType(url: String, group: String, name: String): ContentType {
        val upperUrl = url.uppercase()
        val upperGroup = group.uppercase()
        val upperName = name.uppercase()
        
        // Check URL patterns first (most reliable)
        if (SERIES_URL_PATTERNS.any { upperUrl.contains(it) }) {
            return ContentType.SERIES
        }
        if (VOD_URL_PATTERNS.any { upperUrl.contains(it) }) {
            return ContentType.MOVIES
        }
        
        // IMPORTANT: Check Live TV indicators FIRST (before series/movies)
        if (LIVE_TV_KEYWORDS.any { upperName.contains(it) }) {
            return ContentType.LIVE_TV
        }
        
        if (LIVE_TV_KEYWORDS.any { upperGroup.contains(it) }) {
            return ContentType.LIVE_TV
        }
        
        // Check keywords in group
        if (SERIES_KEYWORDS.any { upperGroup.contains(it) }) {
            return ContentType.SERIES
        }
        if (VOD_KEYWORDS.any { upperGroup.contains(it) }) {
            return ContentType.MOVIES
        }
        
        // Check episode patterns in name
        val seriesPattern = """S\d{1,2}\s*E\d{1,2}|SEASON\s*\d|SAISON\s*\d|EP\s*\d{1,3}""".toRegex()
        if (seriesPattern.containsMatchIn(upperName)) {
            return ContentType.SERIES
        }
        
        // Default to Live TV
        return ContentType.LIVE_TV
    }
    
    /**
     * Extract smart category from series name
     */
    private fun extractSmartCategory(seriesName: String): String {
        val upperName = seriesName.uppercase()
        
        val countryPattern = """\(([A-Z]{2})\)""".toRegex()
        val countryMatch = countryPattern.find(seriesName)
        
        if (countryMatch != null) {
            val countryCode = countryMatch.groupValues[1]
            
            return when (countryCode) {
                "EG" -> "مسلسلات مصرية (EG)"
                "KW" -> "مسلسلات كويتية (KW)"
                "SA" -> "مسلسلات سعودية (SA)"
                "LB" -> "مسلسلات لبنانية (LB)"
                "SY" -> "مسلسلات سورية (SY)"
                "JO" -> "مسلسلات أردنية (JO)"
                "AE" -> "مسلسلات إماراتية (AE)"
                "TN" -> "مسلسلات تونسية (TN)"
                "MA" -> "مسلسلات مغربية (MA)"
                "DZ" -> "مسلسلات جزائرية (DZ)"
                "TR" -> "SÉRIES TURQUES (TR)"
                "KR" -> "SÉRIES CORÉENNES (KR)"
                "US" -> "SÉRIES AMÉRICAINES (US)"
                "GB" -> "SÉRIES BRITANNIQUES (GB)"
                "FR" -> "SÉRIES FRANÇAISES (FR)"
                "ES" -> "SÉRIES ESPAGNOLES (ES)"
                "IT" -> "SÉRIES ITALIENNES (IT)"
                "DE" -> "SÉRIES ALLEMANDES (DE)"
                "IN" -> "SÉRIES INDIENNES (IN)"
                "PK" -> "SÉRIES PAKISTANAISES (PK)"
                "JP" -> "SÉRIES JAPONAISES (JP)"
                "CN" -> "SÉRIES CHINOISES (CN)"
                else -> "SÉRIES INTERNATIONALES ($countryCode)"
            }
        }
        
        if (seriesName.any { it in '\u0600'..'\u06FF' }) {
            return "مسلسلات عربية"
        }
        
        if (upperName.contains("(FR") || upperName.contains("FRANÇAIS")) {
            return "SÉRIES FRANÇAISES"
        }
        
        return "SÉRIES AUTRES"
    }
    
    private fun extractEpisodeInfo(name: String): EpisodeInfo {
        val patterns = listOf(
            """[Ss](\d{1,2})\s*[Ee](\d{1,3})""".toRegex(),
            """[Ss]aison\s*(\d{1,2})\s*[Ee]p?\s*(\d{1,3})""".toRegex(),
            """[Ss]eason\s*(\d{1,2})\s*[Ee]p?\s*(\d{1,3})""".toRegex(),
            """(\d{1,2})x(\d{1,3})""".toRegex()
        )
        
        for (pattern in patterns) {
            val match = pattern.find(name)
            if (match != null) {
                val seasonNum = match.groupValues[1].toIntOrNull() ?: 1
                val episodeNum = match.groupValues[2].toIntOrNull() ?: 1
                val cleanName = name.replace(pattern, "").trim().split("-")[0].trim()
                
                return EpisodeInfo(
                    seriesName = if (cleanName.isNotEmpty()) cleanName else "Unknown Series",
                    seasonNumber = seasonNum,
                    episodeNumber = episodeNum
                )
            }
        }
        
        return EpisodeInfo(
            seriesName = name.split("-")[0].trim(),
            seasonNumber = 1,
            episodeNumber = 1
        )
    }
    
    data class M3UItem(
        val name: String,
        val tvgId: String,
        val tvgName: String,
        val logo: String,
        val group: String
    )
    
    data class SeriesEpisode(
        val name: String,
        val streamUrl: String,
        val logo: String?,
        val category: String,
        val seasonNumber: Int,
        val episodeNumber: Int
    )
    
    data class EpisodeInfo(
        val seriesName: String,
        val seasonNumber: Int,
        val episodeNumber: Int
    )
    
    data class ParseResult(
        val channels: List<Channel>,
        val movies: List<Movie>,
        val series: List<Series>,
        val seriesCategories: List<SeriesCategory>,
        val liveCategories: List<Category>,
        val movieCategories: List<Category>
    )
}
