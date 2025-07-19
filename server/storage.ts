import { videos, streamConfigs, streamStatus, systemConfigs, type Video, type InsertVideo, type StreamConfig, type InsertStreamConfig, type StreamStatus, type InsertStreamStatus, type SystemConfig, type InsertSystemConfig } from "@shared/schema";
import { db, dbInitPromise } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Video operations
  getVideos(): Promise<Video[]>;
  getVideo(id: number): Promise<Video | undefined>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: number, video: Partial<InsertVideo>): Promise<Video | undefined>;
  deleteVideo(id: number): Promise<boolean>;
  reorderPlaylist(videoIds: number[]): Promise<void>;
  
  // Stream config operations
  getStreamConfig(): Promise<StreamConfig | undefined>;
  createOrUpdateStreamConfig(config: InsertStreamConfig): Promise<StreamConfig>;
  
  // Stream status operations
  getStreamStatus(): Promise<StreamStatus | undefined>;
  createOrUpdateStreamStatus(status: InsertStreamStatus): Promise<StreamStatus>;
  
  // System config operations
  getSystemConfig(): Promise<SystemConfig | undefined>;
  createOrUpdateSystemConfig(config: InsertSystemConfig): Promise<SystemConfig>;
  initializeDefaultData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private initialized = false;
  private initPromise: Promise<void>;
  
  constructor() {
    // Don't initialize in constructor, let it happen lazily
    this.initPromise = this.lazyInitialize();
  }

  private async lazyInitialize(): Promise<void> {
    // This just waits for DB and marks as ready
    await dbInitPromise;
    this.initialized = true;
  }

  async initializeDefaultData(): Promise<void> {
    try {
      await this.ensureInitialized();
      
      if (!db) {
        throw new Error('Database not available');
      }
      
      // Check if we already have basic data
      try {
        const [status] = await db.select().from(streamStatus).limit(1);
        if (!status) {
          console.log('Creating default stream status');
          await db.insert(streamStatus).values({
            status: 'offline',
            viewerCount: 0,
            uptime: '00:00:00',
            currentVideoId: null,
            startedAt: null,
            loopPlaylist: false,
          });
        }
      } catch (error) {
        console.warn('Could not initialize stream status:', error);
      }
      
      // Initialize default system config if it doesn't exist
      try {
        const [config] = await db.select().from(systemConfigs).limit(1);
        if (!config) {
          console.log('Creating default system config');
          await db.insert(systemConfigs).values({
            rtmpPort: 1935,
            webPort: 5000,
            dbHost: "localhost",
            dbPort: 5432,
            dbName: "streaming_db",
            dbUser: "",
            dbPassword: "",
            useExternalDb: false,
            updatedAt: new Date(),
          });
        }
      } catch (error) {
        console.warn('Could not initialize system config:', error);
      }
      
      console.log("Default data initialization completed successfully");
    } catch (error) {
      console.error("Failed to initialize default data:", error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }
  async getVideos(): Promise<Video[]> {
    await this.ensureInitialized();
    if (!db) throw new Error('Database not initialized');
    const result = await db.select().from(videos).orderBy(videos.playlistOrder);
    return result;
  }

  async getVideo(id: number): Promise<Video | undefined> {
    await this.ensureInitialized();
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video || undefined;
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    await this.ensureInitialized();
    const [video] = await db
      .insert(videos)
      .values({
        ...insertVideo,
        thumbnailUrl: insertVideo.thumbnailUrl || null,
      })
      .returning();
    return video;
  }

  async updateVideo(id: number, updateVideo: Partial<InsertVideo>): Promise<Video | undefined> {
    await this.ensureInitialized();
    const [video] = await db
      .update(videos)
      .set(updateVideo)
      .where(eq(videos.id, id))
      .returning();
    return video || undefined;
  }

  async deleteVideo(id: number): Promise<boolean> {
    await this.ensureInitialized();
    const result = await db.delete(videos).where(eq(videos.id, id));
    return (result.rowCount || 0) > 0;
  }

  async reorderPlaylist(videoIds: number[]): Promise<void> {
    await this.ensureInitialized();
    for (let i = 0; i < videoIds.length; i++) {
      await db
        .update(videos)
        .set({ playlistOrder: i })
        .where(eq(videos.id, videoIds[i]));
    }
  }

  async getStreamConfig(): Promise<StreamConfig | undefined> {
    await this.ensureInitialized();
    const [config] = await db
      .select()
      .from(streamConfigs)
      .where(eq(streamConfigs.isActive, true));
    return config || undefined;
  }

  async createOrUpdateStreamConfig(config: InsertStreamConfig): Promise<StreamConfig> {
    await this.ensureInitialized();
    const existingConfig = await this.getStreamConfig();
    
    if (existingConfig) {
      const [updatedConfig] = await db
        .update(streamConfigs)
        .set({
          ...config,
          rtmpUrl: config.rtmpUrl || null,
        })
        .where(eq(streamConfigs.id, existingConfig.id))
        .returning();
      return updatedConfig;
    } else {
      const [streamConfig] = await db
        .insert(streamConfigs)
        .values({
          ...config,
          isActive: true,
          rtmpUrl: config.rtmpUrl || null,
        })
        .returning();
      return streamConfig;
    }
  }

  async getStreamStatus(): Promise<StreamStatus | undefined> {
    await this.ensureInitialized();
    if (!db) throw new Error('Database not initialized');
    const [status] = await db.select().from(streamStatus).limit(1);
    return status || undefined;
  }

  async createOrUpdateStreamStatus(status: InsertStreamStatus): Promise<StreamStatus> {
    await this.ensureInitialized();
    const existingStatus = await this.getStreamStatus();
    
    if (existingStatus) {
      const [updatedStatus] = await db
        .update(streamStatus)
        .set({
          ...status,
          viewerCount: status.viewerCount || null,
          uptime: status.uptime || null,
          currentVideoId: status.currentVideoId || null,
          startedAt: status.startedAt || null,
        })
        .where(eq(streamStatus.id, existingStatus.id))
        .returning();
      return updatedStatus;
    } else {
      const [streamStatusRecord] = await db
        .insert(streamStatus)
        .values({
          ...status,
          viewerCount: status.viewerCount || null,
          uptime: status.uptime || null,
          currentVideoId: status.currentVideoId || null,
          startedAt: status.startedAt || null,
        })
        .returning();
      return streamStatusRecord;
    }
  }

  async getSystemConfig(): Promise<SystemConfig | undefined> {
    await this.ensureInitialized();
    if (!db) throw new Error('Database not initialized');
    const [config] = await db.select().from(systemConfigs).limit(1);
    return config || undefined;
  }

  async createOrUpdateSystemConfig(config: InsertSystemConfig): Promise<SystemConfig> {
    await this.ensureInitialized();
    const existingConfig = await this.getSystemConfig();
    
    if (existingConfig) {
      const [updatedConfig] = await db
        .update(systemConfigs)
        .set({
          ...config,
          updatedAt: new Date(),
        })
        .where(eq(systemConfigs.id, existingConfig.id))
        .returning();
      return updatedConfig;
    } else {
      const [systemConfig] = await db
        .insert(systemConfigs)
        .values({
          ...config,
          updatedAt: new Date(),
        })
        .returning();
      return systemConfig;
    }
  }

  async initializeDefaultData(): Promise<void> {
    try {
      // Initialize default stream status if it doesn't exist
      const existingStatus = await this.getStreamStatus();
      if (!existingStatus) {
        await this.createOrUpdateStreamStatus({
          status: 'offline',
          viewerCount: 0,
          uptime: '00:00:00',
          currentVideoId: null,
          startedAt: null,
          loopPlaylist: false,
        });
      }
      
      // Initialize default system config if it doesn't exist
      const existingConfig = await this.getSystemConfig();
      if (!existingConfig) {
        await this.createOrUpdateSystemConfig({
          rtmpPort: 1935,
          webPort: 5000,
          dbHost: "localhost",
          dbPort: 5432,
          dbName: "streaming_db",
          dbUser: "",
          dbPassword: "",
          useExternalDb: false,
        });
      }
      
      console.log("Default data initialization completed successfully");
    } catch (error) {
      console.error("Failed to initialize default data:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
