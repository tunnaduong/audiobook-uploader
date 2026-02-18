import axios, { AxiosInstance } from 'axios'
import { writeFile } from 'fs/promises'
import https from 'https'
import { createLogger } from '../utils/logger'
import type { AudioFile } from '../types'

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
      timeout: 30000,
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
  maxAttempts: number = 60,
  delayMs: number = 1000
): Promise<string> {
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      logger.debug(`Polling TTS status: ${requestId} (attempt ${attempts + 1}/${maxAttempts})`)

      const response = await client.get(`/${requestId}`)

      if (response.data.status !== 1) {
        throw new Error(`Vbee API error: ${response.data.error_message || 'Unknown error - Vbee Poll'}`)
      }

      const result = response.data.result

      if (result.status === 'SUCCESS') {
        logger.info(`TTS conversion completed: ${requestId}`)
        return result.audio_link
      }

      if (result.status === 'FAILURE') {
        throw new Error(`TTS conversion failed for request ${requestId}`)
      }

      // IN_PROGRESS - wait and retry
      logger.debug(`TTS conversion in progress (${result.progress}%)`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      attempts++
    } catch (error) {
      if (attempts < maxAttempts - 1) {
        logger.warn(`Error polling status, retrying...`, error)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        attempts++
      } else {
        logger.error('Failed to get TTS status after max attempts', error)
        throw error
      }
    }
  }

  throw new Error(`TTS conversion timeout for request ${requestId}`)
}

// Download audio from URL
async function downloadAudio(audioUrl: string): Promise<Buffer> {
  try {
    logger.debug(`Downloading audio from: ${audioUrl}`)

    const response = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    })

    return Buffer.from(response.data)
  } catch (error) {
    logger.error('Failed to download audio', error)
    throw error
  }
}

// Concatenate multiple audio buffers (use FFmpeg in production)
function concatenateAudioBuffers(buffers: Buffer[]): Buffer {
  // For MP3 files, simple concatenation may not work perfectly
  // In production, use FFmpeg to properly concatenate audio files
  logger.warn('Using simple buffer concatenation - consider using FFmpeg for better results')
  return Buffer.concat(buffers)
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

    // For now, handle as single request (implement chunking if text is very long)
    // Vbee has character limits, so we should chunk large texts
    const chunks = splitTextIntoChunks(text, 2000)
    logger.info(`Split text into ${chunks.length} chunk(s)`)

    const audioBuffers: Buffer[] = []

    for (const chunk of chunks) {
      try {
        logger.info(`Converting chunk ${chunk.index + 1}/${chunks.length}`)

        // Submit TTS request
        const requestId = await submitTtsRequest(apiClient, chunk.text, config)

        // Poll for completion
        const audioUrl = await pollTtsStatus(apiClient, requestId)

        // Download audio
        const audioBuffer = await downloadAudio(audioUrl)
        audioBuffers.push(audioBuffer)

        logger.info(`Chunk ${chunk.index + 1} converted successfully (${audioBuffer.length} bytes)`)
      } catch (error) {
        logger.error(`Failed to convert chunk ${chunk.index + 1}`, error)
        throw error
      }
    }

    // Concatenate all audio
    const finalAudio = concatenateAudioBuffers(audioBuffers)

    // Save to file
    await writeFile(outputPath, finalAudio)
    logger.info(`Audio saved to ${outputPath} (${finalAudio.length} bytes)`)

    return {
      path: outputPath,
      duration: calculateAudioDuration(finalAudio),
      sampleRate: 48000, // Vbee default for hn_female voices
      channels: 1,
      format: 'mp3',
      fileSize: finalAudio.length,
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
    const audioBuffers: Buffer[] = []

    for (let i = 0; i < textChunks.length; i++) {
      try {
        logger.info(`Converting chunk ${i + 1}/${textChunks.length}`)

        // Submit TTS request
        const requestId = await submitTtsRequest(apiClient, textChunks[i], config)

        // Poll for completion
        const audioUrl = await pollTtsStatus(apiClient, requestId)

        // Download audio
        const audioBuffer = await downloadAudio(audioUrl)
        audioBuffers.push(audioBuffer)

        logger.info(`Chunk ${i + 1} converted successfully (${audioBuffer.length} bytes)`)
      } catch (error) {
        logger.error(`Failed to convert chunk ${i + 1}`, error)
        throw error
      }
    }

    // Concatenate all audio
    const finalAudio = concatenateAudioBuffers(audioBuffers)

    // Save to file
    await writeFile(outputPath, finalAudio)
    logger.info(`Audio saved to ${outputPath} (${finalAudio.length} bytes)`)

    return {
      path: outputPath,
      duration: calculateAudioDuration(finalAudio),
      sampleRate: 48000,
      channels: 1,
      format: 'mp3',
      fileSize: finalAudio.length,
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
      name: 'Nguyễt Nga (Nữ - Audiobook) ⭐',
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
