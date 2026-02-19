/**
 * YouTube OAuth 2.0 Helper Utilities
 */

import { YouTubeOAuthConfig } from '../services/youtube-auth'
import { createLogger } from './logger'

const logger = createLogger('youtube-oauth-utils')

/**
 * Get OAuth 2.0 configuration from environment variables
 * These should be set in .env file or system environment
 */
export function getOAuthConfig(): YouTubeOAuthConfig {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET
  const redirectUrl = process.env.YOUTUBE_OAUTH_REDIRECT_URL || 'http://localhost:3000/oauth/callback'

  if (!clientId) {
    logger.error('❌ YOUTUBE_OAUTH_CLIENT_ID not set')
    throw new Error('YouTube OAuth Client ID not configured. Please set YOUTUBE_OAUTH_CLIENT_ID in .env')
  }

  if (!clientSecret) {
    logger.error('❌ YOUTUBE_OAUTH_CLIENT_SECRET not set')
    throw new Error('YouTube OAuth Client Secret not configured. Please set YOUTUBE_OAUTH_CLIENT_SECRET in .env')
  }

  return {
    clientId,
    clientSecret,
    redirectUrl,
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',      // Upload videos
      'https://www.googleapis.com/auth/youtube',             // Modify video metadata
      'https://www.googleapis.com/auth/userinfo.email',      // Get user email for channel info
    ],
  }
}

/**
 * YouTube category IDs for video classification
 * Common categories used for audiobook/storytelling content
 */
export const YOUTUBE_CATEGORIES = {
  ENTERTAINMENT: 24,
  EDUCATION: 27,
  HOWTO_STYLE: 26,
  PEOPLE_BLOGS: 15,
  FILM_ANIMATION: 1,
  MUSIC: 10,
  SHORTS: 42, // YouTube Shorts
}

/**
 * Generate YouTube video metadata from story information
 */
export function generateYouTubeMetadata(storyTitle: string, storyText: string) {
  // Extract first 500 characters for description
  const textPreview = storyText.substring(0, 500).trim()
  const description = `📖 Audiobook: ${storyTitle}

Nội dung truyện:
${textPreview}...

🎬 Video được tạo tự động bằng Audiobook Uploader
💜 Truyện tiểu thuyết | Âm thanh | Nấu ăn

#audiobook #tiểu_thuyết #truyện_ngắn #vietnamese`

  return {
    title: `📖 ${storyTitle} | Audiobook + Cooking`,
    description,
    tags: [
      'audiobook',
      'tiểu thuyết',
      'truyện ngắn',
      'vietnamese',
      'storytelling',
      'cooking',
      're-up',
    ],
    categoryId: YOUTUBE_CATEGORIES.ENTERTAINMENT,
  }
}

/**
 * Parse YouTube URL and extract video ID
 */
export function parseYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url)

    // Handle youtube.com URLs
    if (urlObj.hostname === 'youtube.com' || urlObj.hostname === 'www.youtube.com') {
      const videoId = urlObj.searchParams.get('v')
      return videoId
    }

    // Handle youtu.be short URLs
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1)
    }

    return null
  } catch {
    return null
  }
}

/**
 * Build YouTube video URL from video ID
 */
export function buildYouTubeVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/**
 * Check if error is due to expired/invalid token
 */
export function isTokenExpiredError(error: any): boolean {
  if (!error) return false

  const errorMessage = error.message?.toLowerCase() || error.toString().toLowerCase()
  return (
    error.status === 401 ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('invalid_grant') ||
    errorMessage.includes('token expired')
  )
}

/**
 * Check if error is due to rate limiting
 */
export function isRateLimitError(error: any): boolean {
  if (!error) return false

  return (
    error.status === 403 ||
    error.status === 429 ||
    error.message?.includes('quotaExceeded') ||
    error.message?.includes('rate limit')
  )
}

/**
 * Sleep for specified milliseconds
 * Useful for rate limit backoff
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Exponential backoff with jitter
 * Used for retrying failed requests
 */
export async function exponentialBackoff(attempt: number, maxAttempts: number = 5): Promise<boolean> {
  if (attempt >= maxAttempts) {
    return false
  }

  // Calculate delay: 2^attempt * 1000ms with jitter
  const baseDelay = Math.pow(2, attempt) * 1000
  const jitter = Math.random() * 1000
  const delay = baseDelay + jitter

  logger.info(`⏳ Retrying after ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxAttempts})`)
  await sleep(delay)
  return true
}
