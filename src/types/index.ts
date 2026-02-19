/**
 * Core TypeScript Interfaces for Audiobook Uploader
 */

// Video information from Douyin
export interface Video {
  id: string
  title: string
  url: string
  duration: number // in seconds
  thumbnail?: string
  localPath?: string
  downloadedAt?: Date
}

// Audio file from TTS conversion
export interface AudioFile {
  path: string
  duration: number // in seconds
  sampleRate: number
  channels: number
  format: 'mp3' | 'wav' | 'aac'
  fileSize: number
}

// Project containing story text and configuration
export interface Project {
  id: number
  title: string
  storyText: string
  createdAt: Date
  updatedAt?: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number // 0-100
  errorMessage?: string
}

// Video metadata for composition
export interface CompositionOptions {
  resolution: '1920x1080' | '1280x720'
  backgroundPath: string
  mirrorVideo?: boolean
  speedVariation?: number // 0.95 - 1.05
  brightness?: number // -100 to 100
  contrast?: number // -100 to 100
  addWaveEffect?: boolean
}

// Output video file
export interface OutputVideo {
  path: string
  width: number
  height: number
  duration: number
  fileSize: number
  bitrate: string
  codec: string
  createdAt: Date
}

// Thumbnail image
export interface ThumbnailImage {
  path: string
  width: number
  height: number
  format: 'jpg' | 'png'
  fileSize: number
  generatedAt: Date
}

// YouTube upload response
export interface YouTubeUploadResult {
  videoId: string
  url: string
  status: 'processing' | 'succeeded' | 'failed'
  uploadedAt: Date
}

// Video metadata for YouTube
export interface VideoMetadata {
  title: string
  description: string
  tags: string[]
  visibility: 'public' | 'private' | 'unlisted'
  language?: string
}

// Pipeline configuration - matches executePipeline() in src/services/pipeline.ts
export interface PipelineConfig {
  // Story content
  storyText: string
  storyTitle: string

  // Input files
  bannerImagePath: string         // video_banner.png
  cookingVideoPath: string        // Cooking video file path (fallback if no Douyin URL)
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
  douyinUrl?: string              // Optional: Douyin video URL to download
  resumeOnExist?: boolean         // Skip steps if intermediate files exist (mixed_audio, voiceover, final_video)
}

// Pipeline progress event
export interface PipelineProgress {
  stepName: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number // 0-100
  message: string
  error?: string
}

// System information
export interface SystemInfo {
  platform: 'win32' | 'darwin' | 'linux'
  arch: string
  nodeVersion: string
  ffmpegPath?: string
  ytdlpPath?: string
}

// Settings
export interface AppSettings {
  vbeeApiKey: string
  youtubeApiKey: string
  geminiApiKey: string
  bananaApiKey: string
  ffmpegPath?: string
  ytdlpPath?: string
  outputDirectory: string
  tempDirectory: string
  autoCleanup: boolean
  logLevel: 'error' | 'warn' | 'info' | 'debug'
}

// Pipeline result
export interface PipelineResult {
  success: boolean
  videoPath?: string
  thumbnailPath?: string
  voiceoverPath?: string
  youtubeResult?: YouTubeUploadResult
  error?: string
  steps: PipelineStep[]
}

// Pipeline step tracking
export interface PipelineStep {
  name: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number  // 0-100
  message: string
  error?: string
}

// Environment configuration
export interface EnvConfig {
  VBEE_API_KEY?: string
  VBEE_APP_ID?: string
  GEMINI_API_KEY?: string
  COMET_API_KEY?: string
}

// Project history item
export interface ProjectHistory {
  id: number
  name: string
  date: string
  duration: string
  status: 'completed' | 'failed'
  outputPath: string
}

// IPC API interface
export interface ElectronAPI {
  selectFolder(): Promise<string>
  openFile(path: string): Promise<void>
  openPath(folderPath: string): Promise<string>
  getVideoDuration(filePath: string): Promise<string>
  getNextVideoFolder(): Promise<{ folderPath: string; videoNum: number }>
  startPipeline(config: PipelineConfig): Promise<PipelineResult>
  cancelPipeline(): Promise<void>
  getPipelineProgress(): Promise<PipelineProgress>
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<void>
  getHistory(): Promise<Project[]>
  deleteProject(id: number): Promise<void>
  getSystemInfo(): Promise<SystemInfo>
  getEnvConfig(): Promise<EnvConfig>
  getProjectHistory(): Promise<ProjectHistory[]>
  onPipelineProgress(callback: (progress: PipelineProgress) => void): () => void
  onPipelineError(callback: (error: string) => void): () => void
  onAppLog(callback: (log: { timestamp: string; level: string; module: string; message: string }) => void): () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
