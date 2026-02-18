# Backend Integration Guide

## Overview

This guide explains how to connect the Dashboard UI components to the actual backend services (Vbee TTS, FFmpeg, YouTube, etc.).

---

## Current Architecture

### What's Implemented ✅
- **UI Components:** Dashboard, HomeTab, SettingsTab, HistoryTab
- **Backend Services:** All service files (vbee.ts, ffmpeg.ts, youtube.ts, etc.)
- **Database:** SQLite layer with sql.js
- **Build System:** Vite + Electron compilation

### What Needs Wiring 🔄
- **IPC Communication:** Browser → Electron main process → Backend services
- **Real API Calls:** Replace mock data with actual service calls
- **Progress Tracking:** Real progress from API calls to UI
- **Error Handling:** Proper error messages to user

---

## Data Flow

### Current (Mock)
```
Dashboard UI
    ↓
handleCreateAudiobook()
    ↓
setTimeout() simulations
    ↓
setProgress(), addLog()
    ↓
UI Update
```

### Target (Real)
```
Dashboard UI
    ↓
window.api.startPipeline(config)
    ↓
IPC → Electron Main Process
    ↓
Child Process spawns:
  - Vbee API call
  - FFmpeg execution
  - YouTube upload
    ↓
Progress events via IPC
    ↓
UI Update in real-time
```

---

## Step-by-Step Integration

### Step 1: Setup IPC Communication

**File:** `electron/events.ts`

The skeleton is already in place. Implement the actual pipeline:

```typescript
// electron/events.ts
ipcMain.handle('start-pipeline', async (event, config: PipelineConfig) => {
  try {
    const mainWindow = getMainWindow()

    // Step 1: Download video (if Douyin URL provided)
    if (config.douyinUrl) {
      mainWindow.webContents.send('pipeline-progress', {
        step: 1,
        progress: 20,
        message: 'Tải video Douyin...'
      })

      const video = await downloadVideo(config.douyinUrl)
      config.videoPath = video.path

      mainWindow.webContents.send('pipeline-progress', {
        step: 1,
        progress: 25,
        message: 'Tải video thành công!'
      })
    }

    // Step 2: Convert text to speech
    mainWindow.webContents.send('pipeline-progress', {
      step: 2,
      progress: 40,
      message: 'Chuyển đổi text thành audio...'
    })

    const audioFile = await convertTextToSpeech(
      config.storyText,
      config.voiceCode
    )

    mainWindow.webContents.send('pipeline-progress', {
      step: 2,
      progress: 60,
      message: 'Chuyển đổi thành công!'
    })

    // Step 3: Compose video
    mainWindow.webContents.send('pipeline-progress', {
      step: 3,
      progress: 70,
      message: 'Tạo video...'
    })

    const composedVideo = await composeVideo(
      config.backgroundPath,
      config.videoPath,
      audioFile.path,
      config.outputPath
    )

    // ... continue with steps 4 & 5

    return {
      success: true,
      videoId: youtubeResult.videoId,
      youtubeUrl: youtubeResult.url
    }
  } catch (error) {
    mainWindow.webContents.send('pipeline-error', {
      step: currentStep,
      error: error.message
    })
    throw error
  }
})
```

### Step 2: Update Dashboard to Use IPC

**File:** `src/components/Dashboard.tsx`

Replace the mock `handleCreateAudiobook` with actual IPC calls:

```typescript
const handleCreateAudiobook = async () => {
  if (!storyText.trim()) {
    alert('Vui lòng nhập nội dung truyện')
    return
  }

  setIsProcessing(true)
  setProgress(0)
  setLogs([])

  try {
    // Send config to Electron main process
    const result = await window.api.startPipeline({
      storyText,
      douyinUrl,
      voiceCode: selectedVoice,
      backgroundPath: './templates/background.png',
      outputPath: './output/final.mp4'
    })

    setProgress(100)
    addLog(`✅ Hoàn thành! Video ID: ${result.videoId}`)
    alert(`Video uploaded: ${result.youtubeUrl}`)

  } catch (error) {
    addLog(`❌ Lỗi: ${error.message}`)
    alert(`Lỗi: ${error.message}`)
  } finally {
    setIsProcessing(false)
  }
}

// Listen for progress updates from Electron
useEffect(() => {
  if (!window.api?.onPipelineProgress) return

  const unsubscribe = window.api.onPipelineProgress((data) => {
    setProgress(data.progress)
    addLog(`[Bước ${data.step}] ${data.message}`)
  })

  return unsubscribe
}, [])
```

### Step 3: Implement Settings Persistence

**File:** `src/components/Dashboard.tsx` (SettingsTab)

```typescript
function SettingsTab() {
  const [apiKey, setApiKey] = useState('')
  const [appId, setAppId] = useState('')
  const [youtubeKey, setYoutubeKey] = useState('')
  const [outputDir, setOutputDir] = useState('./output')

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await window.api.getSettings()
      setApiKey(settings.vbeeApiKey || '')
      setAppId(settings.vbeeAppId || '')
      setYoutubeKey(settings.youtubeApiKey || '')
      setOutputDir(settings.outputDir || './output')
    }
    loadSettings()
  }, [])

  const handleSaveSettings = async () => {
    // Validate API keys
    if (!apiKey.trim() || !appId.trim()) {
      alert('Vui lòng điền Vbee API Key và App ID')
      return
    }

    try {
      await window.api.saveSettings({
        vbeeApiKey: apiKey,
        vbeeAppId: appId,
        youtubeApiKey: youtubeKey,
        outputDir: outputDir
      })
      alert('Cài đặt đã được lưu!')
    } catch (error) {
      alert(`Lỗi: ${error.message}`)
    }
  }

  return (
    <div className="settings-tab">
      {/* ... form fields ... */}
      <button className="btn-primary" onClick={handleSaveSettings}>
        💾 Lưu Cài Đặt
      </button>
    </div>
  )
}
```

### Step 4: Load History from Database

**File:** `src/components/Dashboard.tsx` (HistoryTab)

```typescript
function HistoryTab() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const projects = await window.api.getHistory()
        setHistory(projects)
      } catch (error) {
        console.error('Failed to load history:', error)
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [])

  const handleDelete = async (projectId: number) => {
    if (!confirm('Bạn chắc chắn muốn xóa dự án này?')) return

    try {
      await window.api.deleteProject(projectId)
      setHistory(history.filter(h => h.id !== projectId))
    } catch (error) {
      alert(`Lỗi: ${error.message}`)
    }
  }

  if (loading) return <div>Đang tải...</div>

  return (
    <div className="history-tab">
      <h2>Lịch Sử Tạo Audiobook</h2>
      {history.length === 0 ? (
        <p>Chưa có dự án nào</p>
      ) : (
        <table className="history-table">
          <thead>
            <tr>
              <th>Tiêu Đề</th>
              <th>Ngày Tạo</th>
              <th>Thời Lượng</th>
              <th>Trạng Thái</th>
              <th>Hành Động</th>
            </tr>
          </thead>
          <tbody>
            {history.map(item => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{new Date(item.created_at).toLocaleString('vi-VN')}</td>
                <td>{item.duration}s</td>
                <td>{item.status}</td>
                <td>
                  <button className="btn-small">Xem</button>
                  <button
                    className="btn-small"
                    onClick={() => handleDelete(item.id)}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

---

## Services Integration Checklist

### Vbee TTS Integration
- [ ] Call `convertTextToSpeech()` from pipeline
- [ ] Handle audio buffer concatenation
- [ ] Save audio file to output directory
- [ ] Report progress during polling

**Service File:** `src/services/vbee.ts`

```typescript
// Current implementation already supports:
// - Automatic text chunking
// - Polling mechanism
// - Audio download
// - FFmpeg concatenation (with warning for production)

// Just needs to be called from electron/events.ts
```

### Video Download Integration
- [ ] Parse Douyin URL
- [ ] Execute yt-dlp with proper flags
- [ ] Remove watermark if possible
- [ ] Extract video metadata

**Service File:** `src/services/douyin.ts`

```typescript
export async function downloadVideo(url: string): Promise<Video> {
  // Implement yt-dlp wrapper
  // Return video path and metadata
}
```

### FFmpeg Video Composition
- [ ] Load background template
- [ ] Overlay cooking video (center, 9:16 aspect)
- [ ] Mix audio track
- [ ] Apply anti-Content ID modifications
- [ ] Export to H.264 MP4

**Service File:** `src/services/ffmpeg.ts`

```typescript
export async function composeVideo(
  backgroundPath: string,
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<OutputVideo> {
  // Implement FFmpeg filter graph
  // Return output video info
}
```

### YouTube Upload Integration
- [ ] Authenticate with YouTube API
- [ ] Prepare video metadata
- [ ] Upload using resumable protocol
- [ ] Return video ID and URL

**Service File:** `src/services/youtube.ts`

```typescript
export async function uploadVideo(
  filePath: string,
  metadata: VideoMetadata,
  accessToken: string
): Promise<YouTubeUploadResult> {
  // Implement YouTube upload
  // Return video ID and public URL
}
```

### Thumbnail Generation
- [ ] Generate prompt from story summary (Gemini)
- [ ] Call Banana API for image generation
- [ ] Download and save thumbnail
- [ ] Fallback to placeholder

**Service File:** `src/services/gemini.ts`

---

## Testing Checklist

### Unit Tests
- [ ] Test Vbee TTS with mock API
- [ ] Test text chunking logic
- [ ] Test FFmpeg command generation
- [ ] Test YouTube API responses

### Integration Tests
- [ ] Test full pipeline with test video
- [ ] Test IPC message passing
- [ ] Test database CRUD operations
- [ ] Test error handling and retries

### Manual Testing
- [ ] [ ] App launches without errors
- [ ] [ ] Can input story text
- [ ] [ ] Settings save/load correctly
- [ ] [ ] Progress bar updates in real-time
- [ ] [ ] History loads on startup
- [ ] [ ] API calls work (with test keys)
- [ ] [ ] Video is created successfully
- [ ] [ ] Video uploads to YouTube

---

## Error Handling Strategy

### Client-Side (Dashboard)
```typescript
try {
  const result = await window.api.startPipeline(config)
} catch (error) {
  // Show error to user
  addLog(`❌ Lỗi: ${error.message}`)
  alert(error.message)
} finally {
  setIsProcessing(false)
}
```

### Server-Side (Electron)
```typescript
try {
  // ... pipeline steps ...
} catch (error) {
  logger.error(`Pipeline failed at step ${step}`, error)
  mainWindow.webContents.send('pipeline-error', {
    step,
    message: error.message,
    timestamp: new Date().toISOString()
  })
  throw error
}
```

### API-Level
Each service already has proper error handling:
- Vbee: Retry logic with exponential backoff
- FFmpeg: Output validation
- YouTube: Rate limit handling

---

## Database Schema Reference

```sql
-- Projects
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  story_text TEXT,
  created_at TIMESTAMP,
  status TEXT,
  progress REAL,
  error_message TEXT
)

-- Videos
CREATE TABLE videos (
  id INTEGER PRIMARY KEY,
  project_id INTEGER,
  douyin_link TEXT,
  local_path TEXT,
  duration INTEGER,
  downloaded_at TIMESTAMP
)

-- Conversions
CREATE TABLE conversions (
  id INTEGER PRIMARY KEY,
  project_id INTEGER,
  audio_path TEXT,
  duration INTEGER,
  converted_at TIMESTAMP
)

-- Outputs
CREATE TABLE outputs (
  id INTEGER PRIMARY KEY,
  project_id INTEGER,
  final_video_path TEXT,
  thumbnail_path TEXT,
  youtube_id TEXT,
  status TEXT,
  created_at TIMESTAMP
)
```

---

## Environment Variables Required

```env
# Must be set before starting the pipeline
VBEE_API_KEY=xxxxx
VBEE_APP_ID=xxxxx
YOUTUBE_API_KEY=xxxxx
YOUTUBE_CLIENT_ID=xxxxx
YOUTUBE_CLIENT_SECRET=xxxxx
GEMINI_API_KEY=xxxxx
BANANA_API_KEY=xxxxx
BANANA_MODEL_KEY=xxxxx

# Optional
LOG_LEVEL=info
TEMP_DIR=./temp
OUTPUT_DIR=./output
```

---

## Common Integration Points

### Getting Settings in Service
```typescript
// In electron/events.ts
import { config } from 'dotenv'
config()

const apiKey = process.env.VBEE_API_KEY
const appId = process.env.VBEE_APP_ID
```

### Sending Progress Updates
```typescript
// From electron/events.ts to Dashboard
mainWindow.webContents.send('pipeline-progress', {
  step: 2,
  progress: 45,
  message: 'Chuyển đổi text thành audio...',
  timestamp: new Date().toISOString()
})
```

### Logging Pipeline Activities
```typescript
import { createLogger } from '../src/utils/logger'
const logger = createLogger('pipeline')

logger.info('Pipeline started')
logger.info(`Step 1: Downloaded video from ${url}`)
logger.error('Failed to convert text', error)
```

---

## Next Implementation Priority

1. **IPC Setup** - Connect Dashboard to Electron main process
2. **Settings Persistence** - Load/save environment variables
3. **History Loading** - Load projects from database
4. **Vbee Integration** - Wire TTS API with progress updates
5. **Video Composition** - FFmpeg integration
6. **YouTube Upload** - Final pipeline step
7. **Error Handling** - Comprehensive error messages
8. **Testing** - Unit and integration tests

---

## Resources

- **IPC Documentation:** https://www.electronjs.org/docs/latest/api/ipc-main
- **Vbee API:** See VBEE_API_INTEGRATION.md
- **Usage Examples:** See VBEE_USAGE_EXAMPLE.md
- **FFmpeg Docs:** https://ffmpeg.org/documentation.html
- **YouTube API:** https://developers.google.com/youtube/v3

---

## Support

For questions or issues during integration:
1. Check existing error logs in `~/.audiobook-uploader/logs/`
2. Review the example services in `src/services/`
3. Check IPC event handlers in `electron/events.ts`
4. Refer to VBEE_USAGE_EXAMPLE.md for service patterns
