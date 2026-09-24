import sys
import urllib.request
import urllib.parse
import re

def search_youtube(query):
    # Format the search query for a URL
    query_string = urllib.parse.quote(query)
    search_url = f"https://www.youtube.com/results?search_query={query_string}"
    
    try:
        # Fetch the HTML from the search results page
        html = urllib.request.urlopen(search_url)
        video_ids = re.findall(r"watch\?v=(\S{11})", html.read().decode())
        
        # If we found video IDs, return the first one as a full URL
        if video_ids:
            return f"https://www.youtube.com/watch?v={video_ids[0]}"
    except Exception as e:
        return ""
    
    return ""

if __name__ == "__main__":
    # Combine all command line arguments into one search string
    if len(sys.argv) > 1:
        search_term = " ".join(sys.argv[1:])
        url = search_youtube(search_term)
        if url:
            print(url)