#!/bin/bash

echo "Testing YouTube RTMP connection..."

# Test basic connectivity to YouTube RTMP server
echo "1. Testing connection to YouTube RTMP server..."
timeout 5 bash -c '</dev/tcp/a.rtmp.youtube.com/1935' && echo "✓ Can connect to YouTube RTMP server" || echo "✗ Cannot connect to YouTube RTMP server"

# Check if we have a video file to test with
if [ ! -d "uploads" ] || [ -z "$(ls -A uploads 2>/dev/null)" ]; then
    echo "✗ No video files found in uploads directory"
    echo "Please upload a video file first"
    exit 1
fi

# Get the first video file
VIDEO_FILE=$(ls uploads/ | head -1)
echo "2. Testing with video file: $VIDEO_FILE"

# Test FFmpeg command structure (without actually streaming)
echo "3. Testing FFmpeg command structure..."
ffmpeg -f lavfi -i testsrc=duration=1:size=1280x720:rate=30 -c:v libx264 -preset veryfast -tune zerolatency -pix_fmt yuv420p -maxrate 2500k -bufsize 5000k -g 60 -r 30 -c:a aac -b:a 128k -ar 44100 -ac 2 -f flv -t 1 /dev/null 2>/dev/null && echo "✓ FFmpeg command structure is valid" || echo "✗ FFmpeg command structure has issues"

echo "4. YouTube streaming requirements:"
echo "   - Stream key must be active on YouTube Studio"
echo "   - YouTube Live must be enabled on your channel"
echo "   - Stream must be scheduled or set to 'Stream now'"
echo "   - Stream key expires after use and needs to be refreshed"

echo "5. Current stream configuration:"
curl -s http://localhost:5000/api/stream-config || echo "✗ Could not get stream config"