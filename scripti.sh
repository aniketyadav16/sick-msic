#!/bin/bash

cd /users/aniketyadav/downloads/aria/music

if [[ $# != 1 ]]
then 
    echo "Only one arg acceptable you phool! Or did you provide none?"
    exit 1
fi

yt-dlp -x --audio-format mp3 "$1"



