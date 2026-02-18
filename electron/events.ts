import { ipcMain, dialog, BrowserWindow } from 'electron'
import path from 'path'
import { getAppDataPath, initializeDatabase, getProjectHistory, deleteProject as dbDeleteProject } from '../src/utils/database'
import { executePipeline } from '../src/services/pipeline'
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

  ipcMain.handle('open-file', async (_event, filePath: string) => {
    // Open file in default application
    const { shell } = await import('electron')
    await shell.openPath(filePath)
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
      return projects.map((p) => ({
        id: p.id,
        name: p.title,
        date: p.createdAt ? new Date(p.createdAt).toLocaleString('vi-VN') : 'N/A',
        duration: p.progress ? `${p.progress * 0.6}:00` : 'N/A', // Rough estimate
        status: p.status === 'completed' ? 'completed' : 'failed',
        outputPath: path.join(getAppDataPath(), 'output', `vid_${p.id}`),
      }))
    } catch (error) {
      console.error('❌ Failed to load project history:', error)
      return []
    }
  })
}
