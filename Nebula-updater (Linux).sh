#!/usr/bin/env bash

# Detect install type and set base directory
if flatpak info app.zen_browser.zen >/dev/null 2>&1; then
    BASE_DIR="$HOME/.var/app/app.zen_browser.zen/.zen"
    INSTALL_TYPE="flatpak"
else
    BASE_DIR="$HOME/.zen"
    INSTALL_TYPE="pkg"
fi

# Find profile directory
PROFILE_DIR=$(find "$BASE_DIR" -maxdepth 1 -type d \( -name '*Default (release)' -o -name 'Default' -o -name 'Profile*' \) | head -1)
CHROME_DIR="$PROFILE_DIR/chrome"
NEBULA_DIR="$CHROME_DIR/Nebula"

# Detect package manager
get_pkg_manager() {
    for pkg in apt dnf pacman yay zypper; do
        command -v "$pkg" >/dev/null 2>&1 && { echo "$pkg"; return; }
    done
    echo "unsupported"
}

# Check prerequisites
check_prerequisites() {
    local missing=()
    for tool in curl unzip tar jq; do
        command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
    done
    (( ${#missing[@]} == 0 )) && return 0
    echo "⚠ Missing required tools: ${missing[*]}"
    echo "You need to install these manually before running the script."
    local pkg_manager=$(get_pkg_manager)
    if [[ "$pkg_manager" == "unsupported" ]]; then
        echo "❌ No supported package manager found. Install manually and rerun the script."
        exit 1
    fi
    local install_cmd="sudo $pkg_manager install -y"
    [[ "$pkg_manager" == "pacman" ]] && install_cmd="sudo pacman -S --noconfirm"
    read -rp "Install using $pkg_manager? (y/N): " user_choice
    if [[ "${user_choice,,}" == "y" ]]; then
        echo "🔹 Installing missing tools..."
        $install_cmd ${missing[*]} >/dev/null 2>&1 && echo "✔ Installation complete!"
    else
        echo "❌ Installation declined. Please install manually and rerun the script."
        exit 1
    fi
}

warn()    { echo -e "\e[33m⚠ $1\e[0m"; }
info()    { echo -e "\e[34mℹ $1\e[0m"; }
success() { echo -e "\e[32m✔ $1\e[0m"; }
error()   { echo -e "\e[31m❌ $1\e[0m"; }

check_prerequisites

LATEST_RELEASE=$(curl -s "https://api.github.com/repos/JustAdumbPrsn/Zen-Nebula/releases/latest" | jq -r '.tag_name')

[[ -z "$PROFILE_DIR" ]] && { error "Profile folder not found! Exiting..."; exit 1; }
mkdir -p "$CHROME_DIR"

echo "========================================="
echo "         🚀 Zen-Nebula Updater"
echo "========================================="

progress() {
    local label="$1"
    local pad=$((40 - ${#label}))
    (( pad < 0 )) && pad=0
    echo -ne "→ $label"
    printf '%*s' "$pad" ""
    success ""
    [[ -z "$NO_PROGRESS_SLEEP" ]] && { sleep 1; }
}

[[ ! -w "$BASE_DIR" ]] && { error "No write permission to $BASE_DIR. Please run as a user with the correct permissions."; exit 1; }

if [[ -d "$CHROME_DIR" && $(ls -A "$CHROME_DIR") ]]; then
    read -rp "Backup current setup before updating? (Y/n): " BACKUP_CHOICE
    if [[ ! "${BACKUP_CHOICE,,}" =~ ^n ]]; then
        BACKUP_PATH="$PROFILE_DIR/Chrome-Folder-Backup-$(date +%Y-%m-%d_%H-%M-%S).tar.gz"
        tar -czf "$BACKUP_PATH" -C "$CHROME_DIR" .
        success "Full backup created at: $BACKUP_PATH"
    fi
else
    warn "No files to back up in $CHROME_DIR. Skipping backup step."
fi

if pgrep -f "zen-browser" >/dev/null 2>&1; then
    warn "Zen Browser appears to be running. Please close it before continuing for best results."
    read -rp "Continue anyway? (y/N): " CONTINUE_RUNNING
    [[ ! "${CONTINUE_RUNNING,,}" =~ ^y ]] && { warn "Aborting update while Zen Browser is running."; exit 1; }
fi

cleanup() { rm -rf "$CHROME_DIR/Zen-Nebula-main" "$CHROME_DIR/Nebula.zip"; }
trap cleanup EXIT

progress "Downloading userChrome.css"
curl -fsSL -o "$CHROME_DIR/userChrome.css" "https://raw.githubusercontent.com/JustAdumbPrsn/Zen-Nebula/main/userChrome.css" || { error "Failed to download userChrome.css. Aborting."; exit 1; }

progress "Downloading userContent.css"
curl -fsSL -o "$CHROME_DIR/userContent.css" "https://raw.githubusercontent.com/JustAdumbPrsn/Zen-Nebula/main/userContent.css" || { error "Failed to download userContent.css. Aborting."; exit 1; }

progress "Fetching latest Nebula theme"
curl -fsSL -o "$CHROME_DIR/Nebula.zip" "https://github.com/JustAdumbPrsn/Zen-Nebula/archive/refs/heads/main.zip" || { error "Failed to download Nebula theme archive. Aborting."; exit 1; }

progress "Extracting Nebula files"
unzip -qq "$CHROME_DIR/Nebula.zip" -d "$CHROME_DIR" && [[ -d "$CHROME_DIR/Zen-Nebula-main/Nebula" ]] || { error "Failed to extract Nebula files. Aborting."; exit 1; }

if [ -d "$NEBULA_DIR" ]; then
    read -rp "Backup old Nebula folder before replacing it? (Y/n): " BACKUP_NEBULA
    if [[ ! "${BACKUP_NEBULA,,}" =~ ^n ]]; then
        BACKUP_NEBULA_DIR="$CHROME_DIR/Nebula-Backup-$(date +%Y-%m-%d_%H-%M-%S)"
        cp -r "$NEBULA_DIR" "$BACKUP_NEBULA_DIR"
        success "Nebula folder backed up to: $BACKUP_NEBULA_DIR"
    else
        warn "Skipping Nebula folder backup."
    fi
fi

progress "Cleaning up old version"
rm -rf "$NEBULA_DIR"
[[ ! -d "$CHROME_DIR/Zen-Nebula-main/Nebula" ]] && { error "Extracted Nebula folder not found. Aborting."; exit 1; }
mv "$CHROME_DIR/Zen-Nebula-main/Nebula/" "$CHROME_DIR"
rm -rf "$CHROME_DIR/Zen-Nebula-main/" "$CHROME_DIR/Nebula.zip"

echo "========================================="
echo "✔ Nebula updated to build $LATEST_RELEASE"
echo "========================================="

progress "Returning to home directory"
cd "$HOME"

info "Relaunch Zen Browser for changes to take effect!"
