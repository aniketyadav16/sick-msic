#!/bin/bash

# Target directory is current directory of script unless specified
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${2:-$SCRIPT_DIR}"

cd "$TARGET_DIR" || exit 1

if [[ $# -lt 1 ]]; then 
    echo "Usage: $0 <youtube_url_or_search_term> [target_dir]"
    exit 1
fi

URL="$1"

# If not a URL, use ytsearch
if [[ ! "$URL" =~ ^https?:// ]]; then
    yt-dlp -x --audio-format mp3 "ytsearch1:$URL"
else
    yt-dlp -x --audio-format mp3 "$URL"
fi
