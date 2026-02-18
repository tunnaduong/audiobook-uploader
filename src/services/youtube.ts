import axios, { AxiosInstance } from 'axios'
import { createReadStream } from 'fs'
import { createLogger } from '../utils/logger'
import type { YouTubeUploadResult, VideoMetadata } from '../types'

const logger = createLogger('youtube-service')

const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3'

interface YouTubeAuthConfig {
  accessToken: string
  refreshToken?: string
}

let authConfig: YouTubeAuthConfig | null = null
let apiClient: AxiosInstance | null = null

function initializeClient(accessToken: string): AxiosInstance {
  if (!apiClient) {
    apiClient = axios.create({
      baseURL: YOUTUBE_API_URL,
      timeout: 600000, // 10 minutes for uploads
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
  }
  return apiClient
}

export async function setAuthToken(accessToken: string): Promise<void> {
  authConfig = {
    accessToken,
  }
  apiClient = initializeClient(accessToken)
  logger.info('YouTube authentication token set')
}

export async function uploadVideo(
  filePath: string,
  metadata: VideoMetadata,
  accessToken: string
): Promise<YouTubeUploadResult> {
  if (!accessToken) {
    throw new Error('YouTube access token required')
  }

  try {
    logger.info(`Uploading video: ${metadata.title}`)

    const client = initializeClient(accessToken)

    // Create video metadata
    const videoMetadata = {
      snippet: {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: '24', // Entertainment category
        defaultLanguage: metadata.language || 'vi',
        defaultAudioLanguage: metadata.language || 'vi',
      },
      status: {
        privacyStatus: metadata.visibility,
        selfDeclaredMadeForKids: false,
      },
    }

    // Upload with resumable upload protocol
    const response = await client.post('/videos?part=snippet,status', videoMetadata, {
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': (require('fs').statSync(filePath).size).toString(),
        'Content-Type': 'application/json',
      },
    })

    const uploadUrl = response.headers['location']

    if (!uploadUrl) {
      throw new Error('Failed to get upload URL')
    }

    logger.debug(`Got upload URL: ${uploadUrl}`)

    // Upload the actual video file
    const fileStream = createReadStream(filePath)
    const uploadResponse = await axios.put(uploadUrl, fileStream, {
      headers: {
        'Content-Type': 'video/mp4',
      },
      timeout: 600000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    })

    const videoId = uploadResponse.data.id

    logger.info(`Video uploaded successfully: ${videoId}`)

    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      status: 'succeeded',
      uploadedAt: new Date(),
    }
  } catch (error) {
    logger.error('Failed to upload video', error)
    throw error
  }
}

// Search for videos on the channel
export async function searchVideos(query: string, maxResults: number = 10): Promise<any[]> {
  if (!apiClient || !authConfig) {
    throw new Error('YouTube client not initialized')
  }

  try {
    const response = await apiClient.get('/search', {
      params: {
        part: 'snippet',
        q: query,
        maxResults,
        type: 'video',
        forMine: true,
      },
    })

    return response.data.items || []
  } catch (error) {
    logger.error('Failed to search videos', error)
    throw error
  }
}

// Get channel information
export async function getChannelInfo(): Promise<any> {
  if (!apiClient || !authConfig) {
    throw new Error('YouTube client not initialized')
  }

  try {
    const response = await apiClient.get('/channels', {
      params: {
        part: 'snippet,contentDetails,statistics',
        mine: true,
      },
    })

    return response.data.items?.[0] || null
  } catch (error) {
    logger.error('Failed to get channel info', error)
    throw error
  }
}

// Update video metadata
export async function updateVideo(
  videoId: string,
  metadata: Partial<VideoMetadata>
): Promise<void> {
  if (!apiClient || !authConfig) {
    throw new Error('YouTube client not initialized')
  }

  try {
    const updateData: any = {
      id: videoId,
      snippet: {},
      status: {},
    }

    if (metadata.title) updateData.snippet.title = metadata.title
    if (metadata.description) updateData.snippet.description = metadata.description
    if (metadata.tags) updateData.snippet.tags = metadata.tags
    if (metadata.visibility) updateData.status.privacyStatus = metadata.visibility

    await apiClient.put('/videos?part=snippet,status', updateData)

    logger.info(`Video ${videoId} updated`)
  } catch (error) {
    logger.error(`Failed to update video ${videoId}`, error)
    throw error
  }
}

// Delete video
export async function deleteVideo(videoId: string): Promise<void> {
  if (!apiClient || !authConfig) {
    throw new Error('YouTube client not initialized')
  }

  try {
    await apiClient.delete('/videos', {
      params: {
        id: videoId,
      },
    })

    logger.info(`Video ${videoId} deleted`)
  } catch (error) {
    logger.error(`Failed to delete video ${videoId}`, error)
    throw error
  }
}

// Check if we're rate limited and wait if necessary
export async function checkRateLimit(): Promise<number> {
  if (!apiClient || !authConfig) {
    throw new Error('YouTube client not initialized')
  }

  try {
    // Make a lightweight API call to check quota
    const response = await apiClient.get('/videos', {
      params: {
        part: 'id',
        maxResults: 1,
        mine: true,
      },
    })

    const headers = response.headers
    const quotaRemaining = parseInt(headers['x-goog-quota-user-remaining'] || '0')
    const resetTime = parseInt(headers['x-goog-quota-reset-time'] || '0')

    logger.debug(`Quota remaining: ${quotaRemaining}, Reset time: ${resetTime}`)

    return quotaRemaining
  } catch (error) {
    logger.error('Failed to check rate limit', error)
    throw error
  }
}
