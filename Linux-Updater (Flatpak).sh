#!/usr/bin/env bash

# COLORS
GREEN="\033[1;32m"
BLUE="\033[1;34m"
CYAN="\033[1;36m"
RED="\033[1;31m"
YELLOW="\033[1;33m"
RESET="\033[0m"

# PATHS
BASE_DIR="$HOME/.var/app/app.zen_browser.zen/.zen"
PROFILE_DIR=$(find "$BASE_DIR" -maxdepth 1 -type d -name '*Default (release)' | head -1)
CHROME_DIR="$PROFILE_DIR/chrome"
NEBULA_DIR="$CHROME_DIR/Nebula"
LATEST_RELEASE=$(curl -s "https://api.github.com/repos/JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser/releases/latest" | jq -r '.tag_name')

# Detect the default package manager
detect_package_manager() {
    for pkg in apt dnf pacman yay zypper; do
        if command -v "$pkg" >/dev/null 2>&1; then
            echo "$pkg"
            return
        fi
    done
    echo "unsupported"
}

# Check for pre-requisites
check_prerequisites() {
    MISSING_TOOLS=()
    for tool in curl unzip tar jq; do
        command -v "$tool" >/dev/null 2>&1 || MISSING_TOOLS+=("$tool")
    done

    if [[ ${#MISSING_TOOLS[@]} -eq 0 ]]; then
        return 0
    fi

    echo -e "${RED}⚠ Missing required tools: ${CYAN}${MISSING_TOOLS[*]}${RESET}"
    echo -e "${YELLOW}You need to install these manually before running the script.${RESET}"

    PKG_MANAGER=$(detect_package_manager)

    if [[ "$PKG_MANAGER" = "unsupported" ]]; then
        echo -e "${RED}❌ No supported package manager found. Install manually and rerun the script.${RESET}"
        exit 1
    fi

    echo -ne "${YELLOW}Install using ${CYAN}$PKG_MANAGER${YELLOW}? (y/N): ${RESET}"
    read -r USER_CHOICE

    case "${USER_CHOICE,,}" in
        y)
            echo -e "${CYAN}🔹 Installing missing tools...${RESET}"
            sudo "$PKG_MANAGER" install -y ${MISSING_TOOLS[*]} >/dev/null 2>&1 && echo -e "${GREEN}✔ Installation complete!${RESET}"
            ;;
        *)
            echo -e "${RED}❌ Installation declined. Please install manually and rerun the script.${RESET}"
            exit 1
            ;;
    esac
}

# Check for required tools before proceeding
check_prerequisites

# Do not run if profile directory is not found
if [[ -z "$PROFILE_DIR" ]]; then
    echo -e "${RED}❌ Profile folder not found! Exiting...${RESET}"
    exit 1
fi

# Ensure chrome folder exists
mkdir -p "$CHROME_DIR"

echo -e "${BLUE}===================================="
echo -e " 🚀 ${CYAN}Updating Nebula-A-Minimal-Theme-for-Zen-Browser${RESET}"
echo -e "${BLUE}===================================="

# Optional full chrome folder backup
echo -ne "${YELLOW}Backup current setup before updating? (Y/n): ${RESET}"
read -r BACKUP_CHOICE

case "${BACKUP_CHOICE,,}" in
    n) ;;
    *)
        BACKUP_PATH="$PROFILE_DIR/Chrome-Folder-Backup-$(date +%Y-%m-%d_%H-%M-%S).tar.gz"
        tar -czf "$BACKUP_PATH" -C "$CHROME_DIR" .
        echo -e "${GREEN}✔ Full backup created at: ${CYAN}$BACKUP_PATH${RESET}"
        ;;
esac

# Function for showing progress
progress() {
    echo -ne "${CYAN}→ $1...${RESET}"
    sleep 0.8
    echo -e "${GREEN} ✔ Done!${RESET}"
    sleep 0.2
}

progress "Downloading ${YELLOW}userChrome.css${RESET}"
curl -s -o "$CHROME_DIR/userChrome.css" "https://raw.githubusercontent.com/JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser/main/userChrome.css"

progress "Downloading ${YELLOW}userContent.css${RESET}"
curl -s -o "$CHROME_DIR/userContent.css" "https://raw.githubusercontent.com/JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser/main/userContent.css"

progress "Fetching latest Nebula theme"
curl -s -L -o "$CHROME_DIR/Nebula.zip" "https://github.com/JustAdumbPrsn/Nebula-A-Minimal-Theme-for-Zen-Browser/archive/refs/heads/main.zip"

progress "Extracting ${YELLOW}Nebula files${RESET}"
unzip -qq "$CHROME_DIR/Nebula.zip" -d "$CHROME_DIR"

# Ask user if they want to back up the old Nebula folder
if [ -d "$NEBULA_DIR" ]; then
    echo -ne "${YELLOW}Backup old Nebula folder before replacing it? (Y/n): ${RESET}"
    read -r BACKUP_NEBULA
    case "${BACKUP_NEBULA,,}" in
        n) echo -e "${RED}⚠ Skipping Nebula folder backup.${RESET}" ;;
        *)
            BACKUP_NEBULA_DIR="$CHROME_DIR/Nebula-Backup-$(date +%Y-%m-%d_%H-%M-%S)"
            cp -r "$NEBULA_DIR" "$BACKUP_NEBULA_DIR"
            echo -e "${GREEN}✔ Nebula folder backed up to: ${CYAN}$BACKUP_NEBULA_DIR${RESET}"
            ;;
    esac
fi

progress "Cleaning up old version"
rm -rf "$NEBULA_DIR"
mv "$CHROME_DIR/Nebula-A-Minimal-Theme-for-Zen-Browser-main/Nebula/" "$CHROME_DIR"
rm -rf "$CHROME_DIR/Nebula-A-Minimal-Theme-for-Zen-Browser-main/" "$CHROME_DIR/Nebula.zip"

echo -e "${BLUE}===================================="
echo -e "${GREEN}✔ Nebula updated to build ${YELLOW}$LATEST_RELEASE${RESET}"
echo -e "${BLUE}===================================="

progress "Returning to home directory"
cd "$HOME"

echo -e "${CYAN}🔹 Relaunch Zen Browser for changes to take effect! 🔹${RESET}"
