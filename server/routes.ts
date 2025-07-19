import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { rtmpManager } from "./rtmp";
import { insertVideoSchema, insertStreamConfigSchema, insertStreamStatusSchema, insertSystemConfigSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { execSync, spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import { db } from "./db";

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only MP4, AVI, and MOV files are allowed.'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  }
});

// Helper function to get video duration using FFmpeg
async function getVideoDuration(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('Error getting video duration:', err);
        resolve('00:00');
        return;
      }
      
      const duration = metadata.format.duration;
      if (!duration) {
        resolve('00:00');
        return;
      }
      
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      resolve(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    });
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Serve uploaded videos
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
  // Video routes
  app.get("/api/videos", async (req, res) => {
    try {
      const videos = await storage.getVideos();
      res.json(videos);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.post("/api/videos", upload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file uploaded" });
      }

      const { title } = req.body;
      const videos = await storage.getVideos();
      
      // Get video duration using FFmpeg
      const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
      const duration = await getVideoDuration(filePath);
      
      const videoData = {
        title: title || req.file.originalname,
        filename: req.file.filename,
        fileSize: req.file.size,
        duration: duration,
        thumbnailUrl: null,
        playlistOrder: videos.length,
      };

      const result = insertVideoSchema.safeParse(videoData);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid video data", errors: result.error.errors });
      }

      const video = await storage.createVideo(result.data);
      res.status(201).json(video);
    } catch (error) {
      console.error('Error uploading video:', error);
      res.status(500).json({ message: "Failed to upload video" });
    }
  });

  app.put("/api/videos/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertVideoSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid video data", errors: result.error.errors });
      }

      const video = await storage.updateVideo(id, result.data);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      res.json(video);
    } catch (error) {
      res.status(500).json({ message: "Failed to update video" });
    }
  });

  app.delete("/api/videos/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteVideo(id);
      
      if (!success) {
        return res.status(404).json({ message: "Video not found" });
      }

      res.json({ message: "Video deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete video" });
    }
  });

  app.post("/api/videos/reorder", async (req, res) => {
    try {
      const { videoIds } = req.body;
      
      if (!Array.isArray(videoIds)) {
        return res.status(400).json({ message: "videoIds must be an array" });
      }

      await storage.reorderPlaylist(videoIds);
      res.json({ message: "Playlist reordered successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to reorder playlist" });
    }
  });

  // Stream configuration routes
  app.get("/api/stream-config", async (req, res) => {
    try {
      const config = await storage.getStreamConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stream configuration" });
    }
  });

  app.post("/api/stream-config", async (req, res) => {
    try {
      const result = insertStreamConfigSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: "Invalid stream configuration", errors: result.error.errors });
      }

      const config = await storage.createOrUpdateStreamConfig(result.data);
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to save stream configuration" });
    }
  });

  // Stream status routes
  app.get("/api/stream-status", async (req, res) => {
    try {
      const status = await storage.getStreamStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stream status" });
    }
  });

  app.post("/api/stream/start", async (req, res) => {
    try {
      const streamStatus = await storage.getStreamStatus();
      const currentVideoId = streamStatus?.currentVideoId;
      
      if (!currentVideoId) {
        return res.status(400).json({ message: "No video selected for streaming" });
      }

      const video = await storage.getVideo(currentVideoId);
      if (!video) {
        return res.status(400).json({ message: "Selected video not found" });
      }

      // Get stream configuration
      const streamConfig = await storage.getStreamConfig();
      if (!streamConfig) {
        return res.status(400).json({ message: "Stream configuration not found" });
      }

      // Convert resolution format for FFmpeg
      const convertResolution = (resolution: string): string => {
        switch (resolution) {
          case '1920x1080': return '1080p';
          case '1280x720': return '720p';
          case '854x480': return '480p';
          default: return '720p';
        }
      };

      // Get platform-specific RTMP URL
      const getPlatformRTMPUrl = (platform: string, customUrl?: string): string => {
        switch (platform.toLowerCase()) {
          case 'youtube':
            return 'rtmp://a.rtmp.youtube.com/live2';
          case 'twitch':
            return 'rtmp://live.twitch.tv/app';
          case 'facebook':
            return 'rtmps://live-api-s.facebook.com:443/rtmp';
          case 'custom':
            return customUrl || 'rtmp://localhost:1935/live';
          default:
            return customUrl || 'rtmp://a.rtmp.youtube.com/live2';
        }
      };

      // Start RTMP stream
      const rtmpConfig = {
        inputPath: video.filename,
        outputUrl: getPlatformRTMPUrl(streamConfig.platform, streamConfig.rtmpUrl),
        streamKey: streamConfig.streamKey || 'default',
        quality: convertResolution(streamConfig.resolution || '1280x720'),
        bitrate: `${streamConfig.bitrate}k` || '3000k',
        fps: streamConfig.framerate || 30
      };

      const streamStarted = await rtmpManager.startStream(currentVideoId, rtmpConfig);
      
      if (!streamStarted) {
        return res.status(500).json({ message: "Failed to start RTMP stream" });
      }

      // Set loop enabled based on current status
      rtmpManager.setLoopEnabled(streamStatus?.loopPlaylist || false);

      const status = await storage.createOrUpdateStreamStatus({
        status: 'live',
        viewerCount: 0,
        uptime: '00:00:00',
        currentVideoId: currentVideoId,
        startedAt: new Date(),
        loopPlaylist: streamStatus?.loopPlaylist || false,
      });

      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to start stream" });
    }
  });

  app.post("/api/stream/stop", async (req, res) => {
    try {
      // Stop all RTMP streams
      rtmpManager.stopAllStreams();

      // Disable loop when stopping stream
      rtmpManager.setLoopEnabled(false);

      const status = await storage.createOrUpdateStreamStatus({
        status: 'offline',
        viewerCount: 0,
        uptime: '00:00:00',
        currentVideoId: null,
        startedAt: null,
        loopPlaylist: false,
      });

      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to stop stream" });
    }
  });



  app.post("/api/stream/restart", async (req, res) => {
    try {
      const videos = await storage.getVideos();
      if (videos.length === 0) {
        return res.status(400).json({ message: "No videos in playlist" });
      }

      const status = await storage.createOrUpdateStreamStatus({
        status: 'live',
        viewerCount: Math.floor(Math.random() * 2000) + 100,
        uptime: '00:00:00',
        currentVideoId: videos[0].id,
        startedAt: new Date(),
        loopPlaylist: false,
      });

      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to restart stream" });
    }
  });

  app.post("/api/stream/set-current", async (req, res) => {
    try {
      const { videoId } = req.body;
      
      if (!videoId) {
        return res.status(400).json({ message: "Video ID is required" });
      }

      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      const currentStatus = await storage.getStreamStatus();
      const status = await storage.createOrUpdateStreamStatus({
        status: currentStatus?.status || 'offline',
        viewerCount: currentStatus?.viewerCount || 0,
        uptime: currentStatus?.uptime || '00:00:00',
        currentVideoId: videoId,
        startedAt: currentStatus?.startedAt || null,
        loopPlaylist: currentStatus?.loopPlaylist || false,
      });

      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to set current video" });
    }
  });

  // Loop control endpoints
  app.post("/api/stream/loop/enable", async (req, res) => {
    try {
      const currentStatus = await storage.getStreamStatus();
      const status = await storage.createOrUpdateStreamStatus({
        status: currentStatus?.status || 'offline',
        viewerCount: currentStatus?.viewerCount || 0,
        uptime: currentStatus?.uptime || '00:00:00',
        currentVideoId: currentStatus?.currentVideoId || null,
        startedAt: currentStatus?.startedAt || null,
        loopPlaylist: true,
      });

      // Update RTMP manager if stream is active
      if (status.status === 'live') {
        rtmpManager.setLoopEnabled(true);
      }

      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to enable playlist loop" });
    }
  });

  app.post("/api/stream/loop/disable", async (req, res) => {
    try {
      const currentStatus = await storage.getStreamStatus();
      const status = await storage.createOrUpdateStreamStatus({
        status: currentStatus?.status || 'offline',
        viewerCount: currentStatus?.viewerCount || 0,
        uptime: currentStatus?.uptime || '00:00:00',
        currentVideoId: currentStatus?.currentVideoId || null,
        startedAt: currentStatus?.startedAt || null,
        loopPlaylist: false,
      });

      // Update RTMP manager
      rtmpManager.setLoopEnabled(false);

      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to disable playlist loop" });
    }
  });

  app.get("/api/stream/loop/status", async (req, res) => {
    try {
      const status = await storage.getStreamStatus();
      res.json({ 
        loopEnabled: status?.loopPlaylist || false,
        rtmpLoopEnabled: rtmpManager.isLoopEnabled()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get loop status" });
    }
  });

  app.post("/api/stream/test", (req, res) => {
    console.log("Stream test endpoint called");
    
    try {
      
      // Try different FFmpeg paths
      const ffmpegPaths = [
        'ffmpeg',
        '/nix/store/3zc5jbvqzrn8zmva4fx5p0nh4yy03wk4-ffmpeg-6.1.1-bin/bin/ffmpeg',
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg'
      ];
      
      let ffmpegFound = false;
      let ffmpegOutput = '';
      
      for (const ffmpegPath of ffmpegPaths) {
        try {
          const result = execSync(`${ffmpegPath} -version`, { 
            timeout: 5000, 
            encoding: 'utf8',
            stdio: 'pipe',
            env: { ...process.env, PATH: process.env.PATH }
          });
          
          if (result.includes('ffmpeg version')) {
            ffmpegFound = true;
            ffmpegOutput = result;
            console.log(`FFmpeg found at: ${ffmpegPath}`);
            break;
          }
        } catch (pathError) {
          console.log(`FFmpeg not found at ${ffmpegPath}:`, pathError.message);
          continue;
        }
      }
      
      if (ffmpegFound) {
        const versionMatch = ffmpegOutput.match(/ffmpeg version (\S+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        res.json({ 
          message: `Connection test successful - FFmpeg ${version} is available and working`,
          version: version
        });
      } else {
        res.status(400).json({ 
          message: "FFmpeg is not available in any of the expected locations",
          searchedPaths: ffmpegPaths
        });
      }
    } catch (error) {
      console.error("FFmpeg test error:", error);
      res.status(400).json({ 
        message: "FFmpeg test failed with error: " + error.message,
        error: error.toString()
      });
    }
  });

  // RTMP webhook endpoints
  app.post("/api/rtmp/publish", async (req, res) => {
    try {
      console.log("RTMP Publish started:", req.body);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).json({ message: "Failed to handle RTMP publish" });
    }
  });

  app.post("/api/rtmp/play", async (req, res) => {
    try {
      console.log("RTMP Play started:", req.body);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).json({ message: "Failed to handle RTMP play" });
    }
  });

  app.post("/api/rtmp/publish_done", async (req, res) => {
    try {
      console.log("RTMP Publish ended:", req.body);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).json({ message: "Failed to handle RTMP publish done" });
    }
  });

  app.post("/api/rtmp/play_done", async (req, res) => {
    try {
      console.log("RTMP Play ended:", req.body);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).json({ message: "Failed to handle RTMP play done" });
    }
  });

  app.post("/api/rtmp/record_done", async (req, res) => {
    try {
      console.log("RTMP Recording finished:", req.body);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).json({ message: "Failed to handle RTMP record done" });
    }
  });

  // System configuration routes
  app.get("/api/system-config", async (req, res) => {
    try {
      const config = await storage.getSystemConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system configuration" });
    }
  });

  app.post("/api/system-config", async (req, res) => {
    try {
      const result = insertSystemConfigSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid configuration data",
          errors: result.error.issues 
        });
      }

      const config = await storage.createOrUpdateSystemConfig(result.data);
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to update system configuration" });
    }
  });

  // Database management routes
  app.post("/api/database/install", async (req, res) => {
    try {
      // Run database migration to create all tables
      console.log("Installing default database schema...");
      execSync("npm run db:push", { stdio: 'inherit' });
      
      // Initialize default data
      await storage.initializeDefaultData();
      
      res.json({ message: "Database installed successfully", success: true });
    } catch (error) {
      console.error("Database installation failed:", error);
      res.status(500).json({ message: "Failed to install database", error: error.message });
    }
  });

  app.post("/api/database/backup", async (req, res) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `backup_${timestamp}.sql`;
      const backupPath = path.join(process.cwd(), 'backups', backupFile);
      
      // Create backups directory if it doesn't exist
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Get database connection info
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        return res.status(400).json({ message: "Database URL not configured" });
      }

      // Use pg_dump to create backup with proper path
      const pgDumpPath = '/nix/store/*/bin/pg_dump';
      try {
        // Try to find pg_dump in the Nix store
        const findCommand = 'find /nix/store -name "pg_dump" -type f 2>/dev/null | head -1';
        const pgDumpLocation = execSync(findCommand, { encoding: 'utf8' }).trim();
        
        if (!pgDumpLocation) {
          throw new Error('pg_dump not found in system');
        }
        
        const command = `${pgDumpLocation} "${dbUrl}"`;
        const backupData = execSync(command, { encoding: 'utf8' });
        fs.writeFileSync(backupPath, backupData);
      } catch (cmdError) {
        // Fallback: try using drizzle to export data as SQL
        console.log('pg_dump not available, using alternative backup method...');
        const { db } = await import('./db');
        
        // Export all table data as INSERT statements
        const { videos, streamConfigs, streamStatus, systemConfigs } = await import('../shared/schema');
        let sqlContent = '-- Database backup created by Sa Plays Roblox Streamer\n';
        sqlContent += '-- Generated on ' + new Date().toISOString() + '\n\n';
        
        try {
          // Backup videos table
          const videoRows = await db.select().from(videos);
          if (videoRows.length > 0) {
            sqlContent += '-- Table: videos\n';
            for (const row of videoRows) {
              sqlContent += `INSERT INTO videos (id, title, filename, file_size, duration, thumbnail_url, playlist_order, uploaded_at) VALUES (${row.id}, '${row.title.replace(/'/g, "''")}', '${row.filename.replace(/'/g, "''")}', ${row.fileSize}, '${row.duration}', ${row.thumbnailUrl ? `'${row.thumbnailUrl.replace(/'/g, "''")}'` : 'NULL'}, ${row.playlistOrder}, '${row.uploadedAt}');\n`;
            }
            sqlContent += '\n';
          }

          // Backup stream_configs table
          const configRows = await db.select().from(streamConfigs);
          if (configRows.length > 0) {
            sqlContent += '-- Table: stream_configs\n';
            for (const row of configRows) {
              sqlContent += `INSERT INTO stream_configs (id, platform, stream_key, rtmp_url, resolution, framerate, bitrate, audio_quality, is_active) VALUES (${row.id}, '${row.platform}', '${row.streamKey.replace(/'/g, "''")}', ${row.rtmpUrl ? `'${row.rtmpUrl.replace(/'/g, "''")}'` : 'NULL'}, '${row.resolution}', ${row.framerate}, ${row.bitrate}, ${row.audioQuality}, ${row.isActive});\n`;
            }
            sqlContent += '\n';
          }

          // Backup stream_status table
          const statusRows = await db.select().from(streamStatus);
          if (statusRows.length > 0) {
            sqlContent += '-- Table: stream_status\n';
            for (const row of statusRows) {
              sqlContent += `INSERT INTO stream_status (id, status, viewer_count, uptime, current_video_id, started_at, loop_playlist) VALUES (${row.id}, '${row.status}', ${row.viewerCount}, '${row.uptime}', ${row.currentVideoId}, ${row.startedAt ? `'${row.startedAt.toISOString()}'` : 'NULL'}, ${row.loopPlaylist});\n`;
            }
            sqlContent += '\n';
          }

          // Backup system_configs table
          const systemRows = await db.select().from(systemConfigs);
          if (systemRows.length > 0) {
            sqlContent += '-- Table: system_configs\n';
            for (const row of systemRows) {
              sqlContent += `INSERT INTO system_configs (id, rtmp_port, web_port, db_host, db_port, db_name, db_user, db_password, use_external_db, updated_at) VALUES (${row.id}, ${row.rtmpPort}, ${row.webPort}, '${row.dbHost}', ${row.dbPort}, '${row.dbName}', '${row.dbUser.replace(/'/g, "''")}', '${row.dbPassword.replace(/'/g, "''")}', ${row.useExternalDb}, '${row.updatedAt.toISOString()}');\n`;
            }
            sqlContent += '\n';
          }
        } catch (backupError) {
          console.error('Error during alternative backup:', backupError);
          sqlContent += '-- Error occurred during backup process\n';
        }
        
        fs.writeFileSync(backupPath, sqlContent);
      }
      
      // Get backup file stats
      const stats = fs.statSync(backupPath);
      
      res.json({ 
        message: "Database backup created successfully",
        filename: backupFile,
        size: stats.size,
        path: backupPath,
        success: true
      });
    } catch (error) {
      console.error("Database backup failed:", error);
      res.status(500).json({ message: "Failed to create database backup", error: error.message });
    }
  });

  app.post("/api/database/restore", upload.single('backupFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No backup file provided" });
      }

      const backupPath = req.file.path;
      
      // Validate file extension
      if (!backupPath.endsWith('.sql')) {
        fs.unlinkSync(backupPath); // Clean up uploaded file
        return res.status(400).json({ message: "Invalid file type. Only .sql files are allowed" });
      }

      // Get database connection info
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        return res.status(400).json({ message: "Database URL not configured" });
      }

      // Use psql to restore backup with proper path
      try {
        // Try to find psql in the Nix store
        const findCommand = 'find /nix/store -name "psql" -type f 2>/dev/null | head -1';
        const psqlLocation = execSync(findCommand, { encoding: 'utf8' }).trim();
        
        if (!psqlLocation) {
          throw new Error('psql not found in system');
        }
        
        const command = `${psqlLocation} "${dbUrl}" < "${backupPath}"`;
        execSync(command, { stdio: 'inherit' });
      } catch (cmdError) {
        // Fallback: read and execute SQL file manually
        console.log('psql not available, using alternative restore method...');
        const { db } = await import('./db');
        const sqlContent = fs.readFileSync(backupPath, 'utf8');
        
        // Split by semicolons and execute each statement
        const statements = sqlContent.split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt && !stmt.startsWith('--'));
        
        for (const statement of statements) {
          try {
            await db.execute(statement);
          } catch (stmtError) {
            console.warn(`Warning: Could not execute statement: ${statement}`, stmtError.message);
          }
        }
      }
      
      // Clean up uploaded file
      fs.unlinkSync(backupPath);
      
      res.json({ 
        message: "Database restored successfully",
        filename: req.file.originalname,
        success: true
      });
    } catch (error) {
      console.error("Database restore failed:", error);
      
      // Clean up uploaded file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ message: "Failed to restore database", error: error.message });
    }
  });

  app.get("/api/database/backups", async (req, res) => {
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      
      if (!fs.existsSync(backupDir)) {
        return res.json({ backups: [] });
      }
      
      const files = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.sql'))
        .map(file => {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: stats.size,
            created: stats.mtime,
            path: filePath
          };
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime()); // Most recent first
      
      res.json({ backups: files });
    } catch (error) {
      console.error("Failed to list backups:", error);
      res.status(500).json({ message: "Failed to list database backups", error: error.message });
    }
  });

  app.delete("/api/database/backups/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const backupPath = path.join(process.cwd(), 'backups', filename);
      
      if (!fs.existsSync(backupPath) || !filename.endsWith('.sql')) {
        return res.status(404).json({ message: "Backup file not found" });
      }
      
      fs.unlinkSync(backupPath);
      
      res.json({ 
        message: "Backup deleted successfully",
        filename: filename,
        success: true
      });
    } catch (error) {
      console.error("Failed to delete backup:", error);
      res.status(500).json({ message: "Failed to delete backup", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
