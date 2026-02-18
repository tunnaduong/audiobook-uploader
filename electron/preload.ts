import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { ElectronAPI, PipelineConfig, PipelineProgress, AppSettings } from '../src/types'

// Define the API exposed to the renderer process
const api: ElectronAPI = {
  // File operations
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFile: (path: string) => ipcRenderer.invoke('open-file', path),

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
}

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('api', api)
