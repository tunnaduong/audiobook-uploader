/**
 * Complete Audiobook + Cooking Video Pipeline
 *
 * Orchestrates:
 * 1. Video composition (banner + looped cooking video + music)
 * 2. Thumbnail generation (Modern Oriental style)
 * 3. YouTube upload
 */

import path from 'path'
import { createLogger } from '../utils/logger'
import { composeBannerVideo } from './ffmpeg'
import { generateModernOrientalThumbnail } from './gemini'
import { uploadVideo } from './youtube'
import { convertTextToSpeech } from './vbee'
import type { YouTubeUploadResult } from '../types'

const logger = createLogger('pipeline-service')

export interface PipelineConfig {
  // Input files
  storyText: string
  storyTitle: string
  bannerImagePath: string         // video_banner.png
  cookingVideoPath: string        // Douyin video
  backgroundMusicPath: string     // bg-music.m4a
  avatarImagePath: string         // avatar.png for thumbnail style

  // Output paths
  outputVideoPath: string
  outputThumbnailPath: string

  // Optional settings
  videoDuration?: number          // Duration in seconds (default 60)
  uploadToYoutube?: boolean       // Whether to upload after generation
  youtubeAccessToken?: string     // OAuth token for YouTube
}

export interface PipelineResult {
  success: boolean
  videoPath?: string
  thumbnailPath?: string
  voiceoverPath?: string
  youtubeResult?: YouTubeUploadResult
  error?: string
  steps: PipelineStep[]
}

export interface PipelineStep {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number  // 0-100
  message: string
  error?: string
}

/**
 * Execute the complete audiobook + cooking video pipeline
 */
export async function executePipeline(
  config: PipelineConfig,
  onProgress?: (step: PipelineStep) => void
): Promise<PipelineResult> {
  const result: PipelineResult = {
    success: false,
    steps: [],
  }

  const steps: PipelineStep[] = [
    {
      name: 'Validate Input',
      status: 'pending',
      progress: 0,
      message: 'Checking input files...',
    },
    {
      name: 'Generate Audiobook Voiceover',
      status: 'pending',
      progress: 0,
      message: 'Converting story text to audiobook voice via Vbee...',
    },
    {
      name: 'Compose Video',
      status: 'pending',
      progress: 0,
      message: 'Composing banner + cooking video + audiobook voice...',
    },
    {
      name: 'Generate Thumbnail',
      status: 'pending',
      progress: 0,
      message: 'Generating Modern Oriental thumbnail...',
    },
    {
      name: 'Upload to YouTube',
      status: 'pending',
      progress: 0,
      message: 'Uploading to YouTube...',
    },
  ]

  try {
    logger.info('Starting audiobook pipeline')
    logger.info(`Story: "${config.storyTitle}"`)

    // Step 1: Validate inputs
    logger.info('Step 1: Validating inputs')
    steps[0].status = 'in_progress'
    steps[0].progress = 10
    onProgress?.(steps[0])

    validateConfig(config)

    steps[0].status = 'completed'
    steps[0].progress = 100
    steps[0].message = 'Input validation successful'
    onProgress?.(steps[0])

    // Step 2: Generate audiobook voiceover with Vbee
    logger.info('Step 2: Generating audiobook voiceover')
    steps[1].status = 'in_progress'
    steps[1].progress = 10
    onProgress?.(steps[1])

    const voiceoverPath = path.join(path.dirname(config.outputVideoPath), 'voiceover.mp3')
    logger.info(`Converting story text to speech: "${config.storyTitle}"`)

    const audioResult = await convertTextToSpeech(
      config.storyText,
      voiceoverPath
    )

    steps[1].status = 'completed'
    steps[1].progress = 100
    steps[1].message = `Audiobook voiceover generated: ${path.basename(audioResult.path)} (${audioResult.duration}s)`
    onProgress?.(steps[1])

    result.voiceoverPath = audioResult.path
    logger.info(`Voiceover created: ${audioResult.path}`)

    // Step 3: Compose video with voiceover
    logger.info('Step 3: Composing video with voiceover')
    steps[2].status = 'in_progress'
    steps[2].progress = 10
    onProgress?.(steps[2])

    // Use the actual TTS duration instead of config default (ensure video duration matches audio)
    const videoDuration = audioResult.duration || config.videoDuration || 60
    logger.info(`Composing video with duration: ${videoDuration}s (based on TTS voiceover duration)`)

    const videoResult = await composeBannerVideo(
      config.bannerImagePath,
      config.cookingVideoPath,
      audioResult.path,  // Use voiceover instead of background music
      config.outputVideoPath,
      videoDuration,
      true  // isVoiceover = true (don't apply volume reduction)
    )

    steps[2].status = 'completed'
    steps[2].progress = 100
    steps[2].message = `Video composition completed: ${path.basename(videoResult.path)}`
    onProgress?.(steps[2])

    result.videoPath = videoResult.path
    logger.info(`Video created: ${videoResult.path}`)

    // Step 4: Generate thumbnail
    logger.info('Step 4: Generating thumbnail')
    steps[3].status = 'in_progress'
    steps[3].progress = 10
    onProgress?.(steps[3])

    logger.info(`Generating thumbnail for: "${config.storyTitle}"`)

    const thumbnailResult = await generateModernOrientalThumbnail(
      config.avatarImagePath,
      config.storyTitle,
      config.outputThumbnailPath
    )

    steps[3].status = 'completed'
    steps[3].progress = 100
    steps[3].message = `Thumbnail generated: ${path.basename(thumbnailResult.path)}`
    onProgress?.(steps[3])

    result.thumbnailPath = thumbnailResult.path
    logger.info(`Thumbnail created: ${thumbnailResult.path}`)

    // Step 5: Upload to YouTube (optional)
    if (config.uploadToYoutube && config.youtubeAccessToken) {
      logger.info('Step 5: Uploading to YouTube')
      steps[4].status = 'in_progress'
      steps[4].progress = 10
      onProgress?.(steps[4])

      logger.info('Preparing YouTube upload...')

      try {
        const youtubeResult = await uploadVideo(
          result.videoPath!,
          {
            title: config.storyTitle,
            description: `Audiobook with Cooking Video\n\n${config.storyText}`,
            tags: ['audiobook', 'cooking', 'story', 'vietnam'],
            visibility: 'public',
          },
          config.youtubeAccessToken
        )

        steps[4].status = 'completed'
        steps[4].progress = 100
        steps[4].message = `Video uploaded: ${youtubeResult.videoId}`
        onProgress?.(steps[4])

        result.youtubeResult = youtubeResult
        logger.info(`YouTube upload completed: ${youtubeResult.videoId}`)
      } catch (error) {
        logger.error('YouTube upload failed', error)
        steps[4].status = 'failed'
        steps[4].progress = 100
        steps[4].error = error instanceof Error ? error.message : 'Unknown error - YouTube Upload'
        onProgress?.(steps[4])
        // Don't fail the entire pipeline if YouTube upload fails
      }
    } else {
      logger.info('YouTube upload skipped (not configured)')
      steps[4].status = 'completed'
      steps[4].progress = 100
      steps[4].message = 'YouTube upload skipped'
      onProgress?.(steps[4])
    }

    // Mark all completed steps
    result.steps = steps
    result.success = true

    logger.info('✅ Pipeline completed successfully')
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('❌ Pipeline failed', errorMessage)
    console.error('Pipeline execution error:', error)

    const failedStepIndex = steps.findIndex(s => s.status === 'in_progress')
    if (failedStepIndex >= 0) {
      steps[failedStepIndex].status = 'failed'
      steps[failedStepIndex].progress = 100
      steps[failedStepIndex].error = errorMessage
    }

    result.steps = steps
    result.success = false
    result.error = errorMessage

    return result
  }
}

/**
 * Validate pipeline configuration
 */
function validateConfig(config: PipelineConfig): void {
  if (!config.storyText?.trim()) {
    throw new Error('Story text is required')
  }

  if (!config.storyTitle?.trim()) {
    throw new Error('Story title is required')
  }

  if (!config.bannerImagePath) {
    throw new Error('Banner image path is required')
  }

  if (!config.cookingVideoPath) {
    throw new Error('Cooking video path is required')
  }

  if (!config.backgroundMusicPath) {
    throw new Error('Background music path is required')
  }

  if (!config.avatarImagePath) {
    throw new Error('Avatar image path is required')
  }

  if (!config.outputVideoPath) {
    throw new Error('Output video path is required')
  }

  if (!config.outputThumbnailPath) {
    throw new Error('Output thumbnail path is required')
  }

  logger.debug('Configuration validation passed')
}

/**
 * Get pipeline status/progress
 */
export function getPipelineStatus(steps: PipelineStep[]): {
  overallProgress: number
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  currentStep?: PipelineStep
} {
  const completedSteps = steps.filter(s => s.status === 'completed').length
  const failedSteps = steps.filter(s => s.status === 'failed').length
  const inProgressSteps = steps.filter(s => s.status === 'in_progress')

  const overallProgress = Math.round((completedSteps / steps.length) * 100)

  let status: 'pending' | 'in_progress' | 'completed' | 'failed' = 'pending'
  if (failedSteps > 0) {
    status = 'failed'
  } else if (completedSteps === steps.length) {
    status = 'completed'
  } else if (inProgressSteps.length > 0) {
    status = 'in_progress'
  }

  return {
    overallProgress,
    status,
    currentStep: inProgressSteps[0],
  }
}
