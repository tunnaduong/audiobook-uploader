import { useState } from 'react'
import './Dashboard.css'

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'home' | 'settings' | 'history'>('home')

  return (
    <div className="dashboard">
      {/* Menu Bar */}
      <div className="menu-bar">
        <div className="menu-item">File</div>
        <div className="menu-item">Edit</div>
        <div className="menu-item">Help</div>
      </div>

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
        {activeTab === 'home' && <HomeTab />}
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'history' && <HistoryTab />}
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <span className="status-text">Sẵn sàng</span>
        <span className="status-info">v0.1.0</span>
      </div>
    </div>
  )
}

function HomeTab() {
  const [storyText, setStoryText] = useState('')
  const [douyinUrl, setDouyinUrl] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('n_hanoi_female_nguyetnga2_book_vc')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const handleCreateAudiobook = async () => {
    if (!storyText.trim()) {
      alert('Vui lòng nhập nội dung truyện')
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setLogs([])

    try {
      addLog('Bắt đầu quy trình tạo audiobook...')

      // Listen for progress updates from Electron main process
      const unsubscribe = window.api?.onPipelineProgress?.((step) => {
        setProgress(step.progress)
        addLog(`[${step.stepName}] ${step.message}`)
      })

      // Call real pipeline orchestration via IPC
      console.log('📱 UI: Sending pipeline config to IPC handler')
      const result = await window.api?.startPipeline?.({
        // Story content
        storyText,
        storyTitle: storyText.split('\n')[0] || 'Untitled',

        // Input files from C:\dev\audiobook-uploader\input\
        bannerImagePath: 'C:\\dev\\audiobook-uploader\\input\\image\\video_banner.png',
        cookingVideoPath: douyinUrl || 'C:\\dev\\audiobook-uploader\\input\\video\\douyin_video.mp4', // TODO: Implement actual Douyin download
        backgroundMusicPath: 'C:\\dev\\audiobook-uploader\\input\\music\\bg-music.m4a',
        avatarImagePath: 'C:\\dev\\audiobook-uploader\\input\\image\\avatar.png',

        // Output paths
        outputVideoPath: 'C:\\dev\\audiobook-uploader\\output\\final_video.mp4',
        outputThumbnailPath: 'C:\\dev\\audiobook-uploader\\output\\thumbnail.jpg',

        // Settings
        videoDuration: 60,
        uploadToYoutube: false, // Disabled for now (requires YouTube auth)
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
          value={storyText}
          onChange={(e) => setStoryText(e.target.value)}
          placeholder="Nhập nội dung truyện tại đây... (Có thể dán từ file hoặc trang web)"
          disabled={isProcessing}
        />
        <div className="form-info">
          {storyText.length} ký tự
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>URL Video Douyin (tùy chọn):</label>
          <input
            type="text"
            className="form-input"
            value={douyinUrl}
            onChange={(e) => setDouyinUrl(e.target.value)}
            placeholder="https://www.douyin.com/..."
            disabled={isProcessing}
          />
        </div>

        <div className="form-group">
          <label>Chọn Giọng Đọc:</label>
          <select
            className="form-input"
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            disabled={isProcessing}
          >
            <option value="n_hanoi_female_nguyetnga2_book_vc">
              🎙️ Nguyễt Nga (Nữ - Audiobook) ⭐
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
        disabled={isProcessing || !storyText.trim()}
      >
        {isProcessing ? 'Đang Xử Lý...' : '▶️ Tạo Audiobook'}
      </button>

      {isProcessing && (
        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-text">{progress}%</div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="logs-section">
          <h3>Nhật Ký</h3>
          <div className="logs-container">
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

function SettingsTab() {
  const [apiKey, setApiKey] = useState('')
  const [appId, setAppId] = useState('')
  const [youtubeKey, setYoutubeKey] = useState('')
  const [outputDir, setOutputDir] = useState('./output')

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
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Nhập Vbee API Key"
          />
        </div>
        <div className="form-group">
          <label>App ID:</label>
          <input
            type="text"
            className="form-input"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="Nhập Vbee App ID"
          />
        </div>
      </div>

      <div className="settings-group">
        <h3>YouTube API</h3>
        <div className="form-group">
          <label>API Key:</label>
          <input
            type="password"
            className="form-input"
            value={youtubeKey}
            onChange={(e) => setYoutubeKey(e.target.value)}
            placeholder="Nhập YouTube API Key"
          />
        </div>
      </div>

      <div className="settings-group">
        <h3>Cài Đặt Chung</h3>
        <div className="form-group">
          <label>Thư Mục Output:</label>
          <input
            type="text"
            className="form-input"
            value={outputDir}
            onChange={(e) => setOutputDir(e.target.value)}
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

function HistoryTab() {
  const [history] = useState([
    {
      id: 1,
      title: 'Truyện 1: Nàng tiên cá',
      date: '2026-02-18 14:30',
      duration: '45:30',
      status: '✅ Hoàn thành',
    },
    {
      id: 2,
      title: 'Truyện 2: Công chúa mưa',
      date: '2026-02-18 10:15',
      duration: '32:15',
      status: '✅ Hoàn thành',
    },
    {
      id: 3,
      title: 'Truyện 3: Lâu đài ma quái',
      date: '2026-02-17 16:45',
      duration: '58:45',
      status: '✅ Hoàn thành',
    },
  ])

  return (
    <div className="history-tab">
      <h2>Lịch Sử Tạo Audiobook</h2>
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
              <td>{item.date}</td>
              <td>{item.duration}</td>
              <td>{item.status}</td>
              <td>
                <button className="btn-small">Xem</button>
                <button className="btn-small">Xóa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
