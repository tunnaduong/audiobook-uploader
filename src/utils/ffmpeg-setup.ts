import path from 'path'
import { execSync, exec } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import { createLogger } from './logger'

const logger = createLogger('ffmpeg-setup')

export async function getFFmpegPath(): Promise<string> {
  // 1. Check if FFmpeg is in the app's binary directory
  const appBinDir = getAppBinDirectory()
  const ffmpegName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const bundledFFmpegPath = path.join(appBinDir, ffmpegName)

  try {
    await fs.access(bundledFFmpegPath)
    logger.info(`Using bundled FFmpeg: ${bundledFFmpegPath}`)
    return bundledFFmpegPath
  } catch {
    logger.debug('Bundled FFmpeg not found, checking global installation')
  }

  // 2. Check if FFmpeg is globally installed
  try {
    if (process.platform === 'win32') {
      execSync('ffmpeg -version', { stdio: 'pipe' })
    } else {
      execSync('which ffmpeg', { stdio: 'pipe' })
    }
    logger.info('Using globally installed FFmpeg')
    return 'ffmpeg'
  } catch (error) {
    logger.error('FFmpeg not found globally', error)
  }

  // 3. FFmpeg not found - provide detailed error
  const errorMsg = [
    'FFmpeg is required but not installed.',
    '',
    'INSTALLATION INSTRUCTIONS:',
    '',
    'Windows (using Chocolatey):',
    '  choco install ffmpeg',
    '',
    'Windows (Manual):',
    '  1. Download from: https://ffmpeg.org/download.html',
    '  2. Extract to: C:\\ffmpeg',
    '  3. Add to PATH: C:\\ffmpeg\\bin',
    '  4. Restart all command prompts and IDE',
    '',
    'macOS:',
    '  brew install ffmpeg',
    '',
    'Linux (Ubuntu/Debian):',
    '  sudo apt-get install ffmpeg',
    '',
    'VERIFY:',
    '  Run in new command prompt: ffmpeg -version',
    '  Should show version info (not "command not found")',
    '',
    'CURRENT PATH:',
    `  ${process.env.PATH}`,
  ].join('\n')

  logger.error(errorMsg)
  throw new Error(errorMsg)
}

// Note: FFmpeg auto-download not implemented yet
// Users must install FFmpeg manually from https://ffmpeg.org/download.html

export function getAppBinDirectory(): string {
  const appDataPath = process.env.APPDATA || os.homedir()
  return path.join(appDataPath, '.audiobook-uploader', 'bin')
}

// Verify FFmpeg installation
export async function verifyFFmpegInstallation(ffmpegPath: string): Promise<boolean> {
  try {
    const command = `"${ffmpegPath}" -version`
    return new Promise((resolve) => {
      exec(command, { timeout: 5000 }, (error) => {
        if (error) {
          logger.error(`FFmpeg verification failed: ${error.message}`)
          resolve(false)
        } else {
          logger.info('FFmpeg verification successful')
          resolve(true)
        }
      })
    })
  } catch (error) {
    logger.error(`FFmpeg verification error: ${error}`)
    return false
  }
}

// Get FFmpeg version
export async function getFFmpegVersion(ffmpegPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(`"${ffmpegPath}" -version`, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        reject(error)
      } else {
        const match = stdout.match(/ffmpeg version ([\d.]+)/)
        resolve(match ? match[1] : 'unknown')
      }
    })
  })
}
