#!/bin/bash
# Упаковывает бинарные файлы Android (иконки, заставка, gradle-wrapper.jar) в текстовый файл tools/android-binaries.b64.
# Подключение GitHub, через которое ведётся работа, загружает только текст. Распаковка: tools/unpack-binaries.sh
set -e
cd "$(dirname "$0")/.."
{ find android/app/src/main/res -name '*.png' | LC_ALL=C sort; echo android/gradle/wrapper/gradle-wrapper.jar; } > /tmp/wf_binaries.txt
tar -cf - --owner=0 --group=0 --numeric-owner --mtime='2026-01-01 00:00:00' -T /tmp/wf_binaries.txt | gzip -n -9 | base64 -w 76 > tools/android-binaries.b64
echo "packed $(wc -l < /tmp/wf_binaries.txt) files → tools/android-binaries.b64"
