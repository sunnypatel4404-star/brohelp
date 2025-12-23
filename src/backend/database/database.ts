import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

let db: Database.Database | null = null;

const DB_PATH = './data/brohelp.db';

/**
 * Get the SQLite database instance (singleton)
 */
export function getDatabase(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Initialize database schema
 */
function initializeSchema(database: Database.Database): void {
  database.exec(`
    -- Pins table (mirrors SavedPin interface)
    CREATE TABLE IF NOT EXISTS pins (
      id TEXT PRIMARY KEY,
      article_title TEXT NOT NULL,
      article_id INTEGER,
      post_id INTEGER,
      suggested_tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      approved_at TEXT,
      published_at TEXT,
      notes TEXT
    );

    -- Pin variations (normalized from variations[] array)
    CREATE TABLE IF NOT EXISTS pin_variations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pin_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      link TEXT NOT NULL,
      image_url TEXT,
      alt_text TEXT,
      board_name TEXT,
      dominant_color TEXT,
      angle TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE CASCADE
    );

    -- Images metadata (tracks generated_images/*.png files)
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      topic TEXT,
      local_path TEXT NOT NULL,
      wordpress_url TEXT,
      created_at TEXT NOT NULL,
      file_size INTEGER
    );

    -- Jobs table (replaces in-memory Map)
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'queued',
      topic TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      result TEXT,
      error TEXT,
      steps TEXT NOT NULL DEFAULT '{}'
    );

    -- Retry queue for failed jobs
    CREATE TABLE IF NOT EXISTS job_retries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      next_retry_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    -- Articles table for duplicate detection and history
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      topic_normalized TEXT NOT NULL,
      title TEXT,
      post_id INTEGER,
      job_id TEXT,
      wordpress_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      published_at TEXT,
      word_count INTEGER,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    -- Scheduled content table
    CREATE TABLE IF NOT EXISTS scheduled_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      job_id TEXT,
      created_at TEXT NOT NULL,
      executed_at TEXT,
      error TEXT,
      recurrence TEXT,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_pins_status ON pins(status);
    CREATE INDEX IF NOT EXISTS idx_pins_created_at ON pins(created_at);
    CREATE INDEX IF NOT EXISTS idx_pin_variations_pin_id ON pin_variations(pin_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at);
    CREATE INDEX IF NOT EXISTS idx_job_retries_next_retry ON job_retries(next_retry_at);
    CREATE INDEX IF NOT EXISTS idx_articles_topic_normalized ON articles(topic_normalized);
    CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);
    CREATE INDEX IF NOT EXISTS idx_scheduled_content_scheduled_at ON scheduled_content(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_scheduled_content_status ON scheduled_content(status);
  `);

  console.log('Database schema initialized');
}

// Type definitions for database rows
export interface PinRow {
  id: string;
  article_title: string;
  article_id: number | null;
  post_id: number | null;
  suggested_tags: string;
  created_at: string;
  status: string;
  approved_at: string | null;
  published_at: string | null;
  notes: string | null;
}

export interface PinVariationRow {
  id: number;
  pin_id: string;
  title: string;
  description: string;
  link: string;
  image_url: string | null;
  alt_text: string | null;
  board_name: string | null;
  dominant_color: string | null;
  angle: string;
  sort_order: number;
}

export interface ImageRow {
  id: number;
  filename: string;
  topic: string | null;
  local_path: string;
  wordpress_url: string | null;
  created_at: string;
  file_size: number | null;
}

export interface JobRow {
  id: string;
  status: string;
  topic: string;
  created_at: string;
  updated_at: string;
  result: string | null;
  error: string | null;
  steps: string;
}
