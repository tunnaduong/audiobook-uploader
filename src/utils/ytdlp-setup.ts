import path from 'path'
import { execSync, exec } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import { createLogger } from './logger'

const logger = createLogger('ytdlp-setup')

export async function getYtdlpPath(): Promise<string> {
  // 0. Check if YTDLP_PATH is set in .env
  if (process.env.YTDLP_PATH) {
    try {
      await fs.access(process.env.YTDLP_PATH)
      logger.info(`✅ Using yt-dlp from .env: ${process.env.YTDLP_PATH}`)
      return process.env.YTDLP_PATH
    } catch {
      logger.warn(`⚠️ YTDLP_PATH in .env not found: ${process.env.YTDLP_PATH}`)
    }
  }

  // 1. Check if yt-dlp is in the app's binary directory
  const appBinDir = getAppBinDirectory()
  const ytdlpName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  const bundledYtdlpPath = path.join(appBinDir, ytdlpName)

  try {
    await fs.access(bundledYtdlpPath)
    logger.info(`✅ Using bundled yt-dlp: ${bundledYtdlpPath}`)
    return bundledYtdlpPath
  } catch {
    logger.debug('Bundled yt-dlp not found, checking global installation')
  }

  // 2. Check if yt-dlp is globally installed
  try {
    if (process.platform === 'win32') {
      execSync('yt-dlp --version', { stdio: 'pipe' })
    } else {
      execSync('which yt-dlp', { stdio: 'pipe' })
    }
    logger.info('✅ Using globally installed yt-dlp')
    return 'yt-dlp'
  } catch {
    logger.debug('yt-dlp not found globally')
  }

  // 3. If all else fails, throw detailed error
  const errorMsg = `❌ yt-dlp not found!\n\nSolutions:\n1. Download from: https://github.com/yt-dlp/yt-dlp/releases/download/latest/yt-dlp.exe\n2. Place it anywhere (e.g., C:\\yt-dlp\\yt-dlp.exe)\n3. Set in .env: YTDLP_PATH=C:\\path\\to\\yt-dlp.exe\nor set globally in PATH environment variable`
  logger.error(errorMsg)
  throw new Error(errorMsg)
}

export function getAppBinDirectory(): string {
  const appDataPath = process.env.APPDATA || os.homedir()
  return path.join(appDataPath, '.audiobook-uploader', 'bin')
}

// Verify yt-dlp installation
export async function verifyYtdlpInstallation(ytdlpPath: string): Promise<boolean> {
  try {
    const command = `"${ytdlpPath}" --version`
    return new Promise((resolve) => {
      exec(command, { timeout: 5000 }, (error) => {
        if (error) {
          logger.error(`yt-dlp verification failed: ${error.message}`)
          resolve(false)
        } else {
          logger.info('yt-dlp verification successful')
          resolve(true)
        }
      })
    })
  } catch (error) {
    logger.error(`yt-dlp verification error: ${error}`)
    return false
  }
}

// Get yt-dlp version
export async function getYtdlpVersion(ytdlpPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`"${ytdlpPath}" --version`, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        reject(error)
      } else {
        const version = stdout.trim()
        resolve(version)
      }
    })
  })
}
