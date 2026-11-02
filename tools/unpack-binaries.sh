#!/bin/bash
# Восстанавливает бинарные файлы Android (иконки, заставка, gradle-wrapper.jar) из tools/android-binaries.b64
set -e
cd "$(dirname "$0")/.."
base64 -d tools/android-binaries.b64 | tar -xzf -
chmod +x android/gradlew 2>/dev/null || true
echo "unpacked Android binaries"
