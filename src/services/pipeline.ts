/**
 * Complete Audiobook + Cooking Video Pipeline
 *
 * Orchestrates:
 * 1. Video composition (banner + looped cooking video + music)
 * 2. Thumbnail generation (Modern Oriental style)
 * 3. YouTube upload
 */

import path from 'path'
import fs from 'fs'
import { createLogger } from '../utils/logger'
import { composeBannerVideo, getVideoInfo, mixVoiceoverWithMusic } from './ffmpeg'
import { generateModernOrientalThumbnail } from './gemini'
import { uploadVideo } from './youtube'
import { convertTextToSpeech } from './vbee'
import { downloadDouyinVideo, isValidDouyinUrl } from './douyin'
import type { YouTubeUploadResult } from '../types'

const logger = createLogger('pipeline-service')

export interface PipelineConfig {
  // Input files
  storyText: string
  storyTitle: string
  bannerImagePath: string         // video_banner.png
  cookingVideoPath: string        // Douyin video OR URL
  backgroundMusicPath: string     // bg-music.m4a
  avatarImagePath: string         // avatar.png for thumbnail style

  // Output paths
  outputVideoPath: string
  outputThumbnailPath: string

  // Optional settings
  videoDuration?: number          // Duration in seconds (default 60)
  uploadToYoutube?: boolean       // Whether to upload after generation
  youtubeAccessToken?: string     // OAuth token for YouTube
  douyinUrl?: string              // Optional: Download Douyin video if provided
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
      name: 'Download Douyin Video',
      status: 'pending',
      progress: 0,
      message: 'Downloading Douyin video if URL provided...',
    },
    {
      name: 'Generate Audiobook Voiceover',
      status: 'pending',
      progress: 0,
      message: 'Converting story text to audiobook voice via Vbee...',
    },
    {
      name: 'Mix Audio',
      status: 'pending',
      progress: 0,
      message: 'Mixing voiceover (100%) with background music (50%)...',
    },
    {
      name: 'Compose Video',
      status: 'pending',
      progress: 0,
      message: 'Composing banner + cooking video + mixed audio...',
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

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(config.outputVideoPath)
    if (!fs.existsSync(outputDir)) {
      logger.info(`📁 Creating output directory: ${outputDir}`)
      fs.mkdirSync(outputDir, { recursive: true })
      logger.info(`✅ Output directory created: ${outputDir}`)
    }

    steps[0].status = 'completed'
    steps[0].progress = 100
    steps[0].message = 'Input validation successful'
    onProgress?.(steps[0])

    // Step 2: Download Douyin video if URL provided
    logger.info('Step 2: Downloading Douyin video')
    steps[1].status = 'in_progress'
    steps[1].progress = 10
    onProgress?.(steps[1])

    let finalCookingVideoPath: string = config.cookingVideoPath

    if (config.douyinUrl !== undefined && isValidDouyinUrl(config.douyinUrl)) {
      try {
        logger.info(`🎬 Douyin URL detected: ${config.douyinUrl}`)
        const outputDir = path.dirname(config.outputVideoPath)
        const downloadedVideo = await downloadDouyinVideo(config.douyinUrl, {
          outputPath: outputDir,
        })
        finalCookingVideoPath = downloadedVideo.localPath!
        steps[1].status = 'completed'
        steps[1].progress = 100
        steps[1].message = `Douyin video downloaded: ${path.basename(finalCookingVideoPath)} (${downloadedVideo.duration}s)`
        logger.info(`✅ Using downloaded Douyin video: ${finalCookingVideoPath}`)
      } catch (error) {
        logger.warn(`⚠️ Douyin download failed, using fallback video: ${finalCookingVideoPath}`)
        steps[1].status = 'completed'
        steps[1].progress = 100
        steps[1].message = 'Douyin download skipped, using default video'
      }
    } else {
      steps[1].status = 'completed'
      steps[1].progress = 100
      steps[1].message = 'No Douyin URL provided, using default video'
    }
    onProgress?.(steps[1])

    // Step 3: Generate audiobook voiceover with Vbee
    logger.info('Step 3: Generating audiobook voiceover')
    steps[2].status = 'in_progress'
    steps[2].progress = 10
    onProgress?.(steps[2])

    const voiceoverPath = path.join(path.dirname(config.outputVideoPath), 'voiceover.mp3')
    logger.info(`Converting story text to speech: "${config.storyTitle}"`)

    const audioResult = await convertTextToSpeech(
      config.storyText,
      voiceoverPath
    )

    steps[2].status = 'completed'
    steps[2].progress = 100
    steps[2].message = `Audiobook voiceover generated: ${path.basename(audioResult.path)} (${audioResult.duration}s)`
    onProgress?.(steps[2])

    result.voiceoverPath = audioResult.path
    logger.info(`Voiceover created: ${audioResult.path}`)

    // Step 4: Mix voiceover with background music (if music file exists)
    logger.info('Step 4: Mixing audio')
    steps[3].status = 'in_progress'
    steps[3].progress = 10
    onProgress?.(steps[3])

    let finalAudioPath = audioResult.path

    if (fs.existsSync(config.backgroundMusicPath)) {
      try {
        const mixedAudioPath = path.join(path.dirname(config.outputVideoPath), 'mixed_audio.m4a')
        logger.info(`🎵 Mixing voiceover with background music`)

        await mixVoiceoverWithMusic(
          audioResult.path,           // Voiceover at 100%
          config.backgroundMusicPath, // Background music at 50%
          mixedAudioPath
        )

        finalAudioPath = mixedAudioPath
        steps[3].status = 'completed'
        steps[3].progress = 100
        steps[3].message = 'Audio mixing completed: voiceover (100%) + music (50%)'
        logger.info(`✅ Audio mixing completed: ${mixedAudioPath}`)
      } catch (error) {
        logger.warn(`⚠️ Audio mixing failed: ${error}. Using voiceover only.`)
        steps[3].status = 'completed'
        steps[3].progress = 100
        steps[3].message = 'Audio mixing failed, using voiceover only'
      }
    } else {
      logger.info(`No background music found at ${config.backgroundMusicPath}, using voiceover only`)
      steps[3].status = 'completed'
      steps[3].progress = 100
      steps[3].message = 'No background music provided, using voiceover only'
    }
    onProgress?.(steps[3])

    // Step 5: Compose video with mixed audio
    logger.info('Step 5: Composing video with mixed audio')
    steps[4].status = 'in_progress'
    steps[4].progress = 10
    onProgress?.(steps[4])

    // Get cooking video duration to check if voiceover is longer
    const cookingVideoInfo = await getVideoInfo(finalCookingVideoPath)
    const voiceoverDuration = audioResult.duration || config.videoDuration || 60

    logger.info(
      `Cooking video duration: ${cookingVideoInfo.duration}s, Voiceover duration: ${voiceoverDuration}s`
    )

    // If voiceover is longer than cooking video, warn user
    if (voiceoverDuration > cookingVideoInfo.duration) {
      logger.warn(
        `⚠️ Voiceover (${voiceoverDuration}s) is longer than cooking video (${cookingVideoInfo.duration}s). ` +
        `Cooking video will be looped ${Math.ceil(voiceoverDuration / cookingVideoInfo.duration)}x. ` +
        `For best results, use a cooking video at least ${voiceoverDuration}s long.`
      )
    }

    logger.info(`Composing video with duration: ${voiceoverDuration}s (based on audio duration)`)

    const videoResult = await composeBannerVideo(
      config.bannerImagePath,
      finalCookingVideoPath,
      finalAudioPath,  // Use mixed audio (or voiceover-only if no music)
      config.outputVideoPath,
      voiceoverDuration,
      true,  // isVoiceover = true (since we're providing pre-mixed audio, not background music)
      (message: string, progress: number) => {
        // Update compose video step with FFmpeg progress
        steps[4].progress = Math.round(progress)
        steps[4].message = message
        onProgress?.(steps[4])
      }
    )

    steps[4].status = 'completed'
    steps[4].progress = 100
    steps[4].message = `Video composition completed: ${path.basename(videoResult.path)} (${voiceoverDuration}s)`
    onProgress?.(steps[4])

    result.videoPath = videoResult.path
    logger.info(`Video created: ${videoResult.path}`)

    // Step 6: Generate thumbnail
    logger.info('Step 6: Generating thumbnail')
    steps[5].status = 'in_progress'
    steps[5].progress = 10
    onProgress?.(steps[5])

    logger.info(`Generating thumbnail for: "${config.storyTitle}"`)

    const thumbnailResult = await generateModernOrientalThumbnail(
      config.avatarImagePath,
      config.storyTitle,
      config.outputThumbnailPath
    )

    steps[5].status = 'completed'
    steps[5].progress = 100
    steps[5].message = `Thumbnail generated: ${path.basename(thumbnailResult.path)}`
    onProgress?.(steps[5])

    result.thumbnailPath = thumbnailResult.path
    logger.info(`Thumbnail created: ${thumbnailResult.path}`)

    // Step 7: Upload to YouTube (optional)
    if (config.uploadToYoutube && config.youtubeAccessToken) {
      logger.info('Step 7: Uploading to YouTube')
      steps[6].status = 'in_progress'
      steps[6].progress = 10
      onProgress?.(steps[6])

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

        steps[6].status = 'completed'
        steps[6].progress = 100
        steps[6].message = `Video uploaded: ${youtubeResult.videoId}`
        onProgress?.(steps[6])

        result.youtubeResult = youtubeResult
        logger.info(`YouTube upload completed: ${youtubeResult.videoId}`)
      } catch (error) {
        logger.error('YouTube upload failed', error)
        steps[6].status = 'failed'
        steps[6].progress = 100
        steps[6].error = error instanceof Error ? error.message : 'Unknown error - YouTube Upload'
        onProgress?.(steps[6])
        // Don't fail the entire pipeline if YouTube upload fails
      }
    } else {
      logger.info('YouTube upload skipped (not configured)')
      steps[6].status = 'completed'
      steps[6].progress = 100
      steps[6].message = 'YouTube upload skipped'
      onProgress?.(steps[6])
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
