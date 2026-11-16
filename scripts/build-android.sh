#!/usr/bin/env bash
# Compila el proyecto Android con el SDK local o el del entorno/CI.
set -euo pipefail

if [ -z "${JAVA_HOME:-}" ] && [ -d "$HOME/opt/android-mobile/jdk-21" ]; then
  export JAVA_HOME="$HOME/opt/android-mobile/jdk-21"
fi
if [ -z "${ANDROID_HOME:-}" ] && [ -d "$HOME/opt/android-mobile/android-sdk" ]; then
  export ANDROID_HOME="$HOME/opt/android-mobile/android-sdk"
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

if [ -z "${JAVA_HOME:-}" ] || [ -z "${ANDROID_HOME:-}" ]; then
  echo "Define JAVA_HOME (JDK 21) y ANDROID_HOME (Android SDK 36) antes de compilar." >&2
  exit 1
fi

cd "$(dirname "$0")/../android"
./gradlew "${@:-assembleDebug}" --no-daemon
