import { exec } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import { createLogger } from '../utils/logger'
import { getYtdlpPath } from '../utils/ytdlp-setup'
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

    // TODO: Implement actual Douyin search using yt-dlp
    // This would require using yt-dlp's search feature with Douyin URL patterns

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
  try {
    logger.info(`🎬 Downloading Douyin video: ${videoUrl}`)

    const ytdlpPath = await getYtdlpPath()

    // Create the output filename (without extension - let yt-dlp decide)
    const outputTemplate = path.join(options.outputPath, '%(title)s')

    // Build yt-dlp command with best quality MP4 format
    // Douyin requires cookies - try multiple methods to get them
    const cookiesFile = process.env.DOUYIN_COOKIES_FILE

    let command = [
      `"${ytdlpPath}"`,
    ]

    // Add cookies if available
    if (cookiesFile) {
      logger.info(`📝 Using cookies from: ${cookiesFile}`)
      command.push(`--cookies "${cookiesFile}"`)
    } else {
      logger.info(`🔄 Attempting to extract cookies from Chrome browser...`)
      command.push(`--cookies-from-browser chrome`)
    }

    command.push(
      `-o "${outputTemplate}.%(ext)s"`,
      '-f "best[ext=mp4]/best"',  // Prefer MP4, fallback to best available
      '--no-warnings',
      '--socket-timeout', '30'
    )

    command.push(`"${videoUrl}"`)

    const commandStr = command.join(' ')

    logger.info(`🔧 Executing yt-dlp...`)
    logger.debug(`Command: ${commandStr}`)

    // Execute download
    const startTime = Date.now()
    const { stdout, stderr } = await execAsync(commandStr, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      timeout: 600000, // 10 minutes timeout
    })

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)

    if (stderr) {
      logger.debug(`yt-dlp output: ${stderr}`)
    }

    if (stdout) {
      logger.debug(`yt-dlp stdout: ${stdout}`)
    }

    // Extract video info
    const videoInfo = await getVideoInfo(videoUrl)

    logger.info(`✅ Successfully downloaded video in ${elapsedSeconds}s: ${videoInfo.title}`)

    return {
      id: videoInfo.id,
      title: videoInfo.title,
      url: videoUrl,
      duration: videoInfo.duration,
      localPath: path.join(options.outputPath, `${videoInfo.title}.mp4`),
      downloadedAt: new Date(),
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Failed to download video from ${videoUrl}: ${errorMsg}`, error)

    // Provide helpful error message
    let helpMessage = `Douyin download failed: ${errorMsg}`

    if (errorMsg.includes('Fresh cookies')) {
      helpMessage += `\n\n⚠️ Douyin requires cookies to download videos.\n\nSolutions:\n1. Open Douyin in Chrome browser first (to set cookies)\n2. Or provide cookies file: add DOUYIN_COOKIES_FILE=path/to/cookies.txt to .env\n3. Cookies can be extracted using: yt-dlp --cookies-from-browser chrome --cookies cookies.txt`
    } else if (errorMsg.includes('yt-dlp')) {
      helpMessage += `\n\nMake sure yt-dlp is properly installed and YTDLP_PATH is set in .env if needed`
    }

    throw new Error(helpMessage)
  }
}

async function getVideoInfo(videoUrl: string): Promise<any> {
  try {
    const ytdlpPath = await getYtdlpPath()
    const cookiesFile = process.env.DOUYIN_COOKIES_FILE

    let command = `"${ytdlpPath}"`

    // Add cookies if available
    if (cookiesFile) {
      command += ` --cookies "${cookiesFile}"`
    } else {
      command += ` --cookies-from-browser chrome`
    }

    command += ` --dump-json "${videoUrl}"`

    logger.debug(`Getting video info...`)
    const { stdout } = await execAsync(command, { timeout: 60000 })

    const info = JSON.parse(stdout)
    logger.info(`📊 Video info: ${info.title} (${info.duration}s)`)

    return info
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Failed to get video info: ${errorMsg}`, error)
    throw new Error(`Could not extract video info: ${errorMsg}`)
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
