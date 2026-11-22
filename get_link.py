import sys
import urllib.request
import urllib.parse
import re

def search_youtube(query):
    query_string = urllib.parse.quote(query)
    search_url = f"https://www.youtube.com/results?search_query={query_string}"
    
    try:
        html = urllib.request.urlopen(search_url)
        video_ids = re.findall(r"watch\?v=(\S{11})", html.read().decode())
        
        if video_ids:
            return f"https://www.youtube.com/watch?v={video_ids[0]}"
    except Exception as e:
        return ""
    
    return ""

if __name__ == "__main__":
    if len(sys.argv) > 1:
        search_term = " ".join(sys.argv[1:])
        url = search_youtube(search_term)
        if url:
            print(url)
