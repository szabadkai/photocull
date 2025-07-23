import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../database/photos.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    modified_at TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    format TEXT NOT NULL,
    is_raw BOOLEAN NOT NULL,
    scanned_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS photo_analysis (
    photo_id TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    blur_score REAL,
    quality_score REAL,
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_group TEXT,
    thumbnail_path TEXT,
    analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (photo_id) REFERENCES photos (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_photos_path ON photos(path);
  CREATE INDEX IF NOT EXISTS idx_analysis_hash ON photo_analysis(hash);
  CREATE INDEX IF NOT EXISTS idx_analysis_duplicate_group ON photo_analysis(duplicate_group);
`);

// Prepared statements
const statements = {
  insertPhoto: db.prepare(`
    INSERT OR REPLACE INTO photos (id, path, filename, size, created_at, modified_at, width, height, format, is_raw)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  insertAnalysis: db.prepare(`
    INSERT OR REPLACE INTO photo_analysis (photo_id, hash, blur_score, quality_score, is_duplicate, duplicate_group, thumbnail_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  
  getPhoto: db.prepare('SELECT * FROM photos WHERE id = ?'),
  
  getPhotosWithAnalysis: db.prepare(`
    SELECT p.*, pa.hash, pa.blur_score, pa.quality_score, pa.is_duplicate, pa.duplicate_group, pa.thumbnail_path
    FROM photos p
    LEFT JOIN photo_analysis pa ON p.id = pa.photo_id
    ORDER BY p.modified_at DESC
  `),
  
  findDuplicatesByHash: db.prepare('SELECT photo_id FROM photo_analysis WHERE hash = ? AND photo_id != ?'),
  
  deletePhoto: db.prepare('DELETE FROM photos WHERE id = ?')
};

// Add db reference to statements for convenience
statements.db = db;

export { db, statements };