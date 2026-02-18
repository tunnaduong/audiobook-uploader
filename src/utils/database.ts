import * as SqlJs from 'sql.js'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { createLogger } from './logger'

const logger = createLogger('database')

let db: any = null
let SQL: any = null

export function getAppDataPath(): string {
  const appDataPath = process.env.APPDATA || os.homedir()
  return path.join(appDataPath, '.audiobook-uploader')
}

export function getDatabasePath(): string {
  const appDataPath = getAppDataPath()
  return path.join(appDataPath, 'app.db')
}

export async function initializeDatabase(): Promise<any> {
  if (db) {
    return db
  }

  try {
    // Initialize sql.js
    if (!SQL) {
      SQL = await (SqlJs as any).default()
    }

    const appDataPath = getAppDataPath()
    await fs.mkdir(appDataPath, { recursive: true })

    const dbPath = getDatabasePath()

    // Try to load existing database
    let buffer: Buffer | undefined
    try {
      buffer = await fs.readFile(dbPath)
    } catch {
      logger.debug('No existing database found, creating new one')
    }

    // Create or load database
    if (buffer) {
      db = new SQL.Database(new Uint8Array(buffer))
      logger.info('Database loaded from disk')
    } else {
      db = new SQL.Database()
      logger.info('New database created')
    }

    // Create tables if they don't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        story_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        progress REAL DEFAULT 0,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        douyin_link TEXT,
        local_path TEXT,
        duration INTEGER,
        downloaded_at DATETIME,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        audio_path TEXT,
        duration INTEGER,
        converted_at DATETIME,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        final_video_path TEXT,
        thumbnail_path TEXT,
        youtube_id TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_videos_project_id ON videos(project_id);
      CREATE INDEX IF NOT EXISTS idx_conversions_project_id ON conversions(project_id);
      CREATE INDEX IF NOT EXISTS idx_outputs_project_id ON outputs(project_id);
    `)

    // Save database to disk
    await saveDatabaseToDisk()

    logger.info('Database initialized successfully')
    return db
  } catch (error) {
    logger.error('Failed to initialize database', error)
    throw error
  }
}

export async function saveDatabaseToDisk(): Promise<void> {
  if (!db) return

  try {
    const data = db.export()
    const buffer = Buffer.from(data)
    const dbPath = getDatabasePath()
    await fs.writeFile(dbPath, buffer)
    logger.debug('Database saved to disk')
  } catch (error) {
    logger.error('Failed to save database', error)
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await saveDatabaseToDisk()
    db.close()
    db = null
    logger.info('Database closed')
  }
}

// Helper function to execute queries and fetch results
function executeQuery(sql: string, params: any[] = []): any[] {
  if (!db) throw new Error('Database not initialized')

  try {
    const stmt = db.prepare(sql)
    stmt.bind(params)
    const results = []
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    stmt.free()
    return results
  } catch (error) {
    logger.error(`Query error: ${sql}`, error)
    throw error
  }
}

// Helper function to execute updates
function executeUpdate(sql: string, params: any[] = []): { lastID: number; changes: number } {
  if (!db) throw new Error('Database not initialized')

  try {
    const stmt = db.prepare(sql)
    stmt.bind(params)
    stmt.step()
    stmt.free()
    return {
      lastID: db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] || 0,
      changes: db.getRowsModified(),
    }
  } catch (error) {
    logger.error(`Update error: ${sql}`, error)
    throw error
  }
}

// Project operations
export async function createProject(
  title: string,
  storyText: string
): Promise<number> {
  await initializeDatabase()
  const result = executeUpdate(
    `INSERT INTO projects (title, story_text, status, progress)
     VALUES (?, ?, 'pending', 0)`,
    [title, storyText]
  )
  await saveDatabaseToDisk()
  logger.info(`Project created with ID: ${result.lastID}`)
  return result.lastID
}

export async function getProject(id: number): Promise<any> {
  await initializeDatabase()
  const results = executeQuery('SELECT * FROM projects WHERE id = ?', [id])
  return results[0] || null
}

export async function getProjectHistory(): Promise<any[]> {
  await initializeDatabase()
  return executeQuery(
    'SELECT * FROM projects ORDER BY created_at DESC LIMIT 50'
  )
}

export async function updateProjectStatus(
  id: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  progress: number = 0,
  errorMessage?: string
): Promise<void> {
  await initializeDatabase()
  executeUpdate(
    `UPDATE projects
     SET status = ?, progress = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, progress, errorMessage || null, id]
  )
  await saveDatabaseToDisk()
  logger.debug(`Project ${id} status updated to ${status}`)
}

export async function deleteProject(id: number): Promise<void> {
  await initializeDatabase()
  executeUpdate('DELETE FROM projects WHERE id = ?', [id])
  await saveDatabaseToDisk()
  logger.info(`Project ${id} deleted`)
}

// Video operations
export async function saveVideoInfo(
  projectId: number,
  douyinLink: string,
  localPath: string,
  duration: number
): Promise<number> {
  await initializeDatabase()
  const result = executeUpdate(
    `INSERT INTO videos (project_id, douyin_link, local_path, duration, downloaded_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [projectId, douyinLink, localPath, duration]
  )
  await saveDatabaseToDisk()
  return result.lastID
}

export async function getVideosByProject(projectId: number): Promise<any[]> {
  await initializeDatabase()
  return executeQuery('SELECT * FROM videos WHERE project_id = ?', [projectId])
}

// Conversion operations
export async function saveConversionInfo(
  projectId: number,
  audioPath: string,
  duration: number
): Promise<number> {
  await initializeDatabase()
  const result = executeUpdate(
    `INSERT INTO conversions (project_id, audio_path, duration, converted_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    [projectId, audioPath, duration]
  )
  await saveDatabaseToDisk()
  return result.lastID
}

export async function getConversionsByProject(projectId: number): Promise<any[]> {
  await initializeDatabase()
  return executeQuery(
    'SELECT * FROM conversions WHERE project_id = ?',
    [projectId]
  )
}

// Output operations
export async function saveOutputInfo(
  projectId: number,
  finalVideoPath: string,
  thumbnailPath?: string,
  youtubeId?: string
): Promise<number> {
  await initializeDatabase()
  const result = executeUpdate(
    `INSERT INTO outputs (project_id, final_video_path, thumbnail_path, youtube_id, status)
     VALUES (?, ?, ?, ?, 'created')`,
    [projectId, finalVideoPath, thumbnailPath || null, youtubeId || null]
  )
  await saveDatabaseToDisk()
  return result.lastID
}

export async function getOutputsByProject(projectId: number): Promise<any[]> {
  await initializeDatabase()
  return executeQuery('SELECT * FROM outputs WHERE project_id = ?', [projectId])
}

export async function updateOutputYoutubeId(
  projectId: number,
  youtubeId: string
): Promise<void> {
  await initializeDatabase()
  executeUpdate(
    `UPDATE outputs
     SET youtube_id = ?, status = 'uploaded'
     WHERE project_id = ?`,
    [youtubeId, projectId]
  )
  await saveDatabaseToDisk()
}
