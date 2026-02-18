import { exec } from 'child_process'
import { promisify } from 'util'
import { createLogger } from '../utils/logger'
import { getFFmpegPath } from '../utils/ffmpeg-setup'
import type { CompositionOptions, OutputVideo } from '../types'

const execAsync = promisify(exec)
const logger = createLogger('ffmpeg-service')

interface FilterGraphOptions {
  mirrorVideo?: boolean
  speedVariation?: number
  brightness?: number
  contrast?: number
}

// Build FFmpeg filter graph for video processing
function buildFilterGraph(
  _backgroundWidth: number,
  _backgroundHeight: number,
  _videoWidth: number,
  _videoHeight: number,
  options: FilterGraphOptions = {}
): string {

  // Input 1: Background (usually 1920x1080)
  // Input 2: Cooking video (needs scaling to fit)
  // Input 3: Audio track

  // Scale cooking video to fit center area (540x960)
  let videoFilter = `[1:v]scale=540:960`

  // Apply transformations if specified
  if (options.mirrorVideo) {
    videoFilter += ',hflip'
  }

  if (options.speedVariation && options.speedVariation !== 1.0) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const speedVar = options.speedVariation
    videoFilter += `,setpts=PTS/${speedVar}`
  }

  if (options.brightness !== undefined || options.contrast !== undefined) {
    const brightness = options.brightness ?? 0
    const contrast = options.contrast ?? 0
    videoFilter += `,eq=brightness=${brightness / 100}:contrast=${1 + contrast / 100}`
  }

  // Position video in center (x=690 for 1920 width, y=60)
  // (1920-540)/2 = 690
  const filterGraph = [
    videoFilter + '[scaled]',
    '[0:v][scaled]overlay=690:60:enable=\'gte(t,0)\'[with_video]',
    '[with_video]fps=30[video_out]',
  ].join(';')

  return filterGraph
}

// Get optimal FFmpeg encoder based on platform
async function getVideoEncoder(): Promise<{ codec: string; options: string[] }> {
  const platform = process.platform

  if (platform === 'darwin') {
    // macOS - use hardware encoding
    return {
      codec: 'h264_videotoolbox',
      options: ['-q:v', '4'],
    }
  } else if (platform === 'win32') {
    // Windows - try Intel Quick Sync first, fallback to libx264
    try {
      const ffmpegPath = await getFFmpegPath()
      const { stdout } = await execAsync(`"${ffmpegPath}" -encoders 2>&1 | findstr h264_qsv`)
      if (stdout.includes('h264_qsv')) {
        return {
          codec: 'h264_qsv',
          options: ['-q:v', '4'],
        }
      }
    } catch {
      logger.debug('Intel Quick Sync not available, using libx264')
    }
    return {
      codec: 'libx264',
      options: ['-preset', 'fast', '-crf', '23'],
    }
  } else {
    // Linux
    return {
      codec: 'libx264',
      options: ['-preset', 'fast', '-crf', '23'],
    }
  }
}

export async function composeVideo(
  backgroundPath: string,
  videoPath: string,
  audioPath: string,
  outputPath: string,
  options: CompositionOptions = { resolution: '1920x1080', backgroundPath: '' }
): Promise<OutputVideo> {
  try {
    logger.info('Starting video composition')

    const ffmpegPath = await getFFmpegPath()
    const encoder = await getVideoEncoder()

    // Build filter graph
    const filterGraph = buildFilterGraph(1920, 1080, 540, 960, {
      mirrorVideo: options.mirrorVideo,
      speedVariation: options.speedVariation,
      brightness: options.brightness,
      contrast: options.contrast,
    })

    // Build FFmpeg command
    const command = [
      `"${ffmpegPath}"`,
      '-i', `"${backgroundPath}"`,
      '-i', `"${videoPath}"`,
      '-i', `"${audioPath}"`,
      '-filter_complex', `"${filterGraph}"`,
      '-map', '[video_out]',
      '-map', '2:a:0',
      '-c:v', encoder.codec,
      ...encoder.options,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-y',
      `"${outputPath}"`,
    ].join(' ')

    logger.debug(`Executing FFmpeg: ${command}`)

    // Execute FFmpeg
    const { stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 600000, // 10 minutes
    })

    if (stderr) {
      logger.debug(`FFmpeg output: ${stderr}`)
    }

    logger.info(`Video composition completed: ${outputPath}`)

    return {
      path: outputPath,
      width: 1920,
      height: 1080,
      duration: 0, // Would need to extract from video info
      fileSize: 0, // Would need to get actual file size
      bitrate: '5000k',
      codec: encoder.codec,
      createdAt: new Date(),
    }
  } catch (error) {
    logger.error('Failed to compose video', error)
    throw error
  }
}

// Concatenate multiple video files
export async function concatenateVideos(
  videoPaths: string[],
  outputPath: string
): Promise<OutputVideo> {
  try {
    logger.info(`Concatenating ${videoPaths.length} video files`)

    const ffmpegPath = await getFFmpegPath()

    // Build command for concatenation
    const command = [
      `"${ffmpegPath}"`,
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat.txt',
      '-c', 'copy',
      '-y',
      `"${outputPath}"`,
    ].join(' ')

    logger.debug(`Executing FFmpeg concat: ${command}`)

    const { stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 600000,
    })

    if (stderr) {
      logger.debug(`FFmpeg output: ${stderr}`)
    }

    logger.info(`Video concatenation completed: ${outputPath}`)

    return {
      path: outputPath,
      width: 0,
      height: 0,
      duration: 0,
      fileSize: 0,
      bitrate: '0',
      codec: 'h264',
      createdAt: new Date(),
    }
  } catch (error) {
    logger.error('Failed to concatenate videos', error)
    throw error
  }
}

// Extract video information
export async function getVideoInfo(
  videoPath: string
): Promise<{
  duration: number
  width: number
  height: number
  bitrate: number
  frameRate: number
}> {
  try {
    // Use ffprobe to get video information (not ffmpeg)
    // ffprobe is included with FFmpeg installation
    const ffprobePath = (await getFFmpegPath()).replace(/ffmpeg(\.exe)?$/, 'ffprobe$1')
    const command = `"${ffprobePath}" -v error -select_streams v:0 -show_entries stream=duration,width,height,bit_rate,r_frame_rate -of default=noprint_wrappers=1 "${videoPath}"`

    const { stdout } = await execAsync(command, { timeout: 30000 })

    // Parse output
    const lines = stdout.split('\n')
    const info: any = {}

    for (const line of lines) {
      const [key, value] = line.split('=')
      if (key && value) {
        info[key] = value
      }
    }

    return {
      duration: Math.round(parseFloat(info.duration || '0')),
      width: parseInt(info.width || '0'),
      height: parseInt(info.height || '0'),
      bitrate: parseInt(info.bit_rate || '0'),
      frameRate: parseFloat(info.r_frame_rate?.split('/')[0] || '30'),
    }
  } catch (error) {
    logger.error('Failed to get video info', error)
    throw error
  }
}

// Convert video to different resolution
export async function convertVideoResolution(
  inputPath: string,
  outputPath: string,
  resolution: '1920x1080' | '1280x720' | '640x480'
): Promise<OutputVideo> {
  try {
    logger.info(`Converting video to ${resolution}`)

    const ffmpegPath = await getFFmpegPath()
    const encoder = await getVideoEncoder()

    const command = [
      `"${ffmpegPath}"`,
      '-i', `"${inputPath}"`,
      '-vf', `scale=${resolution}`,
      '-c:v', encoder.codec,
      ...encoder.options,
      '-c:a', 'aac',
      '-y',
      `"${outputPath}"`,
    ].join(' ')

    const { stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 600000,
    })

    if (stderr) {
      logger.debug(`FFmpeg output: ${stderr}`)
    }

    logger.info(`Video resolution conversion completed: ${outputPath}`)

    return {
      path: outputPath,
      width: parseInt(resolution.split('x')[0]),
      height: parseInt(resolution.split('x')[1]),
      duration: 0,
      fileSize: 0,
      bitrate: '0',
      codec: encoder.codec,
      createdAt: new Date(),
    }
  } catch (error) {
    logger.error('Failed to convert video resolution', error)
    throw error
  }
}

// Compose video with banner background, looped cooking video in center, and background music
// This is specifically for the audiobook + cooking video format
export async function composeBannerVideo(
  bannerImagePath: string,      // video_banner.png (background)
  cookingVideoPath: string,      // Douyin video (center overlay)
  backgroundMusicPath: string,   // bg-music.m4a (audio)
  outputPath: string,
  videoDuration: number = 60     // Duration in seconds (default 60s)
): Promise<OutputVideo> {
  try {
    logger.info('Starting banner video composition with looped cooking video')

    const ffmpegPath = await getFFmpegPath()
    const encoder = await getVideoEncoder()

    // Get cooking video info to know how to loop it
    const videoInfo = await getVideoInfo(cookingVideoPath)
    logger.info(`Cooking video info: ${videoInfo.duration}s duration, ${videoInfo.width}x${videoInfo.height}`)

    // Build filter graph for:
    // [0] = banner image (looped with -loop 1 flag, so no loop filter needed)
    // [1] = cooking video (looped via -stream_loop flag)
    // [2] = audio (either background music or Vbee voiceover, determined by caller)
    const filterGraph = [
      // Scale cooking video to center area (1920x1080 banner, center area for video)
      // Typical cooking video: 1080x1920 portrait, scale to ~540x960 for center
      '[1:v]scale=540:960,setsar=1[cooked]',

      // Create background from banner (already looped via -loop 1 input flag)
      '[0:v]scale=1920:1080[banner]',

      // Overlay looped cooking video on banner (centered)
      // Calculate x position: (1920-540)/2 = 690
      // Calculate y position: (1080-960)/2 = 60
      '[banner][cooked]overlay=690:60:enable=\'gte(t\\,0)\'[with_video]',

      // Set fps and format
      '[with_video]fps=30[video_out]',
    ].join(';')

    // Build FFmpeg command
    const command = [
      `"${ffmpegPath}"`,
      // Inputs
      '-loop', '1',                                    // Loop the banner image
      '-i', `"${bannerImagePath}"`,                   // [0] Banner background
      '-stream_loop', '-1',                           // Loop the cooking video infinitely
      '-i', `"${cookingVideoPath}"`,                  // [1] Cooking video
      '-i', `"${backgroundMusicPath}"`,               // [2] Background music

      // Filters - include audio filter for music volume (50% = 0.5)
      '-filter_complex', `"${filterGraph};[2:a:0]volume=0.5[music_out]"`,

      // Mapping
      '-map', '[video_out]',                          // Map video output
      '-map', '[music_out]',                          // Map audio from music file (with volume reduction)

      // Video codec
      '-c:v', encoder.codec,
      ...encoder.options,

      // Audio codec
      '-c:a', 'aac',
      '-b:a', '192k',

      // Duration
      '-t', `${videoDuration}`,

      // Output
      '-y',
      `"${outputPath}"`,
    ].join(' ')

    logger.debug(`Executing FFmpeg composite: ${command}`)

    // Execute FFmpeg
    const { stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 600000, // 10 minutes
    })

    if (stderr) {
      logger.debug(`FFmpeg output: ${stderr}`)
    }

    logger.info(`Banner video composition completed: ${outputPath}`)

    return {
      path: outputPath,
      width: 1920,
      height: 1080,
      duration: videoDuration,
      fileSize: 0,
      bitrate: '5000k',
      codec: encoder.codec,
      createdAt: new Date(),
    }
  } catch (error) {
    logger.error('Failed to compose banner video', error)
    throw error
  }
}
