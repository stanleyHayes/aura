#!/usr/bin/env bash
# Build a local Android APK for testing — no Apple account, no paid plan needed.
# Output: apps/mobile/build/aura.apk  (share the file directly; testers enable
# "Install unknown apps" on their phone to sideload it).
#
# Prerequisites:
#   • JDK 17 and the Android SDK (set ANDROID_HOME / ANDROID_SDK_ROOT)
#   • A free Expo account — run once:  npx eas-cli login
#     (the build still runs locally and free; the login only identifies the project)
#
# The "staging" profile in eas.json builds an internal APK for Android and reads
# APP_VARIANT=staging from the profile. Provide the deployed API URL and real EAS
# project id through environment variables or EAS secrets before running.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${EXPO_PUBLIC_API_BASE_URL:?Set EXPO_PUBLIC_API_BASE_URL to the deployed HTTPS API root, e.g. https://aura-api.onrender.com/api/v1}"
: "${EAS_PROJECT_ID:?Set EAS_PROJECT_ID to the real UUID from eas init}"
mkdir -p build
echo "▶  Building Android APK (eas.json 'staging' profile, locally)..."
npx eas-cli build --platform android --profile staging --local --output "$PWD/build/aura.apk"
echo ""
echo "Done — APK at: apps/mobile/build/aura.apk"
echo "    Send it to testers; they enable 'Install unknown apps' to install it."
