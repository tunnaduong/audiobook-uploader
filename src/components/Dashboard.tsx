import { useState, useEffect, useRef } from 'react'
import './Dashboard.css'

// Helper function to extract Douyin URL from pasted text
function extractDouyinUrlFromText(text: string): string | null {
  if (!text || !text.trim()) return null

  // Try to find URL in the text
  const urlMatch = text.match(/https?:\/\/[^\s]+/g)
  if (!urlMatch) return null

  // Find the first valid Douyin URL
  for (const url of urlMatch) {
    if (/douyin\.com|dy\.zzz\.com\.cn|vt\.tiktok\.com|v\.douyin\.com/.test(url)) {
      return url
    }
  }

  return null
}

// Helper function to get next video number and output folder
async function getNextVideoFolder(): Promise<{ folderPath: string; videoNum: number }> {
  const baseOutputPath = 'C:\\dev\\audiobook-uploader\\output'

  // Find highest existing vid_X folder
  let maxNum = 0
  try {
    const fs = await import('fs')
    if (fs.existsSync(baseOutputPath)) {
      const files = fs.readdirSync(baseOutputPath)
      for (const file of files) {
        const match = file.match(/^vid_(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxNum) maxNum = num
        }
      }
    }
  } catch (error) {
    console.warn('Could not read output directory:', error)
  }

  const nextNum = maxNum + 1
  const folderPath = `${baseOutputPath}\\vid_${nextNum}`
  return { folderPath, videoNum: nextNum }
}

interface EnvConfig {
  VBEE_API_KEY?: string
  VBEE_APP_ID?: string
  GEMINI_API_KEY?: string
  COMET_API_KEY?: string
}

interface Project {
  id: number
  name: string
  date: string
  duration: string
  status: 'completed' | 'failed'
  outputPath: string
}

interface HomeTabState {
  storyText: string
  douyinUrl: string
  selectedVoice: string
}

interface SettingsTabState {
  apiKey: string
  appId: string
  youtubeKey: string
  outputDir: string
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'home' | 'settings' | 'history'>('home')

  // Preserve tab state
  const [homeTabState, setHomeTabState] = useState<HomeTabState>({
    storyText: '',
    douyinUrl: '',
    selectedVoice: 'n_hanoi_female_nguyetnga2_book_vc',
  })

  const [settingsTabState, setSettingsTabState] = useState<SettingsTabState>({
    apiKey: '',
    appId: '',
    youtubeKey: '',
    outputDir: './output',
  })

  const [envConfig, setEnvConfig] = useState<EnvConfig>({})
  const [history, setHistory] = useState<Project[]>([])

  // Load environment variables when component mounts
  useEffect(() => {
    loadEnvConfig()
    loadHistory()
  }, [])

  const loadEnvConfig = async () => {
    try {
      const config = await window.api?.getEnvConfig?.()
      if (config) {
        setEnvConfig(config)
      }
    } catch (error) {
      console.error('Failed to load environment config:', error)
    }
  }

  const loadHistory = async () => {
    try {
      const projects = await window.api?.getProjectHistory?.()
      if (projects) {
        setHistory(projects)
      }
    } catch (error) {
      console.error('Failed to load project history:', error)
    }
  }

  return (
    <div className="dashboard">
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          Tạo Audiobook
        </button>
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Cài Đặt
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Lịch Sử
        </button>
      </div>

      {/* Content Area */}
      <div className="content-area">
        {activeTab === 'home' && (
          <HomeTab state={homeTabState} setState={setHomeTabState} onSuccess={loadHistory} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            state={settingsTabState}
            setState={setSettingsTabState}
            envConfig={envConfig}
          />
        )}
        {activeTab === 'history' && <HistoryTab projects={history} />}
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <span className="status-text">Sẵn sàng</span>
        <span className="status-info">v0.1.0</span>
      </div>
    </div>
  )
}

function HomeTab({
  state,
  setState,
  onSuccess,
}: {
  state: HomeTabState
  setState: (state: HomeTabState) => void
  onSuccess: () => void
}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const logsContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs to bottom when new logs are added
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [logs])

  // Setup global log listener when component mounts
  useEffect(() => {
    const unsubscribe = window.api?.onAppLog?.((log) => {
      const levelEmoji = {
        error: '🔴',
        warn: '🟡',
        info: '🔵',
        debug: '⚪',
      }[log.level] || '⚪'
      const formattedLog = `${levelEmoji} [${log.timestamp.split('T')[1].split('.')[0]}] [${log.module}] ${log.message}`
      setLogs(prev => [...prev, formattedLog])
    })
    return () => unsubscribe?.()
  }, [])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const handleCreateAudiobook = async () => {
    if (!state.storyText.trim()) {
      alert('Vui lòng nhập nội dung truyện')
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setLogs([])

    try {
      addLog('Bắt đầu quy trình tạo audiobook...')

      // Extract project name from first line of story
      const projectName = state.storyText.split('\n')[0].trim() || 'Untitled'

      // Get next video folder (vid_1, vid_2, etc.)
      const { folderPath } = await getNextVideoFolder()
      console.log(`📁 Output folder: ${folderPath}`)

      // Listen for progress updates from Electron main process
      const unsubscribe = window.api?.onPipelineProgress?.((step) => {
        setProgress(step.progress)
        addLog(`[${step.stepName}] ${step.message}`)
      })

      // Call real pipeline orchestration via IPC
      console.log('📱 UI: Sending pipeline config to IPC handler')
      const result = await window.api?.startPipeline?.({
        // Story content
        storyText: state.storyText,
        storyTitle: projectName,

        // Input files from C:\dev\audiobook-uploader\input\
        bannerImagePath: 'C:\\dev\\audiobook-uploader\\input\\image\\video_banner.png',
        cookingVideoPath: 'C:\\dev\\audiobook-uploader\\input\\video\\douyin_video.mp4', // Fallback video
        backgroundMusicPath: 'C:\\dev\\audiobook-uploader\\input\\music\\bg-music.m4a',
        avatarImagePath: 'C:\\dev\\audiobook-uploader\\input\\image\\avatar.png',

        // Output paths (organized by video number: vid_1, vid_2, etc.)
        outputVideoPath: `${folderPath}\\final_video.mp4`,
        outputThumbnailPath: `${folderPath}\\thumbnail.jpg`,

        // Settings
        videoDuration: 60,
        uploadToYoutube: false, // Disabled for now (requires YouTube auth)
        douyinUrl: state.douyinUrl || undefined, // Pass Douyin URL if provided
      })

      console.log('📱 UI: Received result from IPC handler:', result)

      // Cleanup listener
      unsubscribe?.()

      if (result?.success) {
        console.log('✅ UI: Pipeline succeeded')
        setProgress(100)
        addLog('✅ Hoàn thành! Video đã được tạo thành công.')
        addLog(`Video: ${result.videoPath}`)
        addLog(`Thumbnail: ${result.thumbnailPath}`)
        alert('Tạo audiobook thành công!')

        // Call callback to refresh history
        onSuccess()

        // Reset home tab state for next project
        setState({
          storyText: '',
          douyinUrl: '',
          selectedVoice: 'n_hanoi_female_nguyetnga2_book_vc',
        })
      } else {
        console.log('❌ UI: Pipeline failed with error:', result?.error)
        const errorMsg = result?.error || 'Unknown error - Pipeline'
        // Split multiline error messages and add each line
        errorMsg.split('\n').forEach((line, index) => {
          if (index === 0) {
            addLog(`❌ Lỗi: ${line}`)
          } else if (line.trim()) {
            addLog(`   ${line}`)
          }
        })
        alert(`Lỗi:\n${errorMsg}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      // Split multiline error messages and add each line
      errorMsg.split('\n').forEach((line, index) => {
        if (index === 0) {
          addLog(`❌ Lỗi: ${line}`)
        } else if (line.trim()) {
          addLog(`   ${line}`)
        }
      })
      alert(`Lỗi:\n${errorMsg}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="home-tab">
      <div className="form-section">
        <h2>Nội Dung Truyện</h2>
        <textarea
          className="story-input"
          value={state.storyText}
          onChange={(e) => setState({ ...state, storyText: e.target.value })}
          placeholder="Nhập nội dung truyện tại đây... (Có thể dán từ file hoặc trang web)"
          disabled={isProcessing}
        />
        <div className="form-info">{state.storyText.length} ký tự</div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>URL Video Douyin (tùy chọn):</label>
          <input
            type="text"
            className="form-input"
            value={state.douyinUrl}
            onChange={(e) => {
              // Auto-extract Douyin URL from pasted content
              const input = e.target.value
              const extractedUrl = extractDouyinUrlFromText(input) || input
              setState({ ...state, douyinUrl: extractedUrl })
            }}
            placeholder="https://www.douyin.com/... (hoặc dán nội dung chứa link)"
            disabled={isProcessing}
          />
        </div>

        <div className="form-group">
          <label>Chọn Giọng Đọc:</label>
          <select
            className="form-input"
            value={state.selectedVoice}
            onChange={(e) => setState({ ...state, selectedVoice: e.target.value })}
            disabled={isProcessing}
          >
            <option value="n_hanoi_female_nguyetnga2_book_vc">
              🎙️ Nguyệt Nga (Nữ - Audiobook) ⭐
            </option>
            <option value="hn_female_ngochuyen_full_48k-fhg">
              🎙️ Ngọc Huyền (Nữ)
            </option>
            <option value="hn_male_anh_full_48k-fhg">
              🎙️ Anh (Nam)
            </option>
          </select>
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={handleCreateAudiobook}
        disabled={isProcessing || !state.storyText.trim()}
      >
        {isProcessing ? 'Đang Xử Lý...' : '▶️ Tạo Audiobook'}
      </button>

      {isProcessing && (
        <div className="progress-section">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-text">{progress}%</div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="logs-section">
          <h3>Nhật Ký ({logs.length} entries)</h3>
          <div className="logs-container" ref={logsContainerRef}>
            {logs.map((log, idx) => (
              <div key={idx} className="log-line">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsTab({
  state,
  setState,
  envConfig,
}: {
  state: SettingsTabState
  setState: (state: SettingsTabState) => void
  envConfig: EnvConfig
}) {
  const handleSaveSettings = () => {
    alert('Cài đặt đã được lưu!')
  }

  return (
    <div className="settings-tab">
      <div className="settings-group">
        <h3>Vbee TTS API</h3>
        <div className="form-group">
          <label>API Key:</label>
          <input
            type="password"
            className="form-input"
            value={envConfig.VBEE_API_KEY || ''}
            readOnly
            placeholder={envConfig.VBEE_API_KEY ? '(Loaded from .env)' : 'Not configured'}
          />
          <div className="form-info">
            {envConfig.VBEE_API_KEY ? '✓ Configured in .env' : '⚠ Not configured'}
          </div>
        </div>
        <div className="form-group">
          <label>App ID:</label>
          <input
            type="text"
            className="form-input"
            value={envConfig.VBEE_APP_ID || ''}
            readOnly
            placeholder={envConfig.VBEE_APP_ID ? '(Loaded from .env)' : 'Not configured'}
          />
          <div className="form-info">
            {envConfig.VBEE_APP_ID ? '✓ Configured in .env' : '⚠ Not configured'}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3>Gemini API</h3>
        <div className="form-group">
          <label>API Key:</label>
          <input
            type="password"
            className="form-input"
            value={envConfig.GEMINI_API_KEY || ''}
            readOnly
            placeholder={envConfig.GEMINI_API_KEY ? '(Loaded from .env)' : 'Not configured'}
          />
          <div className="form-info">
            {envConfig.GEMINI_API_KEY ? '✓ Configured in .env' : '⚠ Not configured'}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3>Comet API (Nano Banana)</h3>
        <div className="form-group">
          <label>API Key:</label>
          <input
            type="password"
            className="form-input"
            value={envConfig.COMET_API_KEY || ''}
            readOnly
            placeholder={envConfig.COMET_API_KEY ? '(Loaded from .env)' : 'Not configured'}
          />
          <div className="form-info">
            {envConfig.COMET_API_KEY ? '✓ Configured in .env' : '⚠ Not configured'}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <h3>Cài Đặt Chung</h3>
        <div className="form-group">
          <label>Thư Mục Output:</label>
          <input
            type="text"
            className="form-input"
            value={state.outputDir}
            onChange={(e) => setState({ ...state, outputDir: e.target.value })}
            placeholder="Đường dẫn thư mục output"
          />
        </div>
      </div>

      <button className="btn-primary" onClick={handleSaveSettings}>
        💾 Lưu Cài Đặt
      </button>
    </div>
  )
}

function HistoryTab({ projects }: { projects: Project[] }) {
  return (
    <div className="history-tab">
      <h2>Lịch Sử Tạo Audiobook</h2>
      {projects.length === 0 ? (
        <div className="empty-state">
          <p>Chưa có dự án nào. Hãy tạo audiobook đầu tiên của bạn!</p>
        </div>
      ) : (
        <table className="history-table">
          <thead>
            <tr>
              <th>Tên Dự Án</th>
              <th>Ngày Tạo</th>
              <th>Thời Lượng</th>
              <th>Trạng Thái</th>
              <th>Hành Động</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.date}</td>
                <td>{item.duration}</td>
                <td>{item.status === 'completed' ? '✅ Hoàn thành' : '❌ Thất bại'}</td>
                <td>
                  <button className="btn-small" onClick={() => window.shell?.openPath(item.outputPath)}>
                    📁 Mở Thư Mục
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
