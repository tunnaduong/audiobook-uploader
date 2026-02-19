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
import { getAudioDurationInSeconds } from 'get-audio-duration'
import { createLogger } from '../utils/logger'
import { composeBannerVideo, getVideoInfo, mixVoiceoverWithMusic } from './ffmpeg'
import { generateModernOrientalThumbnail } from './gemini'
import { uploadVideo } from './youtube'
import { convertTextToSpeech } from './vbee'
import { downloadDouyinVideo, isValidDouyinUrl } from './douyin'
import { createProject, updateProjectStatus, saveConversionInfo, saveOutputInfo } from '../utils/database'
import type { YouTubeUploadResult } from '../types'

const logger = createLogger('pipeline-service')

/**
 * Get audio duration safely with error handling
 */
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    if (!fs.existsSync(filePath)) {
      logger.warn(`Audio file not found: ${filePath}`)
      return 0
    }
    const duration = await getAudioDurationInSeconds(filePath)
    return Math.round(duration)
  } catch (error) {
    logger.warn(`Could not get audio duration for ${filePath}: ${error}`)
    return 0
  }
}

export interface PipelineConfig {
  // Input files
  storyText: string
  storyTitle: string
  bannerImagePath: string         // video_banner.png
  cookingVideoPath: string        // Douyin video OR URL
  backgroundMusicPath: string     // bg-music.m4a
  avatarImagePath: string         // avatar.png for thumbnail style
  referenceImagePath?: string     // Optional: Story cover/reference image for thumbnail visual style

  // Output paths
  outputVideoPath: string
  outputThumbnailPath: string

  // Optional settings
  videoDuration?: number          // Duration in seconds (default 60)
  uploadToYoutube?: boolean       // Whether to upload after generation
  youtubeAccessToken?: string     // OAuth token for YouTube
  douyinUrl?: string              // Optional: Download Douyin video if provided
  resumeOnExist?: boolean         // Skip steps if intermediate files exist (mixed_audio, voiceover, final_video)
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

  // Create project in database at the start
  let projectId: number | null = null
  try {
    projectId = await createProject(config.storyTitle, config.storyText)
    logger.info(`📝 Created project in database: ID ${projectId}`)
    await updateProjectStatus(projectId, 'processing', 0)
  } catch (dbError) {
    logger.warn(`⚠️ Failed to create project in database: ${dbError}`)
    // Continue pipeline even if database fails
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
    const cookingVideoOutputPath = path.join(outputDir, 'final_video.mp4')

    // Check if final_video.mp4 already exists - if so, skip Douyin download
    if (config.resumeOnExist && fs.existsSync(cookingVideoOutputPath)) {
      logger.info('📹 Final video already exists - skipping Douyin download')
      finalCookingVideoPath = cookingVideoOutputPath
      steps[1].status = 'completed'
      steps[1].progress = 100
      steps[1].message = 'Douyin download skipped (final_video.mp4 exists)'
    } else if (config.douyinUrl !== undefined && isValidDouyinUrl(config.douyinUrl)) {
      try {
        logger.info(`🎬 Douyin URL detected: ${config.douyinUrl}`)
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
    let audioResult: any

    // Check if voiceover.mp3 already exists - if so, skip Vbee TTS
    if (config.resumeOnExist && fs.existsSync(voiceoverPath)) {
      logger.info('🎤 Voiceover already exists - skipping Vbee TTS')
      // Get duration from existing file
      const voiceoverDuration = await getAudioDuration(voiceoverPath)
      audioResult = { path: voiceoverPath, duration: voiceoverDuration }
      steps[2].status = 'completed'
      steps[2].progress = 100
      steps[2].message = `Vbee TTS skipped (voiceover.mp3 exists - ${voiceoverDuration}s)`
    } else {
      logger.info(`Converting story text to speech: "${config.storyTitle}"`)
      audioResult = await convertTextToSpeech(
        config.storyText,
        voiceoverPath
      )
      steps[2].status = 'completed'
      steps[2].progress = 100
      steps[2].message = `Audiobook voiceover generated: ${path.basename(audioResult.path)} (${audioResult.duration}s)`
    }
    onProgress?.(steps[2])

    result.voiceoverPath = audioResult.path
    logger.info(`Voiceover: ${audioResult.path}`)

    // Step 4: Mix voiceover with background music (if music file exists)
    logger.info('Step 4: Mixing audio')
    steps[3].status = 'in_progress'
    steps[3].progress = 10
    onProgress?.(steps[3])

    let finalAudioPath = audioResult.path
    let finalAudioDuration = audioResult.duration // Start with voiceover duration
    const mixedAudioPath = path.join(path.dirname(config.outputVideoPath), 'mixed_audio.m4a')

    // Check if mixed_audio.m4a already exists - if so, skip mixing
    if (config.resumeOnExist && fs.existsSync(mixedAudioPath)) {
      logger.info('🎵 Mixed audio already exists - skipping audio mixing')
      finalAudioPath = mixedAudioPath
      // Get the actual duration of the existing mixed audio
      finalAudioDuration = await getAudioDuration(mixedAudioPath)
      steps[3].status = 'completed'
      steps[3].progress = 100
      steps[3].message = `Audio mixing skipped (mixed_audio.m4a exists - ${finalAudioDuration}s)`
    } else if (fs.existsSync(config.backgroundMusicPath)) {
      try {
        logger.info(`🎵 Mixing voiceover with background music`)

        await mixVoiceoverWithMusic(
          audioResult.path,           // Voiceover at 100%
          config.backgroundMusicPath, // Background music at 50%
          mixedAudioPath
        )

        finalAudioPath = mixedAudioPath
        // Get duration of newly mixed audio
        finalAudioDuration = await getAudioDuration(mixedAudioPath)
        steps[3].status = 'completed'
        steps[3].progress = 100
        steps[3].message = `Audio mixing completed: voiceover (100%) + music (50%) - ${finalAudioDuration}s`
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

    // Get cooking video duration to check if audio is longer
    const cookingVideoInfo = await getVideoInfo(finalCookingVideoPath)
    // Use the actual final audio duration (either mixed audio or voiceover)
    const videoDuration = finalAudioDuration || config.videoDuration || 60

    logger.info(
      `Cooking video duration: ${cookingVideoInfo.duration}s, Audio duration: ${videoDuration}s`
    )

    // If audio is longer than cooking video, warn user
    if (videoDuration > cookingVideoInfo.duration) {
      logger.warn(
        `⚠️ Audio (${videoDuration}s) is longer than cooking video (${cookingVideoInfo.duration}s). ` +
        `Cooking video will be looped ${Math.ceil(videoDuration / cookingVideoInfo.duration)}x. ` +
        `For best results, use a cooking video at least ${videoDuration}s long.`
      )
    }

    logger.info(`Composing video with duration: ${videoDuration}s (based on final audio duration)`)

    const videoResult = await composeBannerVideo(
      config.bannerImagePath,
      finalCookingVideoPath,
      finalAudioPath,  // Use mixed audio (or voiceover-only if no music)
      config.outputVideoPath,
      videoDuration,   // Use actual final audio duration
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
    steps[4].message = `Video composition completed: ${path.basename(videoResult.path)} (${videoDuration}s)`
    onProgress?.(steps[4])

    result.videoPath = videoResult.path
    logger.info(`Video created: ${videoResult.path}`)

    // Step 6: Generate thumbnail
    logger.info('Step 6: Generating thumbnail')
    steps[5].status = 'in_progress'
    steps[5].progress = 10
    onProgress?.(steps[5])

    logger.info(`Generating thumbnail for: "${config.storyTitle}"`)

    // Check if there's a previous video's thumbnail to use as reference
    // This helps maintain visual consistency for multi-chapter stories
    let thumbnailReference = config.referenceImagePath

    // Extract the parent directory and look for previous video folder
    const thumbnailDir = path.dirname(config.outputThumbnailPath)
    const videosParentDir = path.dirname(thumbnailDir)

    // Try to find previous video folder (vid_N-1, vid_N-2, etc.)
    try {
      if (fs.existsSync(videosParentDir)) {
        const folders = fs.readdirSync(videosParentDir)
          .filter(f => f.match(/^vid_\d+$/))
          .sort((a, b) => {
            const numA = parseInt(a.replace('vid_', ''))
            const numB = parseInt(b.replace('vid_', ''))
            return numB - numA // Descending order
          })

        // Check if there's a previous folder with a thumbnail
        if (folders.length > 1) {
          const previousFolder = folders[1] // Second most recent folder
          const previousThumbnailPath = path.join(videosParentDir, previousFolder, 'thumbnail.jpg')

          if (fs.existsSync(previousThumbnailPath)) {
            logger.info(`📖 Previous thumbnail found in ${previousFolder} - using as reference for consistency`)
            thumbnailReference = previousThumbnailPath
          }
        }
      }
    } catch (error) {
      logger.warn(`Could not find previous thumbnail for reference: ${error}`)
    }

    const thumbnailResult = await generateModernOrientalThumbnail(
      config.avatarImagePath,
      config.storyTitle,
      config.outputThumbnailPath,
      thumbnailReference
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

    // Save results to database
    if (projectId) {
      try {
        // Save voiceover info with actual duration
        if (result.voiceoverPath) {
          const voiceoverDuration = await getAudioDuration(result.voiceoverPath)
          await saveConversionInfo(projectId, result.voiceoverPath, voiceoverDuration)
          logger.info(`💾 Saved voiceover: ${voiceoverDuration}s`)
        }

        // Save output video and thumbnail info with actual duration
        if (result.videoPath) {
          const videoDuration = await getAudioDuration(result.videoPath)
          await saveOutputInfo(projectId, result.videoPath, result.thumbnailPath, undefined, videoDuration)
          logger.info(`💾 Saved video output: ${videoDuration}s`)
        }

        // Update project status to completed
        await updateProjectStatus(projectId, 'completed', 100)
        logger.info(`✅ Project ${projectId} saved to database`)
      } catch (dbError) {
        logger.warn(`⚠️ Failed to save project results to database: ${dbError}`)
        // Continue even if database save fails
      }
    }

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

    // Update project status to failed in database
    if (projectId) {
      try {
        await updateProjectStatus(projectId, 'failed', 0, errorMessage)
        logger.info(`❌ Project ${projectId} marked as failed in database`)
      } catch (dbError) {
        logger.warn(`⚠️ Failed to update project status in database: ${dbError}`)
      }
    }

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
