plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

android {
    namespace = "it.doditech.dodifile"
    compileSdk = 35

    defaultConfig {
        applicationId = "it.doditech.dodifile"
        minSdk = 26
        targetSdk = 35          // Requisito Google Play: tenere aggiornato ogni anno
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures { compose = true }

    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}

ksp { arg("room.schemaLocation", "$projectDir/schemas") }

// Tutte le librerie sono gratuite (Apache 2.0 / licenza ML Kit gratuita) e girano sul dispositivo.
dependencies {
    // --- Base Android / Kotlin
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0") // Task.await()

    // --- Jetpack Compose (BOM = versioni allineate)
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.navigation:navigation-compose:2.8.5")

    // --- Room: database locale SQLite
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // --- Impostazioni locali + promemoria che sopravvivono al riavvio
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // --- ML Kit (on-device, gratuito)
    implementation("com.google.mlkit:text-recognition:16.0.1")                          // OCR latino, modello incluso nell'app
    implementation("com.google.android.gms:play-services-mlkit-document-scanner:16.0.0-beta1") // scanner con ritaglio automatico
    // Opzionale per una futura funzione "QR/codice a barre" (Google Code Scanner):
    // implementation("com.google.android.gms:play-services-code-scanner:16.1.0")

    // --- Anteprime immagini
    implementation("io.coil-kt:coil-compose:2.7.0")

    // --- Test
    testImplementation("junit:junit:4.13.2")
}
