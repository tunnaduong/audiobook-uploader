import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { ElectronAPI, PipelineConfig, PipelineProgress, AppSettings, EpubMetadata } from '../src/types'

// Define the API exposed to the renderer process
const api: ElectronAPI = {
  // File operations
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: (filters?: Array<{ name: string; extensions: string[] }>) => ipcRenderer.invoke('select-file', filters),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  openPath: (folderPath: string) => ipcRenderer.invoke('open-path', folderPath),
  getVideoDuration: (filePath: string) => ipcRenderer.invoke('get-video-duration', filePath),
  getNextVideoFolder: () => ipcRenderer.invoke('get-next-video-folder'),

  // EPUB operations
  parseEpubFile: (filePath: string): Promise<{ success: boolean; data?: EpubMetadata; error?: string }> =>
    ipcRenderer.invoke('parse-epub-file', filePath),

  // Pipeline operations
  startPipeline: (config: PipelineConfig) => ipcRenderer.invoke('start-pipeline', config),
  cancelPipeline: () => ipcRenderer.invoke('cancel-pipeline'),
  getPipelineProgress: () => ipcRenderer.invoke('get-pipeline-progress'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('save-settings', settings),

  // Database/History
  getHistory: () => ipcRenderer.invoke('get-history'),
  deleteProject: (id: number) => ipcRenderer.invoke('delete-project', id),

  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // Environment & Configuration
  getEnvConfig: () => ipcRenderer.invoke('get-env-config'),
  getProjectHistory: () => ipcRenderer.invoke('get-project-history'),

  // YouTube OAuth
  youtubeLogin: () => ipcRenderer.invoke('youtube-login'),
  youtubeLogout: () => ipcRenderer.invoke('youtube-logout'),
  getYouTubeSettings: () => ipcRenderer.invoke('get-youtube-settings'),
  updateYouTubeSettings: (settings) => ipcRenderer.invoke('update-youtube-settings', settings),

  // Event listeners
  onPipelineProgress: (callback: (progress: PipelineProgress) => void) => {
    const listener = (_event: IpcRendererEvent, progress: PipelineProgress) => callback(progress)
    ipcRenderer.on('pipeline-progress', listener)
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('pipeline-progress', listener)
  },

  onPipelineError: (callback: (error: string) => void) => {
    const listener = (_event: IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on('pipeline-error', listener)
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('pipeline-error', listener)
  },

  onAppLog: (callback: (log: { timestamp: string; level: string; module: string; message: string }) => void) => {
    const listener = (_event: IpcRendererEvent, log: { timestamp: string; level: string; module: string; message: string }) => callback(log)
    ipcRenderer.on('app-log', listener)
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('app-log', listener)
  },
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api)
