#!/bin/bash
# Installs JDK 21 + Android SDK (cmdline-tools, platform 36, build-tools) into /data/android-sdk
set -x
sudo dnf install -y java-21-amazon-corretto-devel > /tmp/jdk.log 2>&1
cd /tmp
F=$(curl -s https://dl.google.com/android/repository/repository2-3.xml | grep -o 'commandlinetools-linux-[0-9]*_latest.zip' | head -1)
curl -s -o clt.zip "https://dl.google.com/android/repository/$F"
rm -rf /data/android-sdk/cmdline-tools && mkdir -p /data/android-sdk/cmdline-tools && unzip -q clt.zip -d /data/android-sdk/cmdline-tools && mv /data/android-sdk/cmdline-tools/cmdline-tools /data/android-sdk/cmdline-tools/latest
export JAVA_HOME=/usr/lib/jvm/java-21-amazon-corretto.x86_64
yes | /data/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/data/android-sdk --licenses > /tmp/lic.log 2>&1
/data/android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/data/android-sdk "platform-tools" "platforms;android-36" "build-tools;36.0.0" > /tmp/sdk.log 2>&1
echo SETUP_DONE
