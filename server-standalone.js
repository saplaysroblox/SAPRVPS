// Standalone server for Docker deployment  
// Removes Replit-specific dependencies and uses standard Node.js patterns

const express = require('express');
const { createServer } = require('http');
const path = require('path');
const fs = require('fs');
const pg = require('pg');
const multer = require('multer');

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

// Database connection
let db;
try {
  db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });
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

    // Insert video record
    const result = await db.query(
      'INSERT INTO videos (title, filename, "fileSize", duration, "playlistOrder", "uploadedAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *',
      [title || 'Untitled Video', filename, fileSize, '00:00', playlistOrder]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
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

// Streaming endpoints (simplified)
app.post('/api/stream/start', async (req, res) => {
  try {
    await db.query('UPDATE "streamStatus" SET status = $1, "startedAt" = NOW()', ['live']);
    res.json({ message: 'Stream started' });
  } catch (error) {
    console.error('Error starting stream:', error);
    res.status(500).json({ error: 'Failed to start stream' });
  }
});

app.post('/api/stream/stop', async (req, res) => {
  try {
    await db.query('UPDATE "streamStatus" SET status = $1, "startedAt" = NULL', ['offline']);
    res.json({ message: 'Stream stopped' });
  } catch (error) {
    console.error('Error stopping stream:', error);
    res.status(500).json({ error: 'Failed to stop stream' });
  }
});

// Catch-all for SPA
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Application not built. Run npm run build:client first.');
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: error.message || 'Internal server error' });
});

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
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Start server
server.listen(port, '0.0.0.0', async () => {
  console.log(`Sa Plays Roblox Streamer (Standalone) running on port ${port}`);
  await initializeDatabase();
});