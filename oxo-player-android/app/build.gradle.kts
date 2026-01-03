import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

// Load keystore credentials from local.properties (not in git)
val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localProperties.load(localPropertiesFile.inputStream())
}

android {
    namespace = "com.oxoplayer.tv"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.oxoplayer.tv"
        minSdk = 21
        targetSdk = 34
        versionCode = 22
        versionName = "1.6.1"
        
        // API Configuration
        buildConfigField("String", "API_BASE_URL", "\"https://oxo-api-production.up.railway.app/api/\"")
        
        // TMDB API Keys (loaded from local.properties - not in source control)
        buildConfigField("String", "TMDB_API_KEY", "\"${localProperties.getProperty("TMDB_API_KEY", "")}\"")
        buildConfigField("String", "TMDB_ACCESS_TOKEN", "\"${localProperties.getProperty("TMDB_ACCESS_TOKEN", "")}\"")
    }

    signingConfigs {
        create("release") {
            storeFile = file("../oxo-release-key.jks")
            storePassword = localProperties.getProperty("KEYSTORE_STORE_PASSWORD")
            keyAlias = localProperties.getProperty("KEYSTORE_KEY_ALIAS")
            keyPassword = localProperties.getProperty("KEYSTORE_KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            // ProGuard disabled to avoid Gson/Retrofit issues
            // API keys are protected via local.properties (not in source control)
            isMinifyEnabled = false
            isShrinkResources = false
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    
    kotlinOptions {
        jvmTarget = "1.8"
    }
    
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    // AndroidX Core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    
    // Android TV Leanback
    implementation("androidx.leanback:leanback:1.2.0-alpha04")
    implementation("androidx.leanback:leanback-preference:1.2.0-alpha04")
    
    // RecyclerView
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    
    // ConstraintLayout
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    
    // CardView
    implementation("androidx.cardview:cardview:1.0.0")
    
    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    
    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    
    // Networking - Retrofit & OkHttp
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    
    // Gson
    implementation("com.google.code.gson:gson:2.10.1")
    
    // ExoPlayer for video playback
    implementation("androidx.media3:media3-exoplayer:1.2.0")
    implementation("androidx.media3:media3-exoplayer-hls:1.2.0")
    implementation("androidx.media3:media3-ui:1.2.0")
    implementation("androidx.media3:media3-exoplayer-rtsp:1.2.0")
    implementation("androidx.media3:media3-exoplayer-dash:1.2.0")
    
    // Additional codec support
    implementation("androidx.media3:media3-decoder:1.2.0")
    implementation("androidx.media3:media3-common:1.2.0")
    
    // Glide for image loading
    implementation("com.github.bumptech.glide:glide:4.16.0")
    
    // Room Database (for caching)
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    
    // DataStore (for preferences)
    implementation("androidx.datastore:datastore-preferences:1.0.0")
    
    // Material Design
    implementation("com.google.android.material:material:1.11.0")
    
    // QR Code generation (ZXing)
    implementation("com.google.zxing:core:3.5.2")
    
    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))
    implementation("com.google.firebase:firebase-auth-ktx")
}

