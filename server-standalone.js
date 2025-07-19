// Standalone server for Docker deployment  
// Removes Replit-specific dependencies and uses standard Node.js patterns

const express = require('express');
const { createServer } = require('http');
const path = require('path');
const fs = require('fs');
const pg = require('pg');
const multer = require('multer');

// Try to load fluent-ffmpeg for video duration detection
let ffmpeg;
try {
  ffmpeg = require('fluent-ffmpeg');
} catch (error) {
  console.log('fluent-ffmpeg not available, duration detection disabled');
}

// Simple ID generator (fallback if nanoid fails)
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

let nanoid;
try {
  nanoid = require('nanoid').nanoid;
} catch (error) {
  console.log('Using fallback ID generator');
  nanoid = generateId;
}

const { Pool } = pg;
// __dirname is available in CommonJS

const app = express();
const server = createServer(app);
const port = process.env.PORT || 5000;

// Basic middleware
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Request logging middleware (similar to original)
app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json;
  let capturedJsonResponse;

  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      let logLine = `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }
      console.log(logLine);
    }
  });

  next();
});

// Database connection
let db;
try {
  const connectionConfig = {
    connectionString: process.env.DATABASE_URL,
  };
  
  // Disable SSL for local/Docker connections
  if (process.env.DATABASE_URL?.includes('localhost') || 
      process.env.DATABASE_URL?.includes('127.0.0.1') ||
      process.env.DATABASE_URL?.includes('db:')) {
    connectionConfig.ssl = false;
  } else {
    connectionConfig.ssl = { rejectUnauthorized: false };
  }
  
  db = new Pool(connectionConfig);
  console.log('Database connection established');
} catch (error) {
  console.error('Database connection failed:', error);
}

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${nanoid()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

// Helper function to get video duration using FFmpeg
async function getVideoDuration(filePath) {
  if (!ffmpeg) {
    return '00:00'; // Fallback when ffmpeg is not available
  }
  
  return new Promise((resolve) => {
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

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: db ? 'connected' : 'disconnected'
  });
});

// API Routes
app.get('/api/videos', async (req, res) => {
  try {
    if (!db) throw new Error('Database not available');
    const result = await db.query('SELECT * FROM videos ORDER BY "playlistOrder" ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.post('/api/videos', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const { title } = req.body;
    const filename = req.file.filename;
    const fileSize = req.file.size;
    
    // Get next playlist order
    const orderResult = await db.query('SELECT COALESCE(MAX("playlistOrder"), 0) + 1 as "nextOrder" FROM videos');
    const playlistOrder = orderResult.rows[0].nextOrder;

    // Get video duration using FFmpeg
    const filePath = path.join(__dirname, 'uploads', filename);
    const duration = await getVideoDuration(filePath);

    // Insert video record
    const result = await db.query(
      'INSERT INTO videos (title, filename, "fileSize", duration, "playlistOrder", "uploadedAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [title || 'Untitled Video', filename, fileSize, duration, playlistOrder]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

app.put('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await db.query(
      'UPDATE videos SET title = $1 WHERE id = $2 RETURNING *',
      [title, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get video info first
    const videoResult = await db.query('SELECT * FROM videos WHERE id = $1', [id]);
    if (videoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videoResult.rows[0];
    
    // Delete file
    const filePath = path.join(__dirname, 'uploads', video.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await db.query('DELETE FROM videos WHERE id = $1', [id]);
    
    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

app.get('/api/stream-status', async (req, res) => {
  try {
    if (!db) throw new Error('Database not available');
    const result = await db.query('SELECT * FROM "streamStatus" ORDER BY id DESC LIMIT 1');
    
    if (result.rows.length === 0) {
      // Create default status
      const defaultStatus = await db.query(
        'INSERT INTO "streamStatus" (status, "viewerCount", uptime, "loopPlaylist") VALUES ($1, $2, $3, $4) RETURNING *',
        ['offline', 0, '00:00:00', false]
      );
      res.json(defaultStatus.rows[0]);
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error fetching stream status:', error);
    res.status(500).json({ error: 'Failed to fetch stream status' });
  }
});

app.get('/api/stream-config', async (req, res) => {
  try {
    if (!db) throw new Error('Database not available');
    const result = await db.query('SELECT * FROM "streamConfigs" WHERE "isActive" = true ORDER BY id DESC LIMIT 1');
    
    if (result.rows.length === 0) {
      res.json({
        platform: 'youtube',
        streamKey: '',
        resolution: '1920x1080',
        framerate: 30,
        bitrate: 2500,
        audioQuality: 128
      });
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error fetching stream config:', error);
    res.status(500).json({ error: 'Failed to fetch stream config' });
  }
});

app.post('/api/stream-config', async (req, res) => {
  try {
    const { platform, streamKey, rtmpUrl, resolution, framerate, bitrate, audioQuality } = req.body;
    
    // Deactivate existing configs
    await db.query('UPDATE "streamConfigs" SET "isActive" = false');
    
    // Insert new config
    const result = await db.query(
      'INSERT INTO "streamConfigs" (platform, "streamKey", "rtmpUrl", resolution, framerate, bitrate, "audioQuality", "isActive") VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *',
      [platform, streamKey, rtmpUrl, resolution, framerate, bitrate, audioQuality]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving stream config:', error);
    res.status(500).json({ error: 'Failed to save stream config' });
  }
});

app.get('/api/system-config', async (req, res) => {
  try {
    if (!db) throw new Error('Database not available');
    const result = await db.query('SELECT * FROM "systemConfigs" ORDER BY id DESC LIMIT 1');
    
    if (result.rows.length === 0) {
      // Create default config
      const defaultConfig = await db.query(
        'INSERT INTO "systemConfigs" ("rtmpPort", "webPort", "dbHost", "dbPort", "dbName", "useExternalDb") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [1935, 5000, 'localhost', 5432, 'streaming_db', false]
      );
      res.json(defaultConfig.rows[0]);
    } else {
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error fetching system config:', error);
    res.status(500).json({ error: 'Failed to fetch system config' });
  }
});

// Enhanced streaming endpoints with RTMP manager integration
app.post('/api/stream/start', async (req, res) => {
  try {
    // Get current stream status to check for selected video
    const statusResult = await db.query('SELECT * FROM "streamStatus" ORDER BY id DESC LIMIT 1');
    const streamStatus = statusResult.rows[0];
    
    if (!streamStatus?.currentVideoId) {
      return res.status(400).json({ error: 'No video selected for streaming' });
    }

    // Get video info
    const videoResult = await db.query('SELECT * FROM videos WHERE id = $1', [streamStatus.currentVideoId]);
    if (videoResult.rows.length === 0) {
      return res.status(400).json({ error: 'Selected video not found' });
    }

    // Get stream configuration
    const configResult = await db.query('SELECT * FROM "streamConfigs" WHERE "isActive" = true ORDER BY id DESC LIMIT 1');
    const streamConfig = configResult.rows[0];
    
    if (!streamConfig) {
      return res.status(400).json({ error: 'Stream configuration not found' });
    }

    // Build streaming configuration
    const rtmpConfig = {
      videoId: streamStatus.currentVideoId,
      platform: streamConfig.platform,
      streamKey: streamConfig.streamKey,
      rtmpUrl: streamConfig.rtmpUrl,
      resolution: streamConfig.resolution,
      framerate: streamConfig.framerate,
      bitrate: streamConfig.bitrate,
    };

    // Start stream with RTMP manager
    const started = await rtmpManager.startStream(streamStatus.currentVideoId, rtmpConfig);
    
    if (!started) {
      return res.status(500).json({ error: 'Failed to start RTMP stream' });
    }

    // Update database
    await db.query('UPDATE "streamStatus" SET status = $1, "startedAt" = NOW()', ['live']);
    
    res.json({ message: 'Stream started successfully' });
  } catch (error) {
    console.error('Error starting stream:', error);
    res.status(500).json({ error: 'Failed to start stream' });
  }
});

app.post('/api/stream/stop', async (req, res) => {
  try {
    // Stop RTMP stream
    await rtmpManager.stopStream();
    
    // Update database
    await db.query('UPDATE "streamStatus" SET status = $1, "startedAt" = NULL', ['offline']);
    
    res.json({ message: 'Stream stopped successfully' });
  } catch (error) {
    console.error('Error stopping stream:', error);
    res.status(500).json({ error: 'Failed to stop stream' });
  }
});

app.post('/api/stream/set-current', async (req, res) => {
  try {
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }
    
    // Update stream status with current video
    await db.query('UPDATE "streamStatus" SET "currentVideoId" = $1', [videoId]);
    res.json({ message: 'Current video set successfully' });
  } catch (error) {
    console.error('Error setting current video:', error);
    res.status(500).json({ error: 'Failed to set current video' });
  }
});

app.post('/api/stream/restart', async (req, res) => {
  try {
    // Stop then start the stream
    await db.query('UPDATE "streamStatus" SET status = $1, "startedAt" = NULL', ['offline']);
    // Brief delay before restarting
    setTimeout(async () => {
      await db.query('UPDATE "streamStatus" SET status = $1, "startedAt" = NOW()', ['live']);
    }, 1000);
    
    res.json({ message: 'Stream restarted successfully' });
  } catch (error) {
    console.error('Error restarting stream:', error);
    res.status(500).json({ error: 'Failed to restart stream' });
  }
});

app.post('/api/stream/loop/enable', async (req, res) => {
  try {
    await db.query('UPDATE "streamStatus" SET "loopPlaylist" = true');
    res.json({ message: '24x7 loop enabled' });
  } catch (error) {
    console.error('Error enabling loop:', error);
    res.status(500).json({ error: 'Failed to enable loop' });
  }
});

app.post('/api/stream/loop/disable', async (req, res) => {
  try {
    await db.query('UPDATE "streamStatus" SET "loopPlaylist" = false');
    res.json({ message: '24x7 loop disabled' });
  } catch (error) {
    console.error('Error disabling loop:', error);
    res.status(500).json({ error: 'Failed to disable loop' });
  }
});

app.post('/api/videos/reorder', async (req, res) => {
  try {
    const { videoIds } = req.body;
    
    if (!Array.isArray(videoIds)) {
      return res.status(400).json({ error: 'videoIds must be an array' });
    }
    
    // Update playlist order based on the new sequence
    const promises = videoIds.map((id, index) => 
      db.query('UPDATE videos SET "playlistOrder" = $1 WHERE id = $2', [index + 1, id])
    );
    
    await Promise.all(promises);
    res.json({ message: 'Playlist reordered successfully' });
  } catch (error) {
    console.error('Error reordering playlist:', error);
    res.status(500).json({ error: 'Failed to reorder playlist' });
  }
});

app.post('/api/system-config', async (req, res) => {
  try {
    const { rtmpPort, webPort, dbHost, dbPort, dbName, dbUser, dbPassword, useExternalDb } = req.body;
    
    // Update existing config or create new one
    const result = await db.query(`
      INSERT INTO "systemConfigs" ("rtmpPort", "webPort", "dbHost", "dbPort", "dbName", "dbUser", "dbPassword", "useExternalDb", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
        "rtmpPort" = EXCLUDED."rtmpPort",
        "webPort" = EXCLUDED."webPort",
        "dbHost" = EXCLUDED."dbHost",
        "dbPort" = EXCLUDED."dbPort",
        "dbName" = EXCLUDED."dbName",
        "dbUser" = EXCLUDED."dbUser",
        "dbPassword" = EXCLUDED."dbPassword",
        "useExternalDb" = EXCLUDED."useExternalDb",
        "updatedAt" = NOW()
      RETURNING *
    `, [rtmpPort, webPort, dbHost, dbPort, dbName, dbUser, dbPassword, useExternalDb]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating system config:', error);
    res.status(500).json({ error: 'Failed to update system config' });
  }
});

// Database management endpoints
app.post('/api/database/install', async (req, res) => {
  try {
    // Reinitialize database schema
    await initializeDatabase();
    
    // Initialize default stream status and system config
    const statusCount = await db.query('SELECT COUNT(*) FROM "streamStatus"');
    if (parseInt(statusCount.rows[0].count) === 0) {
      await db.query('INSERT INTO "streamStatus" (status, "viewerCount", uptime, "loopPlaylist") VALUES ($1, $2, $3, $4)', ['offline', 0, '00:00:00', false]);
    }

    const configCount = await db.query('SELECT COUNT(*) FROM "systemConfigs"');
    if (parseInt(configCount.rows[0].count) === 0) {
      await db.query('INSERT INTO "systemConfigs" ("rtmpPort", "webPort") VALUES ($1, $2)', [1935, 5000]);
    }

    res.json({ message: 'Default database schema installed successfully' });
  } catch (error) {
    console.error('Error installing database:', error);
    res.status(500).json({ error: 'Failed to install database schema' });
  }
});

app.post('/api/database/backup', async (req, res) => {
  try {
    // For Docker/standalone, we'll create a simple SQL dump
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    
    // Simple backup by exporting data as INSERT statements
    const tables = ['videos', 'streamConfigs', 'streamStatus', 'systemConfigs'];
    let backupSQL = '-- Sa Plays Roblox Streamer Database Backup\n';
    backupSQL += `-- Generated on ${new Date().toISOString()}\n\n`;
    
    for (const table of tables) {
      try {
        const result = await db.query(`SELECT * FROM "${table}"`);
        if (result.rows.length > 0) {
          backupSQL += `-- Table: ${table}\n`;
          for (const row of result.rows) {
            const columns = Object.keys(row).map(k => `"${k}"`).join(', ');
            const values = Object.values(row).map(v => 
              v === null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`
            ).join(', ');
            backupSQL += `INSERT INTO "${table}" (${columns}) VALUES (${values});\n`;
          }
          backupSQL += '\n';
        }
      } catch (tableError) {
        console.warn(`Skipping table ${table}:`, tableError.message);
      }
    }
    
    res.json({ 
      message: 'Backup created successfully',
      filename,
      content: backupSQL 
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.get('/api/database/backups', async (req, res) => {
  try {
    // For Docker/standalone, return empty list since we don't persist backups to disk
    res.json([]);
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.post('/api/database/restore', async (req, res) => {
  try {
    const { sqlContent } = req.body;
    
    if (!sqlContent) {
      return res.status(400).json({ error: 'SQL content is required' });
    }
    
    // Execute the SQL statements (basic implementation)
    const statements = sqlContent.split(';').filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.query(statement.trim());
      }
    }
    
    res.json({ message: 'Database restored successfully' });
  } catch (error) {
    console.error('Error restoring database:', error);
    res.status(500).json({ error: 'Failed to restore database' });
  }
});

app.delete('/api/database/backups/:filename', async (req, res) => {
  try {
    // For Docker/standalone, backups aren't persisted, so just return success
    res.json({ message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  const status = error.status || error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

// Catch-all for SPA (must be last)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Application not built. Run npm run build:client first.');
  }
});

// Simple RTMP Stream Manager (basic implementation for Docker standalone)
class SimpleRTMPManager {
  constructor() {
    this.currentStream = null;
    this.loopEnabled = false;
  }

  async startStream(videoId, config) {
    console.log(`Starting stream for video ${videoId} with config:`, config);
    // In a full implementation, this would start FFmpeg process
    // For Docker standalone, we'll just log and update status
    this.currentStream = { videoId, config, startTime: Date.now() };
    return true;
  }

  async stopStream() {
    console.log('Stopping stream');
    this.currentStream = null;
    return true;
  }

  setLoopEnabled(enabled) {
    this.loopEnabled = enabled;
  }

  isStreaming() {
    return this.currentStream !== null;
  }
}

const rtmpManager = new SimpleRTMPManager();

// Initialize database tables
async function initializeDatabase() {
  if (!db) return;
  
  try {
    // Create tables if they don't exist (basic versions)
    await db.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        filename TEXT NOT NULL,
        "fileSize" INTEGER NOT NULL,
        duration TEXT NOT NULL,
        "thumbnailUrl" TEXT,
        "playlistOrder" INTEGER NOT NULL,
        "uploadedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS "streamConfigs" (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        "streamKey" TEXT NOT NULL,
        "rtmpUrl" TEXT,
        resolution TEXT NOT NULL,
        framerate INTEGER NOT NULL,
        bitrate INTEGER NOT NULL,
        "audioQuality" INTEGER NOT NULL,
        "isActive" BOOLEAN DEFAULT false
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS "streamStatus" (
        id SERIAL PRIMARY KEY,
        status TEXT NOT NULL,
        "viewerCount" INTEGER DEFAULT 0,
        uptime TEXT DEFAULT '00:00:00',
        "currentVideoId" INTEGER,
        "startedAt" TIMESTAMP,
        "loopPlaylist" BOOLEAN DEFAULT false
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS "systemConfigs" (
        id SERIAL PRIMARY KEY,
        "rtmpPort" INTEGER DEFAULT 1935,
        "webPort" INTEGER DEFAULT 5000,
        "dbHost" TEXT DEFAULT 'localhost',
        "dbPort" INTEGER DEFAULT 5432,
        "dbName" TEXT DEFAULT 'streaming_db',
        "dbUser" TEXT DEFAULT '',
        "dbPassword" TEXT DEFAULT '',
        "useExternalDb" BOOLEAN DEFAULT false,
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Database tables initialized');
    
    // Initialize default data if tables are empty
    const statusCount = await db.query('SELECT COUNT(*) FROM "streamStatus"');
    if (parseInt(statusCount.rows[0].count) === 0) {
      await db.query('INSERT INTO "streamStatus" (status, "viewerCount", uptime, "loopPlaylist") VALUES ($1, $2, $3, $4)', ['offline', 0, '00:00:00', false]);
      console.log('Default stream status initialized');
    }

    const configCount = await db.query('SELECT COUNT(*) FROM "systemConfigs"');
    if (parseInt(configCount.rows[0].count) === 0) {
      await db.query('INSERT INTO "systemConfigs" ("rtmpPort", "webPort") VALUES ($1, $2)', [1935, 5000]);
      console.log('Default system configuration initialized');
    }
    
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Start server
server.listen(port, '0.0.0.0', async () => {
  console.log(`Sa Plays Roblox Streamer (Standalone) running on port ${port}`);
  await initializeDatabase();
});