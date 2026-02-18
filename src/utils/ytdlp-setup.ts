import path from 'path'
import { execSync, exec } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import { createLogger } from './logger'

const logger = createLogger('ytdlp-setup')

export async function getYtdlpPath(): Promise<string> {
  // 1. Check if yt-dlp is in the app's binary directory
  const appBinDir = getAppBinDirectory()
  const ytdlpName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  const bundledYtdlpPath = path.join(appBinDir, ytdlpName)

  try {
    await fs.access(bundledYtdlpPath)
    logger.info(`Using bundled yt-dlp: ${bundledYtdlpPath}`)
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
    logger.info('Using globally installed yt-dlp')
    return 'yt-dlp'
  } catch {
    logger.debug('yt-dlp not found globally')
  }

  // 3. Download and setup yt-dlp
  logger.info('Downloading yt-dlp...')
  return downloadYtdlp()
}

async function downloadYtdlp(): Promise<string> {
  const appBinDir = getAppBinDirectory()
  const platform = process.platform
  let downloadUrl = ''

  // Build download URL based on platform
  if (platform === 'darwin') {
    // macOS (both Intel and Apple Silicon)
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/download/latest/yt-dlp_macos'
  } else if (platform === 'win32') {
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/download/latest/yt-dlp.exe'
  } else if (platform === 'linux') {
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/download/latest/yt-dlp'
  }

  try {
    // Create bin directory if it doesn't exist
    await fs.mkdir(appBinDir, { recursive: true })

    logger.info(`Downloading yt-dlp from: ${downloadUrl}`)
    // TODO: Implement actual download using node-fetch or axios
    logger.warn('yt-dlp download not fully implemented yet')

    const ytdlpName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
    const execPath = path.join(appBinDir, ytdlpName)

    // Make executable on Unix-like systems
    if (process.platform !== 'win32') {
      await fs.chmod(execPath, '0755')
    }

    return execPath
  } catch (error) {
    logger.error(`Failed to download yt-dlp: ${error}`)
    throw new Error('Failed to setup yt-dlp')
  }
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
