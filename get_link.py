import sys
import urllib.request
import urllib.parse
import re
import subprocess
import shutil

def search_youtube(query):
    query_string = urllib.parse.quote(query)
    search_url = f"https://www.youtube.com/results?search_query={query_string}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        req = urllib.request.Request(search_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode('utf-8', errors='ignore')
            video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
            if not video_ids:
                video_ids = re.findall(r"watch\?v=([a-zA-Z0-9_-]{11})", html)
            
            if video_ids:
                return f"https://www.youtube.com/watch?v={video_ids[0]}"
    except Exception:
        pass
        
    # Fallback to yt-dlp get-id if available
    ytdlp = shutil.which("yt-dlp") or "/Library/Frameworks/Python.framework/Versions/3.12/bin/yt-dlp"
    if ytdlp:
        try:
            res = subprocess.run([ytdlp, f"ytsearch1:{query}", "--get-id"], capture_output=True, text=True, timeout=15)
            vid = res.stdout.strip()
            if vid and len(vid) == 11:
                return f"https://www.youtube.com/watch?v={vid}"
        except Exception:
            pass

    return ""

if __name__ == "__main__":
    if len(sys.argv) > 1:
        search_term = " ".join(sys.argv[1:])
        url = search_youtube(search_term)
        if url:
            print(url)

