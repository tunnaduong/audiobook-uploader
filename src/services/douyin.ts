import { exec } from 'child_process'
import path from 'path'
import fs from 'fs'
import { promisify } from 'util'
import { createLogger } from '../utils/logger'
import { getDouyinDownloaderPath, createDouyinConfig, checkPythonInstallation } from '../utils/douyin-downloader-setup'
import type { Video } from '../types'

const execAsync = promisify(exec)
const logger = createLogger('douyin-service')

interface DownloadOptions {
  outputPath: string
  minDuration?: number
  maxDuration?: number
}

export async function searchDouyinVideos(
  keyword: string,
  _maxResults: number = 5
): Promise<Video[]> {
  try {
    logger.info(`Searching Douyin for keyword: ${keyword}`)

    // TODO: Implement actual Douyin search using douyin-downloader
    // This would require using downloader.py with search feature

    // Placeholder response
    return []
  } catch (error) {
    logger.error('Failed to search Douyin videos', error)
    throw error
  }
}

export async function downloadDouyinVideo(
  videoUrl: string,
  options: DownloadOptions
): Promise<Video> {
  let configFilePath: string | null = null

  try {
    logger.info(`🎬 Downloading Douyin video: ${videoUrl}`)

    // Check Python installation
    if (!checkPythonInstallation()) {
      throw new Error('Python 3.9+ is required. Please install Python from https://www.python.org/')
    }

    // Get douyin-downloader path
    const downloaderPath = await getDouyinDownloaderPath()

    // Get cookies file if configured
    const cookiesFile = process.env.DOUYIN_COOKIES_FILE
    if (cookiesFile && !fs.existsSync(cookiesFile)) {
      logger.warn(`⚠️  Cookies file not found: ${cookiesFile}`)
    }

    // Create temp config file
    configFilePath = createDouyinConfig(videoUrl, options.outputPath, cookiesFile)

    // Build Python command to run DouYinCommand.py
    const scriptPath = path.join(downloaderPath, 'DouYinCommand.py')
    const command = `python "${scriptPath}" --config "${configFilePath}"`

    logger.info(`🔧 Executing douyin-downloader (V1.0 - Stable)...`)
    logger.debug(`Command: ${command}`)

    // Execute download
    const startTime = Date.now()
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      timeout: 600000, // 10 minutes timeout
      cwd: downloaderPath, // Run from downloader directory
    })

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)

    if (stderr) {
      logger.debug(`Downloader output: ${stderr}`)
    }

    if (stdout) {
      logger.debug(`Downloader stdout: ${stdout}`)
    }

    // Find the downloaded video file
    const downloadedFile = findDownloadedVideo(options.outputPath)

    if (!downloadedFile) {
      throw new Error('Video file not found after download. Check logs for details.')
    }

    logger.info(`✅ Successfully downloaded video in ${elapsedSeconds}s`)

    return {
      id: extractVideoId(videoUrl) || 'unknown',
      title: path.basename(downloadedFile, path.extname(downloadedFile)),
      url: videoUrl,
      duration: 0, // Could be enhanced with video duration detection
      localPath: downloadedFile,
      downloadedAt: new Date(),
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Failed to download video from ${videoUrl}: ${errorMsg}`, error)

    // Provide helpful error message
    let helpMessage = `Douyin download failed: ${errorMsg}`

    if (errorMsg.includes('Python')) {
      helpMessage += `\n\n⚠️  Python is required to use douyin-downloader.\n\nPlease install Python 3.9+ from: https://www.python.org/\n\nAfter installation, restart the app.`
    } else if (errorMsg.includes('douyin-downloader')) {
      helpMessage += `\n\n⚠️  douyin-downloader not installed.\n\nPlease install dependencies:\n1. cd "C:\\dev\\audiobook-uploader\\bin\\douyin-downloader"\n2. pip install -r requirements.txt`
    } else if (errorMsg.includes('Cookie') || errorMsg.includes('cookies')) {
      helpMessage += `\n\n⚠️  Douyin requires valid cookies to download videos.\n\nTo get fresh cookies:\n1. Open Chrome and visit: https://www.douyin.com/\n2. Watch 2-3 videos to ensure cookies are set\n3. Restart the app\n4. Try downloading again`
    }

    throw new Error(helpMessage)
  } finally {
    // Clean up temp config file
    if (configFilePath && fs.existsSync(configFilePath)) {
      try {
        fs.unlinkSync(configFilePath)
        logger.debug(`Cleaned up temp config: ${configFilePath}`)
      } catch {
        logger.warn(`Failed to clean up temp config: ${configFilePath}`)
      }
    }
  }
}

/**
 * Find the downloaded video file in output directory
 */
function findDownloadedVideo(outputPath: string): string | null {
  try {
    if (!fs.existsSync(outputPath)) {
      return null
    }

    const files = fs.readdirSync(outputPath)

    // Look for MP4 files (most recent first)
    const videoFiles = files
      .filter(f => f.toLowerCase().endsWith('.mp4'))
      .map(f => path.join(outputPath, f))
      .sort((a, b) => {
        const statA = fs.statSync(a)
        const statB = fs.statSync(b)
        return statB.mtimeMs - statA.mtimeMs // Most recent first
      })

    if (videoFiles.length > 0) {
      logger.info(`📁 Found video: ${videoFiles[0]}`)
      return videoFiles[0]
    }

    return null
  } catch (error) {
    logger.warn(`Failed to find downloaded video: ${error}`)
    return null
  }
}

export async function downloadMultipleVideos(
  urls: string[],
  options: DownloadOptions
): Promise<Video[]> {
  const videos: Video[] = []
  const errors: Array<{ url: string; error: unknown }> = []

  for (const url of urls) {
    try {
      const video = await downloadDouyinVideo(url, options)
      videos.push(video)
    } catch (error) {
      logger.error(`Failed to download ${url}`, error)
      errors.push({ url, error })
    }
  }

  if (errors.length > 0) {
    logger.warn(`Failed to download ${errors.length} out of ${urls.length} videos`)
  }

  return videos
}

// Extract video ID from Douyin URL
export function extractVideoId(url: string): string | null {
  const patterns = [
    /douyin\.com\/video\/(\d+)/,
    /dy\.zzz\.com\.cn\/(\w+)/,
    /vt\.tiktok\.com\/(\w+)/,
    /v\.douyin\.com\/(\w+)/,  // Short URL format
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

// Check if URL is a valid Douyin/TikTok URL
export function isValidDouyinUrl(url: string): boolean {
  return /douyin\.com|dy\.zzz\.com\.cn|vt\.tiktok\.com|v\.douyin\.com/.test(url)
}

// Extract Douyin URL from text (handles pasted content with extra text)
export function extractDouyinUrlFromText(text: string): string | null {
  if (!text || !text.trim()) return null

  // Try to find URL in the text
  const urlMatch = text.match(/https?:\/\/[^\s]+/g)
  if (!urlMatch) return null

  // Find the first valid Douyin URL
  for (const url of urlMatch) {
    if (isValidDouyinUrl(url)) {
      return url
    }
  }

  return null
}
