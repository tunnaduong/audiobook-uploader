import { ipcMain, dialog, BrowserWindow } from 'electron'
import path from 'path'
import { getAppDataPath, initializeDatabase, getProjectHistory, deleteProject as dbDeleteProject } from '../src/utils/database'
import { executePipeline } from '../src/services/pipeline'
import type { PipelineConfig, AppSettings, PipelineResult } from '../src/types'

let mainWindow: BrowserWindow | null = null

export function setupIpcHandlers(window: BrowserWindow) {
  mainWindow = window

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
}
