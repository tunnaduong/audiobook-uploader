import { exec, spawn } from 'child_process'
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

// Cache encoder detection result
let cachedEncoder: { codec: string; options: string[] } | null = null

// Get optimal FFmpeg encoder based on platform
async function getVideoEncoder(): Promise<{ codec: string; options: string[] }> {
  // Return cached result if available
  if (cachedEncoder) {
    return cachedEncoder
  }

  const platform = process.platform

  if (platform === 'darwin') {
    // macOS - use hardware encoding
    cachedEncoder = {
      codec: 'h264_videotoolbox',
      options: ['-q:v', '4'],
    }
    return cachedEncoder
  } else if (platform === 'win32') {
    // Windows - try hardware encoders in order: Intel QSV (best for Intel CPUs) > NVENC > MediaFoundation > libx264
    const ffmpegPath = await getFFmpegPath()

    let availableEncoders = ''
    try {
      const { stdout } = await execAsync(`"${ffmpegPath}" -encoders 2>&1`, { timeout: 10000 })
      availableEncoders = stdout
    } catch {
      logger.debug('Could not detect available encoders')
    }

    // Try Intel Quick Sync FIRST (best for Intel CPUs - Pentium, Core, Xeon)
    if (availableEncoders.includes('h264_qsv')) {
      logger.info('✅ Using Intel Quick Sync (Best for Intel CPU)')
      cachedEncoder = {
        codec: 'h264_qsv',
        options: ['-global_quality', '23', '-preset', 'faster'],
      }
      return cachedEncoder
    }

    // Try NVIDIA NVENC second (for NVIDIA GPU systems)
    if (availableEncoders.includes('h264_nvenc')) {
      logger.info('✅ Using NVIDIA NVENC (GPU encoding)')
      cachedEncoder = {
        codec: 'h264_nvenc',
        options: ['-preset', 'fast', '-rc', 'vbr', '-cq', '23'],
      }
      return cachedEncoder
    }

    // Try Windows MediaFoundation (fallback hardware acceleration)
    if (availableEncoders.includes('h264_mf')) {
      logger.info('✅ Using Windows MediaFoundation H.264 encoder')
      cachedEncoder = {
        codec: 'h264_mf',
        options: ['-q:v', '23'],
      }
      return cachedEncoder
    }

    // Fallback to software encoding (slowest but always available)
    logger.warn('⚠️ Using libx264 software encoding (slower). Consider upgrading CPU or closing other apps for faster encoding.')
    cachedEncoder = {
      codec: 'libx264',
      options: ['-preset', 'ultrafast', '-crf', '28'],  // Fastest preset for software
    }
    return cachedEncoder
  } else {
    // Linux
    cachedEncoder = {
      codec: 'libx264',
      options: ['-preset', 'ultrafast', '-crf', '28'],  // Optimize for speed
    }
    return cachedEncoder
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
    try {
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
    } catch (ffmpegError) {
      const errorMsg = ffmpegError instanceof Error ? ffmpegError.message : String(ffmpegError)

      // If encoder failed (e.g., NVIDIA driver not found), retry with libx264
      const isEncoderError =
        errorMsg.includes('Cannot load nvcuda.dll') ||
        errorMsg.includes('nvcuda.dll') ||
        errorMsg.includes('h264_nvenc') ||
        errorMsg.includes('h264_qsv') ||
        (errorMsg.includes('Error while opening encoder') && encoder.codec !== 'libx264') ||
        (errorMsg.includes('Operation not permitted') && encoder.codec !== 'libx264') ||
        (errorMsg.includes('Conversion failed') && encoder.codec !== 'libx264')

      if (isEncoderError && encoder.codec !== 'libx264') {
        logger.warn(`⚠️ Encoder ${encoder.codec} failed: ${errorMsg.substring(0, 100)}`)
        logger.info('🔄 Retrying with libx264 software encoder...')

        // Clear cache and force software encoder
        cachedEncoder = null

        // Rebuild command with libx264
        const fallbackEncoder = {
          codec: 'libx264',
          options: ['-preset', 'ultrafast', '-crf', '28'],
        }

        const fallbackCommand = [
          `"${ffmpegPath}"`,
          '-i', `"${backgroundPath}"`,
          '-i', `"${videoPath}"`,
          '-i', `"${audioPath}"`,
          '-filter_complex', `"${filterGraph}"`,
          '-map', '[video_out]',
          '-map', '2:a:0',
          '-c:v', fallbackEncoder.codec,
          ...fallbackEncoder.options,
          '-c:a', 'aac',
          '-b:a', '192k',
          '-y',
          `"${outputPath}"`,
        ].join(' ')

        logger.debug(`Fallback command: ${fallbackCommand}`)

        try {
          const { stderr: fallbackStderr } = await execAsync(fallbackCommand, {
            maxBuffer: 50 * 1024 * 1024,
            timeout: 600000,
          })

          if (fallbackStderr) {
            logger.debug(`FFmpeg fallback output: ${fallbackStderr}`)
          }

          logger.info(`✅ Video composition completed with libx264: ${outputPath}`)

          return {
            path: outputPath,
            width: 1920,
            height: 1080,
            duration: 0,
            fileSize: 0,
            bitrate: '5000k',
            codec: fallbackEncoder.codec,
            createdAt: new Date(),
          }
        } catch (fallbackError) {
          const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          logger.error(`❌ Fallback encoder also failed: ${fallbackMsg}`)
          throw fallbackError
        }
      }

      // Re-throw if it's a different error
      throw ffmpegError
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

/**
 * Mix voiceover audio with background music
 * voiceover: 100% volume (full)
 * backgroundMusic: 50% volume (half)
 * Output: Both mixed together
 */
export async function mixVoiceoverWithMusic(
  voiceoverPath: string,
  backgroundMusicPath: string,
  outputPath: string
): Promise<void> {
  try {
    logger.info(`🎵 Mixing voiceover (100%) with background music (50%)`)

    const ffmpegPath = await getFFmpegPath()

    // FFmpeg filter:
    // [0:a] = voiceover at 100% (volume=1.0)
    // [1:a] = background music at 50% (volume=0.5)
    // amix=inputs=2:duration=first = mix both, use first input's duration
    const audioFilter = `[0:a]volume=1.0[v0];[1:a]volume=0.5[v1];[v0][v1]amix=inputs=2:duration=first[a_out]`

    const command = [
      `"${ffmpegPath}"`,
      '-i', `"${voiceoverPath}"`,
      '-i', `"${backgroundMusicPath}"`,
      '-filter_complex', `"${audioFilter}"`,
      '-map', '[a_out]',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-y',
      `"${outputPath}"`,
    ].join(' ')

    logger.debug(`FFmpeg mix command: ${command}`)

    const { stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 600000,
    })

    if (stderr) {
      logger.debug(`FFmpeg output: ${stderr}`)
    }

    logger.info(`✅ Audio mixing completed: ${outputPath}`)
  } catch (error) {
    logger.error('Failed to mix voiceover with music', error)
    throw error
  }
}

// Compose video with banner background, looped cooking video in center, and background music
// This is specifically for the audiobook + cooking video format
export async function composeBannerVideo(
  bannerImagePath: string,      // video_banner.png (background)
  cookingVideoPath: string,      // Douyin video (center overlay)
  backgroundMusicPath: string,   // bg-music.m4a OR voiceover.mp3 (audio)
  outputPath: string,
  videoDuration: number = 60,    // Duration in seconds (default 60s)
  isVoiceover: boolean = false,  // If true, use as voiceover without volume reduction; if false, apply 50% volume as background music
  onProgress?: (message: string, progress: number) => void  // Progress callback (message, 0-100)
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

    // Build FFmpeg command with different audio handling based on whether it's voiceover or background music
    const audioFilterPart = isVoiceover
      ? ''  // No volume reduction for voiceover - use it as-is
      : ';[2:a:0]volume=0.5[music_out]'  // Reduce background music volume to 50%

    const audioMapFlags = isVoiceover
      ? ['-map', '2:a:0']  // Voiceover: use audio stream directly (no volume reduction)
      : ['-map', '[music_out]']  // Background music: use volume-reduced audio

    const command = [
      `"${ffmpegPath}"`,
      // Inputs
      '-loop', '1',                                    // Loop the banner image
      '-i', `"${bannerImagePath}"`,                   // [0] Banner background
      '-stream_loop', '-1',                           // Loop the cooking video infinitely
      '-i', `"${cookingVideoPath}"`,                  // [1] Cooking video
      '-i', `"${backgroundMusicPath}"`,               // [2] Background music OR voiceover

      // Filters - conditionally apply volume filter for background music
      '-filter_complex', `"${filterGraph}${audioFilterPart}"`,

      // Mapping
      '-map', '[video_out]',                          // Map video output
      ...audioMapFlags,                               // Map audio (voiceover or background music)

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

    // Estimate encoding time based on encoder
    let encodingEstimate = Math.round(videoDuration / 30)
    if (encoder.codec === 'h264_nvenc') {
      encodingEstimate = Math.round(videoDuration / 120)  // NVENC is ~4x faster
    } else if (encoder.codec === 'h264_qsv') {
      encodingEstimate = Math.round(videoDuration / 60)   // QSV is ~2x faster
    } else {
      encodingEstimate = Math.round(videoDuration / 10)   // Software is slower (~10 fps)
    }

    logger.info(`🎬 Starting FFmpeg encoding with ${encoder.codec}: ${videoDuration}s video (estimate: ${encodingEstimate} minute${encodingEstimate !== 1 ? 's' : ''})`)

    const startTime = Date.now()
    onProgress?.(`Starting FFmpeg encoding for ${videoDuration}s video...`, 0)

    // Execute FFmpeg using spawn for real-time progress tracking
    await new Promise<void>((resolve, reject) => {
      const ffmpegProcess = spawn(ffmpegPath, [
        '-loop', '1',
        '-i', bannerImagePath,
        '-stream_loop', '-1',
        '-i', cookingVideoPath,
        '-i', backgroundMusicPath,
        '-filter_complex', `${filterGraph}${audioFilterPart}`,
        '-map', '[video_out]',
        ...audioMapFlags,
        '-c:v', encoder.codec,
        ...encoder.options,
        '-c:a', 'aac',
        '-b:a', '192k',
        '-t', `${videoDuration}`,
        '-y',
        outputPath,
      ])

      let lastProgress = 0

      ffmpegProcess.stderr?.on('data', (data) => {
        const output = data.toString()
        logger.debug(`FFmpeg: ${output.substring(0, 200)}`)

        // Parse FFmpeg output for progress: "frame=123 fps=30 q=28.0"
        const frameMatch = output.match(/frame=\s*(\d+)/)
        if (frameMatch) {
          const currentFrame = parseInt(frameMatch[1])
          const totalFrames = videoDuration * 30
          const progress = Math.min(99, Math.round((currentFrame / totalFrames) * 100))

          if (progress > lastProgress) {
            lastProgress = progress
            onProgress?.(`Encoding video: ${progress}%`, progress)
          }
        }
      })

      ffmpegProcess.on('close', (code) => {
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
        const fps = Math.round((videoDuration * 30) / elapsedSeconds)

        if (code === 0) {
          onProgress?.(`✅ FFmpeg encoding completed in ${elapsedSeconds}s`, 100)
          logger.info(`✅ Banner video composition completed: ${outputPath} (${elapsedSeconds}s, ${fps} fps)`)
          resolve()
        } else {
          reject(new Error(`FFmpeg process exited with code ${code}`))
        }
      })

      ffmpegProcess.on('error', (err) => {
        logger.error(`FFmpeg spawn error: ${err.message}`)
        reject(err)
      })
    })

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
