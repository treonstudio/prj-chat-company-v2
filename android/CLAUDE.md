# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chatku is an Android application built with Kotlin and Jetpack Compose. The project uses Material Design 3 with dynamic color support (Android 12+) and follows modern Android development practices.

**Package:** `com.treonstudio.chatku`
**Min SDK:** 24 (Android 7.0)
**Target SDK:** 36
**Compile SDK:** 36
**Java Version:** 11

## Build System

The project uses Gradle with Kotlin DSL and the version catalog feature for dependency management.

### Common Commands

```bash
# Build the project
./gradlew build

# Build debug APK
./gradlew assembleDebug

# Build release APK
./gradlew assembleRelease

# Run unit tests
./gradlew test

# Run unit tests for a specific variant
./gradlew testDebugUnitTest

# Run instrumented tests (requires device/emulator)
./gradlew connectedAndroidTest

# Clean build
./gradlew clean

# Install debug build on connected device
./gradlew installDebug

# Run lint checks
./gradlew lint
```

## Architecture

### UI Layer
- **Compose-based UI:** Entire UI built with Jetpack Compose
- **Material 3:** Using Material Design 3 components with dynamic theming
- **Theme System:** Located in `app/src/main/java/com/treonstudio/chatku/ui/theme/`
  - `Theme.kt` - Main theme composable with dynamic color support
  - `Color.kt` - Color palette definitions
  - `Type.kt` - Typography definitions

### Project Structure
```
app/src/
├── main/
│   ├── java/com/treonstudio/chatku/
│   │   ├── MainActivity.kt          # Single activity hosting Compose UI
│   │   └── ui/theme/                # Theming components
│   ├── res/                         # Android resources
│   └── AndroidManifest.xml
├── test/                            # Unit tests
└── androidTest/                     # Instrumented tests
```

### Key Architecture Notes

1. **Single Activity Architecture:** App uses `MainActivity` as the sole activity with Compose for navigation and UI
2. **Edge-to-Edge Display:** App enables edge-to-edge display mode
3. **Dynamic Theming:** Theme automatically adapts to system theme (light/dark) and supports Material You dynamic colors on Android 12+

## Dependencies

Dependencies are managed through Gradle version catalogs. Check `gradle/libs.versions.toml` for version information.

Core dependencies:
- AndroidX Core KTX
- Lifecycle Runtime KTX
- Activity Compose
- Compose BOM (Bill of Materials)
- Material3
- JUnit (unit tests)
- Espresso (instrumented tests)

## Testing

- **Unit Tests:** Located in `app/src/test/`
- **Instrumented Tests:** Located in `app/src/androidTest/`
- **Test Runner:** AndroidJUnitRunner

Run unit tests with `./gradlew test` and instrumented tests with `./gradlew connectedAndroidTest`.

## Gradle Configuration

- **Gradle Version:** 8.13
- **Build Type:** Two build types configured (debug, release)
- **ProGuard:** Disabled in release builds (can be enabled via `isMinifyEnabled`)
- **Repository Mode:** Project repositories are not allowed (FAIL_ON_PROJECT_REPOS)
