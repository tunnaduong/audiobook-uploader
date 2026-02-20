// MUST import this FIRST to load .env before other modules
import './preload-env'

import { app, BrowserWindow, Menu } from 'electron'
import path from 'path'
import { isDev } from './utils'
import { setupIpcHandlers } from './events'

let mainWindow: BrowserWindow | null

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  // Setup IPC handlers
  if (mainWindow) {
    setupIpcHandlers(mainWindow)
  }

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    const devServerUrl = 'http://localhost:5173'
    console.log(`📱 Loading dev server: ${devServerUrl}`)

    mainWindow.webContents.openDevTools()

    mainWindow.loadURL(devServerUrl).catch((error) => {
      console.error(`❌ Failed to load dev server at ${devServerUrl}`)
      console.error(`Error: ${error.message}`)
      console.error('Make sure Vite dev server is running in Terminal 1: npm run dev')
    })

    // Listen for renderer crashes
    mainWindow.webContents.on('crashed', () => {
      console.error('❌ Renderer process crashed!')
    })

    mainWindow.webContents.on('unresponsive', () => {
      console.error('⚠️ Renderer process unresponsive!')
    })
  } else {
    // In production, load from bundled files
    const rendererDist = path.join(app.getAppPath(), 'dist/renderer')
    console.log(`📱 Loading production build from: ${rendererDist}`)
    mainWindow.loadFile(path.join(rendererDist, 'index.html')).catch((error) => {
      console.error(`❌ Failed to load index.html from ${rendererDist}`)
      console.error(`Error: ${error.message}`)
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  // On macOS, keep app active until user explicitly quits
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS, re-create window when dock icon is clicked
  if (mainWindow === null) {
    createWindow()
  }
})

// Create application menu
const createMenu = () => {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit()
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle DevTools', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.on('ready', () => {
  createMenu()
})


// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})
