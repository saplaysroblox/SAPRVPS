import { spawn, ChildProcess } from 'child_process';
import { storage } from './storage';
import { log } from './vite';

export interface RTMPConfig {
  inputPath: string;
  outputUrl: string;
  streamKey: string;
  quality: string;
  bitrate: string;
  fps: number;
}

export class RTMPStreamManager {
  private activeStreams: Map<string, ChildProcess> = new Map();
  private streamConfigs: Map<string, RTMPConfig> = new Map();
  private loopEnabled: boolean = false;
  private uptimeInterval: NodeJS.Timeout | null = null;
  private streamStartTime: Date | null = null;

  async getRtmpPort(): Promise<number> {
    try {
      const systemConfig = await storage.getSystemConfig();
      const port = systemConfig?.rtmpPort || 1935;
      log(`Using RTMP port: ${port} from system config`);
      return port;
    } catch (error) {
      log('Failed to get RTMP port from config, using default 1935');
      return 1935;
    }
  }

  async startStream(videoId: number, config: RTMPConfig): Promise<boolean> {
    try {
      const video = await storage.getVideo(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      const streamKey = `video_${videoId}`;
      
      // Stop existing stream if running
      if (this.activeStreams.has(streamKey)) {
        this.stopStream(streamKey);
      }

      // Build FFmpeg command for streaming
      const ffmpegArgs = await this.buildFFmpegArgs(video.filename, config);
      
      log(`Starting RTMP stream for video ${videoId}`);
      log(`Stream config: ${JSON.stringify(config)}`);
      log(`FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);
      
      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
      
      // Handle process events
      ffmpegProcess.stdout?.on('data', (data) => {
        log(`FFmpeg stdout: ${data}`);
      });
      
      ffmpegProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        log(`FFmpeg stderr: ${output}`);
        
        // Check for connection success indicators
        if (output.includes('Stream mapping:') || output.includes('Press [q] to stop')) {
          log('FFmpeg stream successfully connected to RTMP server');
        }
        
        // Check for common streaming errors
        if (output.includes('Connection refused') || output.includes('No route to host')) {
          log('FFmpeg connection error - check stream key and network');
        }
        
        // Check for authentication errors (invalid stream key)
        if (output.includes('401 Unauthorized') || output.includes('403 Forbidden') || output.includes('Invalid stream name')) {
          log('FFmpeg authentication error - check YouTube stream key');
        }
        
        // Check for network connectivity issues
        if (output.includes('Network is unreachable') || output.includes('Connection timed out')) {
          log('FFmpeg network error - check internet connection');
        }
      });
      
      ffmpegProcess.on('close', (code) => {
        log(`FFmpeg process exited with code ${code}`);
        this.activeStreams.delete(streamKey);
        
        // If loop is enabled, automatically play next video
        if (this.loopEnabled) {
          this.playNextVideo(videoId, config);
        } else {
          // Stop uptime tracking and update stream status to offline
          this.stopUptimeTracking();
          storage.createOrUpdateStreamStatus({
            status: 'offline',
            viewerCount: 0,
            uptime: '00:00:00',
            currentVideoId: null,
            startedAt: null,
            loopPlaylist: false,
          });
        }
      });
      
      ffmpegProcess.on('error', (error) => {
        log(`FFmpeg error: ${error.message}`);
        this.activeStreams.delete(streamKey);
        
        // Stop uptime tracking and update stream status to error
        this.stopUptimeTracking();
        storage.createOrUpdateStreamStatus({
          status: 'error',
          viewerCount: 0,
          uptime: '00:00:00',
          currentVideoId: null,
          startedAt: null,
          loopPlaylist: false,
        });
      });
      
      // Store the process and config
      this.activeStreams.set(streamKey, ffmpegProcess);
      this.streamConfigs.set(streamKey, config);
      
      // Start uptime tracking
      this.startUptimeTracking();
      
      return true;
    } catch (error) {
      log(`Error starting stream: ${error}`);
      return false;
    }
  }

  stopStream(streamKey: string): boolean {
    try {
      const process = this.activeStreams.get(streamKey);
      if (process) {
        process.kill('SIGTERM');
        this.activeStreams.delete(streamKey);
        this.streamConfigs.delete(streamKey);
        log(`Stopped stream: ${streamKey}`);
        
        // Stop uptime tracking if no more active streams
        if (this.activeStreams.size === 0) {
          this.stopUptimeTracking();
        }
        
        return true;
      }
      return false;
    } catch (error) {
      log(`Error stopping stream: ${error}`);
      return false;
    }
  }

  stopAllStreams(): void {
    for (const [streamKey] of this.activeStreams) {
      this.stopStream(streamKey);
    }
    this.stopUptimeTracking();
  }

  isStreamActive(streamKey: string): boolean {
    return this.activeStreams.has(streamKey);
  }

  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  setLoopEnabled(enabled: boolean): void {
    this.loopEnabled = enabled;
  }

  isLoopEnabled(): boolean {
    return this.loopEnabled;
  }

  private async playNextVideo(currentVideoId: number, config: RTMPConfig): Promise<void> {
    try {
      // Get all videos ordered by playlist order
      const videos = await storage.getVideos();
      if (videos.length === 0) {
        log('No videos available for loop playback');
        return;
      }

      // Find current video index
      const currentIndex = videos.findIndex(v => v.id === currentVideoId);
      
      // Get next video (loop to first if at end)
      const nextIndex = (currentIndex + 1) % videos.length;
      const nextVideo = videos[nextIndex];

      log(`Loop playback: Moving from video ${currentVideoId} to video ${nextVideo.id} (${nextVideo.title})`);

      // Update stream status with next video
      await storage.createOrUpdateStreamStatus({
        status: 'live',
        viewerCount: 0,
        uptime: '00:00:00',
        currentVideoId: nextVideo.id,
        startedAt: new Date(),
        loopPlaylist: true,
      });

      // Start streaming next video with a slight delay
      setTimeout(() => {
        this.startStream(nextVideo.id, config);
      }, 1000);

    } catch (error) {
      log(`Error in loop playback: ${error}`);
      // Fall back to offline status
      await storage.createOrUpdateStreamStatus({
        status: 'offline',
        viewerCount: 0,
        uptime: '00:00:00',
        currentVideoId: null,
        startedAt: null,
        loopPlaylist: false,
      });
    }
  }

  private startUptimeTracking(): void {
    this.streamStartTime = new Date();
    
    // Clear existing interval if any
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
    }
    
    // Update uptime every 5 seconds
    this.uptimeInterval = setInterval(async () => {
      if (this.streamStartTime && this.activeStreams.size > 0) {
        const uptimeMs = Date.now() - this.streamStartTime.getTime();
        const uptimeString = this.formatUptime(uptimeMs);
        
        // Get current stream status
        const currentStatus = await storage.getStreamStatus();
        if (currentStatus && currentStatus.status === 'live') {
          // Keep viewer count at 0 since we can't get real YouTube viewer data
          const viewerCount = 0;
          
          await storage.createOrUpdateStreamStatus({
            status: 'live',
            viewerCount: viewerCount,
            uptime: uptimeString,
            currentVideoId: currentStatus.currentVideoId,
            startedAt: this.streamStartTime,
            loopPlaylist: currentStatus.loopPlaylist,
          });
        }
      }
    }, 5000);
  }

  private stopUptimeTracking(): void {
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
      this.uptimeInterval = null;
    }
    this.streamStartTime = null;
  }

  private formatUptime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private async buildFFmpegArgs(videoPath: string, config: RTMPConfig): Promise<string[]> {
    const args = [
      '-stream_loop', '-1', // Loop the input indefinitely
      '-re', // Read input at native frame rate
      '-i', `uploads/${videoPath}`, // Input file
      '-c:v', 'libx264', // Video codec
      '-preset', 'veryfast', // Encoding preset for speed
      '-tune', 'zerolatency', // Optimize for low latency
      '-pix_fmt', 'yuv420p', // Pixel format compatible with most platforms
      '-maxrate', config.bitrate, // Maximum bitrate
      '-bufsize', `${parseInt(config.bitrate) * 2}k`, // Buffer size
      '-vf', `scale=-2:${this.getResolutionHeight(config.quality)}`, // Scale video
      '-g', `${config.fps * 2}`, // GOP size (keyframe interval)
      '-r', config.fps.toString(), // Frame rate
      '-c:a', 'aac', // Audio codec
      '-b:a', '128k', // Audio bitrate
      '-ar', '44100', // Audio sample rate
      '-ac', '2', // Audio channels (stereo)
      '-f', 'flv', // Output format for RTMP
      '-reconnect', '1', // Enable reconnection
      '-reconnect_streamed', '1', // Reconnect for streamed inputs
      '-reconnect_delay_max', '5', // Maximum delay between reconnection attempts
    ];

    // Add output URL with proper formatting using configured RTMP port
    if (config.outputUrl.includes('rtmp://') || config.outputUrl.includes('rtmps://')) {
      args.push(`${config.outputUrl}/${config.streamKey}`);
    } else {
      // Use configured RTMP port from system config
      const rtmpPort = await this.getRtmpPort();
      args.push(`rtmp://localhost:${rtmpPort}/live/${config.streamKey}`);
    }

    return args;
  }

  private getResolutionHeight(quality: string): number {
    switch (quality) {
      case '1080p': return 1080;
      case '720p': return 720;
      case '480p': return 480;
      case '360p': return 360;
      default: return 720;
    }
  }

  // Stream to multiple platforms
  async streamToMultiplePlatforms(videoId: number, platforms: Array<{platform: string, url: string, key: string}>): Promise<boolean> {
    try {
      const video = await storage.getVideo(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      const streamKey = `multistream_${videoId}`;
      
      // Stop existing stream if running
      if (this.activeStreams.has(streamKey)) {
        this.stopStream(streamKey);
      }

      // Build FFmpeg command for multi-platform streaming
      const args = [
        '-re',
        '-i', `uploads/${video.filename}`,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'veryfast',
        '-maxrate', '3000k',
        '-bufsize', '6000k',
        '-vf', 'scale=-2:720',
        '-g', '60',
        '-r', '30',
        '-f', 'flv',
      ];

      // Add multiple outputs
      platforms.forEach(platform => {
        args.push('-f', 'flv', `${platform.url}/${platform.key}`);
      });

      log(`Starting multi-platform stream for video ${videoId}`);
      
      const ffmpegProcess = spawn('ffmpeg', args);
      
      // Handle process events (same as single stream)
      ffmpegProcess.stdout?.on('data', (data) => {
        log(`Multi-stream FFmpeg stdout: ${data}`);
      });
      
      ffmpegProcess.stderr?.on('data', (data) => {
        log(`Multi-stream FFmpeg stderr: ${data}`);
      });
      
      ffmpegProcess.on('close', (code) => {
        log(`Multi-stream FFmpeg process exited with code ${code}`);
        this.activeStreams.delete(streamKey);
      });
      
      ffmpegProcess.on('error', (error) => {
        log(`Multi-stream FFmpeg error: ${error.message}`);
        this.activeStreams.delete(streamKey);
      });
      
      this.activeStreams.set(streamKey, ffmpegProcess);
      
      return true;
    } catch (error) {
      log(`Error starting multi-platform stream: ${error}`);
      return false;
    }
  }
}

export const rtmpManager = new RTMPStreamManager();

// Cleanup on process exit
process.on('SIGINT', () => {
  log('Shutting down RTMP streams...');
  rtmpManager.stopAllStreams();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Shutting down RTMP streams...');
  rtmpManager.stopAllStreams();
  process.exit(0);
});