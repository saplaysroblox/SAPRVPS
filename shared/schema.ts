import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  fileSize: integer("file_size").notNull(),
  duration: text("duration").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  playlistOrder: integer("playlist_order").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const streamConfigs = pgTable("stream_configs", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  streamKey: text("stream_key").notNull(),
  rtmpUrl: text("rtmp_url"),
  resolution: text("resolution").notNull(),
  framerate: integer("framerate").notNull(),
  bitrate: integer("bitrate").notNull(),
  audioQuality: integer("audio_quality").notNull(),
  isActive: boolean("is_active").default(false),
});

export const streamStatus = pgTable("stream_status", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(), // 'live', 'offline', 'starting', 'error'
  viewerCount: integer("viewer_count").default(0),
  uptime: text("uptime").default("00:00:00"),
  currentVideoId: integer("current_video_id"),
  startedAt: timestamp("started_at"),
  loopPlaylist: boolean("loop_playlist").default(false),
});

export const systemConfigs = pgTable("system_configs", {
  id: serial("id").primaryKey(),
  rtmpPort: integer("rtmp_port").default(1935),
  webPort: integer("web_port").default(5000),
  dbHost: text("db_host").default("localhost"),
  dbPort: integer("db_port").default(5432),
  dbName: text("db_name").default("streaming_db"),
  dbUser: text("db_user").default(""),
  dbPassword: text("db_password").default(""),
  useExternalDb: boolean("use_external_db").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  uploadedAt: true,
});

export const insertStreamConfigSchema = createInsertSchema(streamConfigs).omit({
  id: true,
});

export const insertStreamStatusSchema = createInsertSchema(streamStatus).omit({
  id: true,
});

export const insertSystemConfigSchema = createInsertSchema(systemConfigs).omit({
  id: true,
  updatedAt: true,
});

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertStreamConfig = z.infer<typeof insertStreamConfigSchema>;
export type StreamConfig = typeof streamConfigs.$inferSelect;
export type InsertStreamStatus = z.infer<typeof insertStreamStatusSchema>;
export type StreamStatus = typeof streamStatus.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfigs.$inferSelect;
