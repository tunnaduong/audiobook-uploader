import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import { createWriteStream } from 'fs'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  data?: unknown
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

let currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
let logDirectory: string | null = null
let logStream: NodeJS.WritableStream | null = null
let logListeners: ((entry: LogEntry) => void)[] = []

export function getLogDirectory(): string {
  if (!logDirectory) {
    const appDataPath = process.env.APPDATA || os.homedir()
    logDirectory = path.join(appDataPath, '.audiobook-uploader', 'logs')
  }
  return logDirectory
}

export async function initializeLogger(): Promise<void> {
  const logDir = getLogDirectory()
  try {
    await fs.mkdir(logDir, { recursive: true })
    const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`)
    logStream = createWriteStream(logFile, { flags: 'a' })
  } catch (error) {
    console.error('Failed to initialize logger:', error)
  }
}

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level
}

export function onLog(listener: (entry: LogEntry) => void): () => void {
  logListeners.push(listener)
  // Return unsubscribe function
  return () => {
    logListeners = logListeners.filter(l => l !== listener)
  }
}

function formatLogEntry(entry: LogEntry): string {
  const { timestamp, level, module, message, data } = entry
  const dataStr = data ? ` | ${JSON.stringify(data)}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${dataStr}`
}

function writeLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry)

  // Console output
  const consoleMethod = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  }[entry.level]
  consoleMethod(formatted)

  // File output
  if (logStream) {
    logStream.write(formatted + '\n')
  }

  // Notify all listeners (for UI display)
  for (const listener of logListeners) {
    try {
      listener(entry)
    } catch (err) {
      console.error('Error in log listener:', err)
    }
  }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[currentLogLevel]
}

export function createLogger(moduleName: string) {
  return {
    error: (message: string, data?: unknown) => {
      if (shouldLog('error')) {
        writeLog({
          timestamp: new Date().toISOString(),
          level: 'error',
          module: moduleName,
          message,
          data,
        })
      }
    },
    warn: (message: string, data?: unknown) => {
      if (shouldLog('warn')) {
        writeLog({
          timestamp: new Date().toISOString(),
          level: 'warn',
          module: moduleName,
          message,
          data,
        })
      }
    },
    info: (message: string, data?: unknown) => {
      if (shouldLog('info')) {
        writeLog({
          timestamp: new Date().toISOString(),
          level: 'info',
          module: moduleName,
          message,
          data,
        })
      }
    },
    debug: (message: string, data?: unknown) => {
      if (shouldLog('debug')) {
        writeLog({
          timestamp: new Date().toISOString(),
          level: 'debug',
          module: moduleName,
          message,
          data,
        })
      }
    },
  }
}

// Clean old logs (keep last 10 days)
export async function cleanOldLogs(daysToKeep: number = 10): Promise<void> {
  try {
    const logDir = getLogDirectory()
    const files = await fs.readdir(logDir)
    const now = Date.now()
    const maxAge = daysToKeep * 24 * 60 * 60 * 1000

    for (const file of files) {
      if (file.endsWith('.log')) {
        const filePath = path.join(logDir, file)
        const stats = await fs.stat(filePath)
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath)
          console.log(`Deleted old log file: ${file}`)
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning old logs:', error)
  }
}
