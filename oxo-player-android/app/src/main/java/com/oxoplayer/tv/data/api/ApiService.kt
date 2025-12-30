package com.oxoplayer.tv.data.api

import com.oxoplayer.tv.data.models.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    
    /**
     * Register/Check device status
     */
    @POST("device/register")
    suspend fun registerDevice(
        @Body request: DeviceRegisterRequest
    ): Response<DeviceRegisterResponse>
    
    /**
     * Get device status
     */
    @GET("device/status/{mac}")
    suspend fun getDeviceStatus(
        @Path("mac") macAddress: String
    ): Response<DeviceStatusResponse>
    
    /**
     * Get playlist for device (returns first/active playlist)
     */
    @GET("device/playlist/{mac}")
    suspend fun getPlaylist(
        @Path("mac") macAddress: String
    ): Response<PlaylistResponse>
    
    /**
     * Get all playlists for device
     */
    @GET("device/playlists/{mac}")
    suspend fun getAllPlaylists(
        @Path("mac") macAddress: String
    ): Response<PlaylistsResponse>
    
    /**
     * Get specific playlist by ID
     */
    @GET("device/playlist/{mac}/{playlistId}")
    suspend fun getPlaylistById(
        @Path("mac") macAddress: String,
        @Path("playlistId") playlistId: Int
    ): Response<SinglePlaylistResponse>
    
    /**
     * Set active playlist for device
     */
    @POST("device/playlist/{mac}/set-active/{playlistId}")
    suspend fun setActivePlaylist(
        @Path("mac") macAddress: String,
        @Path("playlistId") playlistId: Int
    ): Response<SetActiveResponse>
    
    /**
     * Get playlist content (M3U file)
     */
    @GET("device/playlist/{mac}/content")
    @Streaming
    suspend fun getPlaylistContent(
        @Path("mac") macAddress: String
    ): Response<okhttp3.ResponseBody>
    
    /**
     * Stream proxy endpoint
     */
    @GET("stream/proxy")
    @Streaming
    suspend fun getStreamProxy(
        @Query("url") streamUrl: String
    ): Response<okhttp3.ResponseBody>
    
    /**
     * Check for app updates (OTA)
     */
    @GET("app-version/check")
    suspend fun checkUpdate(
        @Query("versionCode") versionCode: Int
    ): Response<UpdateCheckResponse>
}

