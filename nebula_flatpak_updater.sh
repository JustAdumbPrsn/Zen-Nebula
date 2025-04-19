#!/bin/bash
# Script to download and install Nebula theme chrome.zip for Zen Browser
# Exit on any error
set -e
# Get the current user's home directory
USER_HOME="$HOME"
# Base directory for Zen Browser
BASE_DIR="$USER_HOME/.var/app/app.zen_browser.zen/.zen"
# GitHub repo URL
REPO_URL="https://github.com/JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser"
# GitHub API URL for releases
API_RELEASES_URL="https://api.github.com/repos/JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser/releases/latest"
# Temporary directory for download
TEMP_DIR=$(mktemp -d)
# Function to clean up temporary directory
cleanup() {
    rm -rf "$TEMP_DIR"
}
# Trap to ensure cleanup on exit
trap cleanup EXIT
# Check if curl is installed
if ! command -v curl >/dev/null 2>&1; then
    echo "Error: curl is required but not installed. Please install curl."
    exit 1
fi
# Check if unzip is installed
if ! command -v unzip >/dev/null 2>&1; then
    echo "Error: unzip is required but not installed. Please install unzip."
    exit 1
fi
# Find the directory matching *Default (release)
TARGET_PROFILE=$(find "$BASE_DIR" -maxdepth 1 -type d -name '*Default (release)' | head -1)
if [ -z "$TARGET_PROFILE" ]; then
    echo "Error: Could not find a directory matching '*Default (release)' in $BASE_DIR."
    exit 1
fi
# Target directory for extraction (chrome subdirectory)
TARGET_DIR="$TARGET_PROFILE/chrome"
# Create backup if chrome directory already exists
if [ -d "$TARGET_DIR" ]; then
    BACKUP_DIR="$TARGET_DIR.backup.$(date +%Y%m%d%H%M%S)"
    echo "Creating backup of existing chrome directory at $BACKUP_DIR..."
    cp -r "$TARGET_DIR" "$BACKUP_DIR"
    echo "Backup created successfully."
else
    echo "Creating chrome directory at $TARGET_DIR..."
    mkdir -p "$TARGET_DIR"
fi
# Get the latest release download URL
echo "Fetching latest release information..."

# First method: Try using GitHub API
if DOWNLOAD_URL=$(curl -s "$API_RELEASES_URL" | grep -o '"browser_download_url": *"[^"]*chrome[^"]*\.zip"' | head -1 | sed 's/"browser_download_url": *"//' | sed 's/"$//'); then
    if [ -n "$DOWNLOAD_URL" ]; then
        echo "Found download URL using GitHub API."
    else
        echo "Could not find chrome.zip using GitHub API, trying alternative method..."
        # Second method: Fallback to parsing the HTML
        DOWNLOAD_URL=$(curl -sL "$REPO_URL/releases/latest" | grep -o 'href="[^"]*chrome[^"]*\.zip"' | head -1 | sed 's/href="//' | sed 's/"$//')
        
        # If still not found, try a more general approach
        if [ -z "$DOWNLOAD_URL" ]; then
            echo "Still couldn't find chrome.zip, trying more general approach..."
            # Look for any zip file in the latest release
            DOWNLOAD_URL=$(curl -sL "$REPO_URL/releases/latest" | grep -o 'href="[^"]*\.zip"' | head -1 | sed 's/href="//' | sed 's/"$//')
        fi
        
        # Convert relative URL to absolute if found
        if [ -n "$DOWNLOAD_URL" ]; then
            if [[ $DOWNLOAD_URL == /* ]]; then
                DOWNLOAD_URL="https://github.com$DOWNLOAD_URL"
            fi
        fi
    fi
fi

# Final check if download URL was found
if [ -z "$DOWNLOAD_URL" ]; then
    echo "Error: Could not find any zip files in the latest release."
    echo "Please check the repository manually at $REPO_URL/releases"
    exit 1
fi

# Download the zip file
echo "Downloading theme from $DOWNLOAD_URL..."
curl -L -o "$TEMP_DIR/theme.zip" "$DOWNLOAD_URL"

# Verify download
if [ ! -f "$TEMP_DIR/theme.zip" ]; then
    echo "Error: Failed to download the theme."
    exit 1
fi

# Extract the zip to temporary directory first to check its structure
EXTRACT_TEMP="$TEMP_DIR/extract"
mkdir -p "$EXTRACT_TEMP"
echo "Examining zip file structure..."
unzip -q "$TEMP_DIR/theme.zip" -d "$EXTRACT_TEMP"

# Check if there's a chrome folder inside the extracted contents
if [ -d "$EXTRACT_TEMP/chrome" ]; then
    echo "Detected nested chrome folder in zip. Extracting contents correctly..."
    # Copy contents of the chrome folder to target directory
    cp -r "$EXTRACT_TEMP/chrome/"* "$TARGET_DIR/"
else
    # Extract directly to the target directory
    echo "Extracting theme directly to $TARGET_DIR..."
    unzip -o -q "$TEMP_DIR/theme.zip" -d "$TARGET_DIR"
fi

echo "Nebula theme successfully downloaded and extracted to $TARGET_DIR"
echo "Please follow the Nebula theme installation instructions to complete setup"
echo "A backup of your previous chrome directory is available at $BACKUP_DIR (if it existed)"
