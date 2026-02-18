import axios, { AxiosInstance } from 'axios'
import { writeFile, unlink } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import https from 'https'
import path from 'path'
import { createLogger } from '../utils/logger'
import { getFFmpegPath } from '../utils/ffmpeg-setup'
import type { AudioFile } from '../types'

const execAsync = promisify(exec)

const logger = createLogger('vbee-service')

const VBEE_API_URL = 'https://vbee.vn/api/v1/tts'
const VBEE_API_KEY = process.env.VBEE_API_KEY
const VBEE_APP_ID = process.env.VBEE_APP_ID

interface VbeeConfig {
  apiKey: string
  appId: string
  maxChunkSize?: number // characters
  voiceCode?: string
  audioType?: 'mp3' | 'wav'
  bitrate?: number
  speedRate?: number
}

interface TextChunk {
  text: string
  index: number
}

interface VbeeRequest {
  app_id: string
  response_type: 'indirect'
  callback_url: string
  input_text: string
  voice_code: string
  audio_type?: 'mp3' | 'wav'
  bitrate?: number
  speed_rate?: number
}

let client: AxiosInstance | null = null

function initializeClient(apiKey: string): AxiosInstance {
  if (!client) {
    // Create HTTPS agent to handle SSL
    const httpsAgent = new https.Agent({
      rejectUnauthorized: true,
    })

    client = axios.create({
      baseURL: VBEE_API_URL,
      timeout: 120000, // Increased to 120s for long TTS conversions
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
    })
  }
  return client
}

// Split text into chunks by sentence boundaries
function splitTextIntoChunks(text: string, maxChunkSize: number = 2000): TextChunk[] {
  const chunks: TextChunk[] = []
  const sentences = text.match(/[^.!?]*[.!?]+/g) || [text]

  let currentChunk = ''
  let chunkIndex = 0

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxChunkSize) {
      currentChunk += sentence
    } else {
      if (currentChunk) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
        })
      }
      currentChunk = sentence
    }
  }

  if (currentChunk) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
    })
  }

  return chunks
}

// Submit TTS request to Vbee API
async function submitTtsRequest(
  client: AxiosInstance,
  text: string,
  config: VbeeConfig
): Promise<string> {
  try {
    const requestBody: VbeeRequest = {
      app_id: config.appId,
      response_type: 'indirect',
      callback_url: 'https://example.com/callback', // Will be replaced with actual callback URL
      input_text: text,
      voice_code: config.voiceCode || 'n_hanoi_female_nguyetnga2_book_vc', // Default voice (audiobook-optimized)
      audio_type: config.audioType || 'mp3',
      bitrate: config.bitrate || 128,
      speed_rate: config.speedRate || 1.0,
    }

    logger.debug(`Submitting TTS request for ${text.length} characters`)

    const response = await client.post('', requestBody)

    if (response.data.status !== 1) {
      throw new Error(`Vbee API error: ${response.data.error_message || 'Unknown error - Vbee Submit'}`)
    }

    const requestId = response.data.result?.request_id

    if (!requestId) {
      throw new Error('No request_id in response')
    }

    logger.info(`TTS request submitted: ${requestId}`)
    return requestId
  } catch (error) {
    logger.error('Failed to submit TTS request', error)
    throw error
  }
}

// Poll for TTS request status
async function pollTtsStatus(
  client: AxiosInstance,
  requestId: string,
  maxAttempts: number = 300, // Increased from 60 to 300 (5 minutes with 1s delays)
  delayMs: number = 1000
): Promise<string> {
  let attempts = 0
  const startTime = Date.now()

  while (attempts < maxAttempts) {
    try {
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
      logger.debug(`Polling TTS status: ${requestId} (attempt ${attempts + 1}/${maxAttempts}, elapsed: ${elapsedSeconds}s)`)

      const response = await client.get(`/${requestId}`)

      if (response.data.status !== 1) {
        throw new Error(`Vbee API error: ${response.data.error_message || 'Unknown error - Vbee Poll'}`)
      }

      const result = response.data.result

      if (result.status === 'SUCCESS') {
        logger.info(`TTS conversion completed: ${requestId} (elapsed: ${elapsedSeconds}s)`)
        return result.audio_link
      }

      if (result.status === 'FAILURE') {
        throw new Error(`TTS conversion failed for request ${requestId}: ${result.error_message || 'Unknown reason'}`)
      }

      // IN_PROGRESS - wait and retry
      logger.debug(`TTS conversion in progress (${result.progress || 0}%)`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      attempts++
    } catch (error) {
      if (attempts < maxAttempts - 1) {
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
        logger.warn(`Error polling status at ${elapsedSeconds}s, retrying...`, error)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        attempts++
      } else {
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
        logger.error(`Failed to get TTS status after ${elapsedSeconds}s and ${maxAttempts} attempts`, error)
        throw error
      }
    }
  }

  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
  throw new Error(`TTS conversion timeout for request ${requestId} (exceeded ${elapsedSeconds}s)`)
}

// Download audio from URL
async function downloadAudio(audioUrl: string): Promise<Buffer> {
  try {
    logger.debug(`Downloading audio from: ${audioUrl}`)

    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 120000, // Increased to 120s for large audio files
    })

    logger.debug(`Audio downloaded successfully (${response.data.byteLength} bytes)`)
    return Buffer.from(response.data)
  } catch (error) {
    logger.error('Failed to download audio', error)
    throw error
  }
}

// Concatenate multiple MP3 files using FFmpeg (correct way to merge MP3s)
async function concatenateAudioFiles(
  audioFilePaths: string[],
  outputPath: string
): Promise<void> {
  if (audioFilePaths.length === 1) {
    // Only one file, no need to concatenate
    return
  }

  try {
    logger.info(`Concatenating ${audioFilePaths.length} MP3 files using FFmpeg`)

    const ffmpegPath = await getFFmpegPath()

    // Create concat demuxer file
    const concatContent = audioFilePaths
      .map((filePath) => `file '${filePath.replace(/'/g, "\\'")}'`)
      .join('\n')

    const concatFilePath = path.join(path.dirname(outputPath), 'concat_list.txt')
    await writeFile(concatFilePath, concatContent)

    // Use FFmpeg concat demuxer to merge MP3 files
    const command = [
      `"${ffmpegPath}"`,
      '-f', 'concat',
      '-safe', '0',
      '-i', `"${concatFilePath}"`,
      '-c', 'copy',  // Copy codec (no re-encoding needed)
      '-y',
      `"${outputPath}"`,
    ].join(' ')

    logger.debug(`Executing FFmpeg concat: ${command}`)

    const { stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120000,
    })

    if (stderr) {
      logger.debug(`FFmpeg concat output: ${stderr}`)
    }

    // Clean up concat file
    await unlink(concatFilePath).catch(() => {
      // Ignore error if file doesn't exist
    })

    logger.info(`MP3 files concatenated successfully: ${outputPath}`)
  } catch (error) {
    logger.error('Failed to concatenate audio files', error)
    throw error
  }
}

// Main function: Convert text to speech with proper polling
export async function convertTextToSpeech(
  text: string,
  outputPath: string,
  voiceCode: string = 'n_hanoi_female_nguyetnga2_book_vc'
): Promise<AudioFile> {
  if (!VBEE_API_KEY || !VBEE_APP_ID) {
    throw new Error('VBEE_API_KEY and VBEE_APP_ID are required')
  }

  const config: VbeeConfig = {
    apiKey: VBEE_API_KEY,
    appId: VBEE_APP_ID,
    voiceCode,
    audioType: 'mp3',
    bitrate: 128,
    speedRate: 1.0,
  }

  try {
    logger.info(`Converting text to speech (${text.length} characters)`)

    const apiClient = initializeClient(config.apiKey)

    // Vbee has character limits, so we should chunk large texts
    const chunks = splitTextIntoChunks(text, 2000)
    logger.info(`Split text into ${chunks.length} chunk(s)`)

    const chunkFilePaths: string[] = []
    let totalDuration = 0

    try {
      for (const chunk of chunks) {
        try {
          logger.info(`Converting chunk ${chunk.index + 1}/${chunks.length}`)

          // Submit TTS request
          const requestId = await submitTtsRequest(apiClient, chunk.text, config)

          // Poll for completion
          const audioUrl = await pollTtsStatus(apiClient, requestId)

          // Download audio
          const audioBuffer = await downloadAudio(audioUrl)

          // Save chunk to temporary file
          const chunkFilePath = path.join(
            path.dirname(outputPath),
            `chunk_${chunk.index}.mp3`
          )
          await writeFile(chunkFilePath, audioBuffer)
          chunkFilePaths.push(chunkFilePath)

          // Calculate duration
          const chunkDuration = calculateAudioDuration(audioBuffer)
          totalDuration += chunkDuration

          logger.info(`Chunk ${chunk.index + 1} converted: ${audioBuffer.length} bytes, ${chunkDuration}s`)
        } catch (error) {
          logger.error(`Failed to convert chunk ${chunk.index + 1}`, error)
          throw error
        }
      }

      // Concatenate all chunks using FFmpeg
      if (chunkFilePaths.length > 1) {
        logger.info(`Concatenating ${chunkFilePaths.length} chunks using FFmpeg`)
        await concatenateAudioFiles(chunkFilePaths, outputPath)
      } else if (chunkFilePaths.length === 1) {
        // Only one chunk, just rename it
        const fs = await import('fs/promises')
        await fs.rename(chunkFilePaths[0], outputPath)
      }

      // Get file size
      const fs = await import('fs/promises')
      const stats = await fs.stat(outputPath)

      logger.info(`Audio saved to ${outputPath} (${stats.size} bytes, ${totalDuration}s)`)

      return {
        path: outputPath,
        duration: totalDuration,
        sampleRate: 48000, // Vbee default for hn_female voices
        channels: 1,
        format: 'mp3',
        fileSize: stats.size,
      }
    } finally {
      // Clean up temporary chunk files
      for (const chunkPath of chunkFilePaths) {
        await unlink(chunkPath).catch(() => {
          // Ignore errors
        })
      }
    }
  } catch (error) {
    logger.error('Failed to convert text to speech', error)
    throw error
  }
}

// Convert multiple text chunks (already split by user)
export async function convertChunkedTextToSpeech(
  textChunks: string[],
  outputPath: string,
  voiceCode: string = 'n_hanoi_female_nguyetnga2_book_vc'
): Promise<AudioFile> {
  if (!VBEE_API_KEY || !VBEE_APP_ID) {
    throw new Error('VBEE_API_KEY and VBEE_APP_ID are required')
  }

  const config: VbeeConfig = {
    apiKey: VBEE_API_KEY,
    appId: VBEE_APP_ID,
    voiceCode,
    audioType: 'mp3',
    bitrate: 128,
    speedRate: 1.0,
  }

  try {
    logger.info(`Converting ${textChunks.length} text chunks to speech`)

    const apiClient = initializeClient(config.apiKey)
    const chunkFilePaths: string[] = []
    let totalDuration = 0

    try {
      for (let i = 0; i < textChunks.length; i++) {
        try {
          logger.info(`Converting chunk ${i + 1}/${textChunks.length}`)

          // Submit TTS request
          const requestId = await submitTtsRequest(apiClient, textChunks[i], config)

          // Poll for completion
          const audioUrl = await pollTtsStatus(apiClient, requestId)

          // Download audio
          const audioBuffer = await downloadAudio(audioUrl)

          // Save chunk to temporary file
          const chunkFilePath = path.join(
            path.dirname(outputPath),
            `chunk_${i}.mp3`
          )
          await writeFile(chunkFilePath, audioBuffer)
          chunkFilePaths.push(chunkFilePath)

          // Calculate duration
          const chunkDuration = calculateAudioDuration(audioBuffer)
          totalDuration += chunkDuration

          logger.info(`Chunk ${i + 1} converted: ${audioBuffer.length} bytes, ${chunkDuration}s`)
        } catch (error) {
          logger.error(`Failed to convert chunk ${i + 1}`, error)
          throw error
        }
      }

      // Concatenate all chunks using FFmpeg
      if (chunkFilePaths.length > 1) {
        logger.info(`Concatenating ${chunkFilePaths.length} chunks using FFmpeg`)
        await concatenateAudioFiles(chunkFilePaths, outputPath)
      } else if (chunkFilePaths.length === 1) {
        // Only one chunk, just rename it
        const fs = await import('fs/promises')
        await fs.rename(chunkFilePaths[0], outputPath)
      }

      // Get file size
      const fs = await import('fs/promises')
      const stats = await fs.stat(outputPath)

      logger.info(`Audio saved to ${outputPath} (${stats.size} bytes, ${totalDuration}s)`)

      return {
        path: outputPath,
        duration: totalDuration,
        sampleRate: 48000,
        channels: 1,
        format: 'mp3',
        fileSize: stats.size,
      }
    } finally {
      // Clean up temporary chunk files
      for (const chunkPath of chunkFilePaths) {
        await unlink(chunkPath).catch(() => {
          // Ignore errors
        })
      }
    }
  } catch (error) {
    logger.error('Failed to convert chunked text to speech', error)
    throw error
  }
}

// Estimate audio duration (MP3 file)
function calculateAudioDuration(buffer: Buffer): number {
  // Simplified calculation assuming 128kbps bitrate
  const bitrate = 128 * 1000 // bits per second
  const durationSeconds = (buffer.length * 8) / bitrate
  return Math.round(durationSeconds)
}

// Validate Vbee API connection
export async function validateVbeeConnection(): Promise<boolean> {
  if (!VBEE_API_KEY || !VBEE_APP_ID) {
    logger.error('VBEE_API_KEY and VBEE_APP_ID not configured')
    return false
  }

  try {
    const apiClient = initializeClient(VBEE_API_KEY)

    // Try a simple test request
    const testText = 'Test'
    const requestId = await submitTtsRequest(apiClient, testText, {
      apiKey: VBEE_API_KEY,
      appId: VBEE_APP_ID,
      voiceCode: 'n_hanoi_female_nguyetnga2_book_vc',
    })

    logger.info(`Vbee API connection successful (request: ${requestId})`)
    return true
  } catch (error) {
    logger.error('Vbee API connection failed', error)
    return false
  }
}

// Get list of available voices
export async function getAvailableVoices(): Promise<
  Array<{ code: string; name: string; language: string }>
> {
  // This would require a separate Vbee API endpoint for listing voices
  // For now, return Vietnamese voices (audiobook-optimized and general)
  return [
    {
      code: 'n_hanoi_female_nguyetnga2_book_vc',
      name: 'Nguyệt Nga (Nữ - Audiobook) ⭐',
      language: 'vi-VN',
    },
    {
      code: 'hn_female_ngochuyen_full_48k-fhg',
      name: 'Ngọc Huyền (Nữ)',
      language: 'vi-VN',
    },
    {
      code: 'hn_male_anh_full_48k-fhg',
      name: 'Anh (Nam)',
      language: 'vi-VN',
    },
  ]
}
