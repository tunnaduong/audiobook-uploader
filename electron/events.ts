import { ipcMain, dialog, BrowserWindow, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { getAppDataPath, initializeDatabase, getProjectHistory, deleteProject as dbDeleteProject, getOutputsByProject } from '../src/utils/database'
import { executePipeline } from '../src/services/pipeline'
import { parseEpubFile } from '../src/services/epub'
import { onLog } from '../src/utils/logger'
import type { PipelineConfig, AppSettings, PipelineResult } from '../src/types'

let mainWindow: BrowserWindow | null = null

export function setupIpcHandlers(window: BrowserWindow) {
  mainWindow = window

  // Setup log listener to broadcast all logs to UI
  onLog((entry) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app-log', {
        timestamp: entry.timestamp,
        level: entry.level,
        module: entry.module,
        message: entry.message,
      })
    }
  })

  // File operations
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('select-file', async (_event, filters?: Array<{ name: string; extensions: string[] }>) => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('open-file', async (_event, filePath: string) => {
    // Open file in default application
    const { shell } = await import('electron')
    await shell.openPath(filePath)
  })

  ipcMain.handle('open-path', async (_event, folderPath: string) => {
    // Open folder in default file explorer
    const { shell } = await import('electron')
    return await shell.openPath(folderPath)
  })

  ipcMain.handle('get-video-duration', async (_event, filePath: string) => {
    // Get video duration using ffprobe if available, otherwise return 'N/A'
    return new Promise((resolve) => {
      // Check if file exists first
      if (!fs.existsSync(filePath)) {
        resolve('N/A')
        return
      }

      // Try using ffprobe to get duration
      const command = process.platform === 'win32'
        ? `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:noinherit=1 "${filePath}"`
        : `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:noinherit=1 '${filePath}'`

      exec(command, (error, stdout, _stderr) => {
        if (error) {
          console.warn(`Could not get video duration: ${error.message}`)
          resolve('N/A')
        } else {
          try {
            const durationSeconds = parseFloat(stdout.trim())
            if (!isNaN(durationSeconds)) {
              const minutes = Math.floor(durationSeconds / 60)
              const seconds = Math.floor(durationSeconds % 60)
              const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
              resolve(durationStr)
            } else {
              resolve('N/A')
            }
          } catch (e) {
            console.warn('Could not parse video duration')
            resolve('N/A')
          }
        }
      })
    })
  })

  // EPUB operations
  ipcMain.handle('parse-epub-file', async (_event, filePath: string) => {
    try {
      const metadata = await parseEpubFile(filePath)
      console.log(`✅ EPUB parsed: ${metadata.title} (${metadata.chapters.length} chapters)`)
      return {
        success: true,
        data: metadata,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to parse EPUB: ${errorMsg}`)
      return {
        success: false,
        error: errorMsg,
      }
    }
  })

  // Settings
  ipcMain.handle('get-settings', async () => {
    // TODO: Load settings from config file
    const appDataPath = getAppDataPath()
    return {
      vbeeApiKey: process.env.VBEE_API_KEY || '',
      youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      bananaApiKey: process.env.BANANA_API_KEY || '',
      outputDirectory: path.join(appDataPath, 'output'),
      tempDirectory: path.join(appDataPath, 'temp'),
      autoCleanup: true,
      logLevel: 'info' as const,
    }
  })

  ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
    // TODO: Save settings to config file
    console.log('Saving settings:', settings)
  })

  // Database operations
  ipcMain.handle('get-history', async () => {
    await initializeDatabase()
    return getProjectHistory()
  })

  ipcMain.handle('delete-project', async (_event, id: number) => {
    await dbDeleteProject(id)
  })

  // Pipeline operations
  ipcMain.handle('start-pipeline', async (_event, pipelineConfig: PipelineConfig): Promise<PipelineResult> => {
    // Real pipeline orchestration with actual services
    console.log('🔵 IPC Handler: Starting pipeline')

    try {
      console.log('📋 Config: storyTitle=' + pipelineConfig.storyTitle + ', bannerImage=' + pipelineConfig.bannerImagePath)

      const result = await executePipeline(pipelineConfig, (step) => {
        // Send progress updates to renderer
        console.log(`📊 Step: ${step.name} - ${step.progress}%`)
        if (mainWindow) {
          mainWindow.webContents.send('pipeline-progress', {
            stepName: step.name,
            status: step.status,
            progress: step.progress,
            message: step.message,
            error: step.error,
          })
        }
      })

      if (result.success) {
        console.log('🟢 IPC Handler: SUCCESS - Pipeline completed')
        console.log('📁 Video:', result.videoPath)
        console.log('📁 Thumbnail:', result.thumbnailPath)
      } else {
        console.log('🟡 IPC Handler: FAILED - Pipeline returned error')
        console.log('❌ Error:', result.error)
      }

      console.log('📤 Returning result to renderer:', JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const fullStack = error instanceof Error ? error.stack : ''

      console.error('🔴 IPC Handler: EXCEPTION CAUGHT')
      console.error('Type:', error?.constructor?.name || 'Unknown')
      console.error('Message:', errorMessage)
      if (fullStack) console.error('Stack:', fullStack)

      // Ensure error is properly formatted
      const result: PipelineResult = {
        success: false,
        error: errorMessage || 'Unknown error occurred during pipeline execution',
        steps: [],
      }

      console.error('📤 Returning error result:', JSON.stringify(result, null, 2))

      if (mainWindow) {
        mainWindow.webContents.send('pipeline-error', result.error)
      }

      return result
    }
  })

  ipcMain.handle('cancel-pipeline', async () => {
    // TODO: Implement pipeline cancellation
    console.log('Canceling pipeline')
  })

  ipcMain.handle('get-pipeline-progress', async () => {
    // TODO: Get current pipeline progress
    return {
      step: 1,
      stepName: 'Idle',
      progress: 0,
      status: 'pending',
    }
  })

  // System info
  ipcMain.handle('get-system-info', async () => {
    return {
      platform: process.platform as 'win32' | 'darwin' | 'linux',
      arch: process.arch,
      nodeVersion: process.versions.node,
    }
  })

  // Environment configuration
  ipcMain.handle('get-env-config', async () => {
    console.log('📋 IPC: Loading environment configuration')
    return {
      VBEE_API_KEY: process.env.VBEE_API_KEY,
      VBEE_APP_ID: process.env.VBEE_APP_ID,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      COMET_API_KEY: process.env.COMET_API_KEY,
    }
  })

  // Project history
  ipcMain.handle('get-project-history', async () => {
    console.log('📋 IPC: Loading project history')
    try {
      await initializeDatabase()
      const projects = await getProjectHistory()
      // Transform database projects to ProjectHistory format for UI
      const historyItems = await Promise.all(
        projects.map(async (p) => {
          // Format date - handle both snake_case and camelCase fields
          const createdAt = (p.created_at || p.createdAt) as string | undefined
          const dateStr = createdAt
            ? new Date(createdAt).toLocaleString('vi-VN')
            : 'N/A'

          // Get actual output path and duration from database
          let outputPath: string | null = null
          let durationStr = 'N/A'

          try {
            const outputs = await getOutputsByProject(p.id)
            if (outputs.length > 0) {
              const output = outputs[0]
              // Get the path from the database
              const savedVideoPath = output.final_video_path
              if (savedVideoPath) {
                // Extract the folder containing the video
                outputPath = path.dirname(savedVideoPath)

                // Get video duration from database (saved during pipeline completion)
                if (output.duration) {
                  const minutes = Math.floor(output.duration / 60)
                  const seconds = output.duration % 60
                  durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`
                  console.debug(`📊 Got video duration from database: ${output.duration}s → ${durationStr}`)
                } else {
                  console.debug(`⚠️ No duration in database for project ${p.id}`)
                  durationStr = 'N/A'
                }
              }
            }
          } catch (dbErr) {
            console.debug(`Could not get outputs for project ${p.id}:`, dbErr)
          }

          // Fallback: if we couldn't get the path from outputs, use the project ID to construct it
          if (!outputPath) {
            outputPath = path.join(getAppDataPath(), 'output', `vid_${p.id}`)
          }

          return {
            id: p.id,
            name: p.title,
            date: dateStr,
            duration: durationStr,
            status: p.status === 'completed' ? 'completed' : 'failed',
            outputPath: outputPath,
          }
        })
      )

      return historyItems
    } catch (error) {
      console.error('❌ Failed to load project history:', error)
      return []
    }
  })

  // Get video folder - reuses existing folder if it has incomplete files, otherwise creates new
  // This saves API tokens by not redoing work for incomplete projects
  ipcMain.handle('get-next-video-folder', async () => {
    const baseOutputPath = 'C:\\dev\\audiobook-uploader\\output'
    let maxNum = 0
    let lastFolderPath = ''

    try {
      if (fs.existsSync(baseOutputPath)) {
        const files = fs.readdirSync(baseOutputPath)
        for (const file of files) {
          const match = file.match(/^vid_(\d+)$/)
          if (match) {
            const num = parseInt(match[1], 10)
            if (num > maxNum) {
              maxNum = num
              lastFolderPath = path.join(baseOutputPath, `vid_${num}`)
            }
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not read output directory:', error)
    }

    // Logic: Reuse incomplete folders, only create new ones when folder is "done"
    // A folder is "done" if it has final_video.mp4
    let folderToUse = lastFolderPath
    let videoNum = maxNum

    if (lastFolderPath && fs.existsSync(lastFolderPath)) {
      try {
        const folderContents = fs.readdirSync(lastFolderPath)
        const hasFinalVideo = folderContents.includes('final_video.mp4')

        if (hasFinalVideo) {
          // Last folder is complete (has final video), create a new folder
          videoNum = maxNum + 1
          folderToUse = path.join(baseOutputPath, `vid_${videoNum}`)
          console.log(`✅ Folder vid_${maxNum} is complete - creating new folder: vid_${videoNum}`)
        } else {
          // Last folder is incomplete, reuse it (skip wasted API calls)
          console.log(`♻️ Reusing incomplete folder vid_${maxNum} (skip API tokens) - files: ${folderContents.join(', ')}`)
        }
      } catch (error) {
        console.warn('⚠️ Could not check folder contents:', error)
        videoNum = maxNum + 1
        folderToUse = path.join(baseOutputPath, `vid_${videoNum}`)
      }
    } else if (maxNum === 0) {
      // No folders exist yet, create first one
      videoNum = 1
      folderToUse = path.join(baseOutputPath, `vid_1`)
      console.log(`📁 Creating first folder: vid_1`)
    }

    console.log(`📁 Using folder: ${folderToUse}`)
    return { folderPath: folderToUse, videoNum }
  })

  // YouTube OAuth handlers
  ipcMain.handle('youtube-login', async () => {
    try {
      const { getOAuthConfig } = await import('../src/utils/youtube-oauth')
      const { initializeYouTubeOAuthHandler } = await import('./youtube-oauth-handler')

      const oauthConfig = getOAuthConfig()
      const handler = initializeYouTubeOAuthHandler(oauthConfig)

      await handler.initiateLogin()

      // Fetch channel info
      let channelTitle = 'YouTube Channel'
      try {
        // TODO: Fetch actual channel info using YouTube API
      } catch (e) {
        console.warn('Could not fetch channel info:', e)
      }

      console.log('✅ YouTube login successful')
      return {
        success: true,
        channelTitle,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ YouTube login failed:', errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    }
  })

  ipcMain.handle('youtube-logout', async () => {
    try {
      const { deleteYouTubeTokens } = await import('../src/services/youtube-auth')
      await deleteYouTubeTokens()
      console.log('✅ YouTube logout successful')
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('❌ YouTube logout failed:', errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    }
  })

  ipcMain.handle('get-youtube-settings', async () => {
    try {
      const { hasValidYouTubeTokens } = await import('../src/services/youtube-auth')
      const isAuthenticated = await hasValidYouTubeTokens()

      return {
        isAuthenticated,
        channelTitle: isAuthenticated ? 'YouTube Channel' : undefined,
        uploadByDefault: false,
        videoVisibility: 'public' as const,
        defaultCategory: 24, // Entertainment
      }
    } catch (error) {
      console.error('Failed to get YouTube settings:', error)
      return {
        isAuthenticated: false,
        uploadByDefault: false,
        videoVisibility: 'public' as const,
        defaultCategory: 24,
      }
    }
  })

  ipcMain.handle('update-youtube-settings', async (_event, settings) => {
    try {
      // TODO: Save settings to persistent storage
      console.log('Updating YouTube settings:', settings)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Failed to update YouTube settings:', errorMessage)
      return {
        success: false,
        error: errorMessage,
      }
    }
  })

  // Secure data storage handlers using Electron's built-in safeStorage
  ipcMain.handle('save-secure-data', async (_event, key: string, value: string) => {
    try {
      const encryptedValue = safeStorage.encryptString(value)
      const configPath = path.join(getAppDataPath(), '.secure-config')

      // Ensure config directory exists
      if (!fs.existsSync(getAppDataPath())) {
        fs.mkdirSync(getAppDataPath(), { recursive: true })
      }

      // Read existing data
      let data: Record<string, string> = {}
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, 'utf8')
          data = JSON.parse(content)
        } catch (e) {
          // Ignore parse errors, start fresh
        }
      }

      // Update with new value (store as base64-encoded encrypted buffer)
      data[key] = encryptedValue.toString('base64')

      // Write back
      fs.writeFileSync(configPath, JSON.stringify(data), 'utf8')
      console.log(`✅ Secure data saved for key: ${key}`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to save secure data: ${errorMessage}`)
      throw error
    }
  })

  ipcMain.handle('get-secure-data', async (_event, key: string) => {
    try {
      const configPath = path.join(getAppDataPath(), '.secure-config')

      if (!fs.existsSync(configPath)) {
        return null
      }

      // Read existing data
      const content = fs.readFileSync(configPath, 'utf8')
      const data = JSON.parse(content) as Record<string, string>

      if (!data[key]) {
        return null
      }

      // Decrypt the value
      const encryptedBuffer = Buffer.from(data[key], 'base64')
      const decryptedValue = safeStorage.decryptString(encryptedBuffer)
      console.log(`✅ Secure data retrieved for key: ${key}`)
      return decryptedValue
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to get secure data: ${errorMessage}`)
      return null
    }
  })

  ipcMain.handle('delete-secure-data', async (_event, key: string) => {
    try {
      const configPath = path.join(getAppDataPath(), '.secure-config')

      if (!fs.existsSync(configPath)) {
        return { success: true }
      }

      // Read existing data
      const content = fs.readFileSync(configPath, 'utf8')
      const data = JSON.parse(content) as Record<string, string>

      // Delete the key
      delete data[key]

      // Write back
      fs.writeFileSync(configPath, JSON.stringify(data), 'utf8')
      console.log(`✅ Secure data deleted for key: ${key}`)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Failed to delete secure data: ${errorMessage}`)
      return { success: false, error: errorMessage }
    }
  })
}
