import { exec } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import { createLogger } from '../utils/logger'
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
    logger.info(`Downloading Douyin video: ${videoUrl}`)

    // Create the output filename
    const outputTemplate = path.join(options.outputPath, '%(title)s.%(ext)s')

    // Build yt-dlp command
    const command = [
      'yt-dlp',
      `--output "${outputTemplate}"`,
      '--format best[ext=mp4]',
      '--no-warnings',
      '--quiet',
      `"${videoUrl}"`,
    ].join(' ')

    logger.debug(`Executing: ${command}`)

    // Execute download
    const { stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 300000, // 5 minutes timeout
    })

    if (stderr) {
      logger.warn(`yt-dlp stderr: ${stderr}`)
    }

    // Extract video info
    const videoInfo = await getVideoInfo(videoUrl)

    logger.info(`Successfully downloaded video: ${videoInfo.title}`)

    return {
      id: videoInfo.id,
      title: videoInfo.title,
      url: videoUrl,
      duration: videoInfo.duration,
      localPath: path.join(options.outputPath, `${videoInfo.title}.mp4`),
      downloadedAt: new Date(),
    }
  } catch (error) {
    logger.error(`Failed to download video from ${videoUrl}`, error)
    throw error
  }
}

async function getVideoInfo(videoUrl: string): Promise<any> {
  try {
    const command = `yt-dlp --dump-json "${videoUrl}"`
    const { stdout } = await execAsync(command, { timeout: 30000 })
    return JSON.parse(stdout)
  } catch (error) {
    logger.error('Failed to get video info', error)
    throw error
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
  return /douyin\.com|dy\.zzz\.com\.cn|vt\.tiktok\.com/.test(url)
}
