#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo "Starting Android SDK & JDK 17 Setup"
echo "=========================================="

# 1. Install Java 17 and unzip via apt
echo "[1/4] Checking and installing openjdk-17-jdk and unzip..."
sudo apt-get update
sudo apt-get install -y openjdk-17-jdk unzip wget

# Verify Java installation
java -version

# 2. Setup Android SDK Directory
SDK_ROOT="/home/gemini/android-sdk"
echo "[2/4] Setting up Android SDK root at: ${SDK_ROOT}"
mkdir -p "${SDK_ROOT}/cmdline-tools"

# 3. Download Android Command Line Tools
ZIP_PATH="/tmp/commandlinetools-linux.zip"
if [ ! -f "${ZIP_PATH}" ]; then
  echo "Downloading Android Command Line Tools..."
  wget -q --show-progress -O "${ZIP_PATH}" https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
else
  echo "Command Line Tools zip already downloaded."
fi

# Extract tools
EXTRACT_DIR="/tmp/cmdline-tools-extracted"
rm -rf "${EXTRACT_DIR}"
mkdir -p "${EXTRACT_DIR}"

echo "Extracting tools..."
unzip -q "${ZIP_PATH}" -d "${EXTRACT_DIR}"

# Organize into latest/ as required by Android SDK manager
echo "Organizing SDK directory structure..."
rm -rf "${SDK_ROOT}/cmdline-tools/latest"
mkdir -p "${SDK_ROOT}/cmdline-tools/latest"
mv "${EXTRACT_DIR}/cmdline-tools/"* "${SDK_ROOT}/cmdline-tools/latest/"
rm -rf "${EXTRACT_DIR}"

# 4. Install Platforms and Build Tools
echo "[4/4] Installing platform-tools, platforms;android-34, and build-tools;34.0.0..."
export ANDROID_HOME="${SDK_ROOT}"
export PATH="${PATH}:${SDK_ROOT}/cmdline-tools/latest/bin"

# Accept all licenses automatically
yes | sdkmanager --licenses || true

# Install Android packages
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

echo "=========================================="
echo "Android SDK & JDK 17 Setup Complete!"
echo "=========================================="
