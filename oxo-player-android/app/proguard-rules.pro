# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# ============================================
# KOTLIN
# ============================================
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}
-keepclassmembers class **$WhenMappings {
    <fields>;
}
-keepclassmembers class kotlin.Lazy {
    public protected *;
}
-dontwarn kotlin.**

# ============================================
# RETROFIT
# ============================================
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepattributes Exceptions

-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}

-keep,allowobfuscation interface retrofit2.Call
-keep,allowobfuscation interface retrofit2.Response

-dontwarn org.codehaus.mojo.animal_sniffer.IgnoreJRERequirement
-dontwarn javax.annotation.**
-dontwarn kotlin.Unit
-dontwarn retrofit2.KotlinExtensions
-dontwarn retrofit2.KotlinExtensions$*

# ============================================
# GSON - CRITICAL FOR JSON PARSING
# ============================================
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses

-dontwarn sun.misc.**

# Keep Gson classes
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Keep TypeToken for Gson (fixes ParameterizedType error)
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken { *; }

# Keep fields with @SerializedName
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# ============================================
# OXO PLAYER DATA CLASSES - KEEP EVERYTHING
# ============================================

# Keep ALL model classes with all members
-keep class com.oxoplayer.tv.data.models.** { *; }
-keepclassmembers class com.oxoplayer.tv.data.models.** {
    <init>(...);
    <fields>;
    <methods>;
}

# Keep repository classes
-keep class com.oxoplayer.tv.data.repository.** { *; }
-keepclassmembers class com.oxoplayer.tv.data.repository.** { *; }

# Keep API service interface
-keep interface com.oxoplayer.tv.data.api.ApiService { *; }
-keep class com.oxoplayer.tv.data.api.** { *; }
-keepclassmembers class com.oxoplayer.tv.data.api.** { *; }

# Keep preferences
-keep class com.oxoplayer.tv.data.preferences.** { *; }

# Keep auth helper
-keep class com.oxoplayer.tv.data.auth.** { *; }

# ExoPlayer
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Glide
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule {
 <init>(...);
}
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
  **[] $VALUES;
  public *;
}

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Keep Firebase Auth
-keep class com.google.firebase.auth.** { *; }
-keepclassmembers class com.google.firebase.auth.** { *; }

# Keep our auth helper
-keep class com.oxoplayer.tv.data.auth.** { *; }














