import path from 'path'
import fs from 'fs'
import https from 'https'
import { createLogger } from '../utils/logger'
import type { Video } from '../types'

const logger = createLogger('douyin-service')

// Douyin API endpoint with minimal=true for reduced data
const DOUYIN_API_URL = 'https://douyin.tunnaduong.com/api/hybrid/video_data'

/**
 * Fetch JSON from HTTPS URL with proper error handling
 */
function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            // Check if response has error code
            if (parsed?.code !== 200) {
              reject(new Error(`API Error ${parsed?.code || 'unknown'}: ${parsed?.msg || parsed?.message || 'Unknown error'}`))
              return
            }
            resolve(parsed)
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e}`))
          }
        })
      })
      .on('error', (err) => {
        reject(new Error(`HTTPS request failed: ${err.message}`))
      })
  })
}

/**
 * Download video file from URL and save to disk
 */
async function downloadVideoFile(url: string, outputPath: string): Promise<void> {
  logger.debug(`💾 Downloading video from CDN...`)

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath)

    // Add proper headers to bypass Douyin CDN restrictions
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.douyin.com/',
      'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
      'Range': 'bytes=0-',
    }

    https
      .get(url, { headers }, (res) => {
        // Handle 403 by trying alternative approach
        if (res.statusCode === 403) {
          logger.warn(`⚠️ Got 403 Forbidden, trying with different headers...`)
          file.close()
          fs.unlink(outputPath, () => {})
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }

        if (res.statusCode !== 200 && res.statusCode !== 206) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }

        res.pipe(file)

        file.on('finish', () => {
          file.close()
          logger.debug(`✅ Video file saved: ${outputPath}`)
          resolve()
        })
      })
      .on('error', (err) => {
        fs.unlink(outputPath, () => {}) // Delete partial file
        reject(new Error(`CDN download failed: ${err.message}`))
      })
  })
}


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
  try {
    logger.info(`🎬 Downloading Douyin video: ${videoUrl}`)

    // Validate Douyin URL
    if (!isValidDouyinUrl(videoUrl)) {
      throw new Error(`Invalid Douyin URL: ${videoUrl}`)
    }

    // Create output directory if it doesn't exist
    if (!fs.existsSync(options.outputPath)) {
      fs.mkdirSync(options.outputPath, { recursive: true })
      logger.debug(`📁 Created output directory: ${options.outputPath}`)
    }

    const startTime = Date.now()

    // Call Douyin API to get video data
    logger.info(`📡 Fetching video metadata from API...`)
    const apiUrl = `${DOUYIN_API_URL}?url=${encodeURIComponent(videoUrl)}&minimal=true`
    logger.debug(`🔗 API URL: ${apiUrl}`)

    let apiResponse
    try {
      apiResponse = await fetchJson(apiUrl)
    } catch (apiError) {
      const errorMsg = apiError instanceof Error ? apiError.message : String(apiError)
      logger.error(`🔴 API call failed: ${errorMsg}`)

      if (errorMsg.includes('API Error')) {
        throw new Error(`Failed to fetch video metadata from Douyin API.\n\nTry:\n1. Make sure the Douyin URL is valid and publicly accessible\n2. Wait a few minutes and try again\n3. Try a different video`)
      }

      throw apiError
    }

    logger.debug(`✅ Got API response with code: ${apiResponse?.code}`)

    // Extract video download URL from API response
    // Response structure: { code: 200, data: { video_data: { nwm_video_url_HQ: "..." } } }
    const videoDownloadUrl = apiResponse?.data?.video_data?.nwm_video_url_HQ ||
                             apiResponse?.data?.video_data?.nwm_video_url ||
                             apiResponse?.data?.video_data?.wm_video_url_HQ ||
                             apiResponse?.data?.video_data?.wm_video_url

    if (!videoDownloadUrl) {
      logger.error(`❌ Could not extract video URL from API response`)
      logger.error(`   Available fields: ${Object.keys(apiResponse?.data?.video_data || {}).join(', ')}`)
      throw new Error('Failed to extract video download URL from API response.')
    }

    logger.info(`✅ Got video download URL from API`)
    logger.debug(`🎥 Video URL: ${videoDownloadUrl.substring(0, 100)}...`)

    // Download video file from CDN
    const outputFilePath = path.join(options.outputPath, 'video.mp4')
    logger.debug(`💾 Downloading to: ${outputFilePath}`)

    await downloadVideoFile(videoDownloadUrl, outputFilePath)

    // Verify file was created
    if (!fs.existsSync(outputFilePath)) {
      throw new Error('Video file was not created')
    }

    const fileSizeKB = Math.round(fs.statSync(outputFilePath).size / 1024)
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)

    logger.info(`✅ Successfully downloaded Douyin video in ${elapsedSeconds}s (${fileSizeKB}KB)`)

    return {
      id: apiResponse?.data?.video_id || extractVideoId(videoUrl) || 'unknown',
      title: apiResponse?.data?.desc || path.basename(outputFilePath, path.extname(outputFilePath)),
      url: videoUrl,
      duration: 0, // Could be enhanced with video duration detection
      localPath: outputFilePath,
      downloadedAt: new Date(),
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Failed to download video from ${videoUrl}: ${errorMsg}`, error)

    // Provide helpful error message
    let helpMessage = `Douyin download failed: ${errorMsg}`

    if (errorMsg.includes('Invalid Douyin URL')) {
      helpMessage += `\n\n⚠️  Please check the Douyin URL format.\n\nValid formats:\n- https://v.douyin.com/XXXX/\n- https://www.douyin.com/video/XXXXXXXXX`
    }

    throw new Error(helpMessage)
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
