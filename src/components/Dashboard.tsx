import { useState, useEffect, useRef } from 'react'
import type { EpubMetadata } from '../types'
import { EpubImporter } from './EpubImporter'
import { ChapterSelector } from './ChapterSelector'
import './Dashboard.css'

// Helper function to extract and format chapter information from story text
function extractChapterInfo(storyText: string): {
  baseTitle: string
  displayTitle: string
  chapterNumbers: number[]
} {
  const lines = storyText.split('\n').map(l => l.trim()).filter(l => l)
  const firstLine = lines[0] || ''

  // Try to extract base title and chapter number from first line
  // Patterns: "Tiêu đề - Chương 1", "Tiêu đề Chương 1", "Chương 1: Tiêu đề", "Tiêu đề (chương 1 và 2)"
  let baseTitle = firstLine
  let chapterNumbers: number[] = []

  // Pattern 1: "Chương N: Title" or "Chương N - Title" (at start)
  const pattern1 = /^Chương\s+(\d+)[\s:-]/i
  const match1 = firstLine.match(pattern1)
  if (match1) {
    const chapterNum = parseInt(match1[1])
    chapterNumbers.push(chapterNum)
    baseTitle = firstLine.replace(/^Chương\s+\d+[\s:-]/i, '').trim()
  } else {
    // Pattern 2: "Title (chương N và M)" or "Title (chương N, M)" - parenthetical format
    const pattern2 = /(.+?)\s*\(\s*chương\s+(.+?)\s*\)/i
    const match2 = firstLine.match(pattern2)
    if (match2) {
      baseTitle = match2[1].trim()
      // Extract numbers from the parenthetical content (e.g., "1 và 2" or "1, 2" or "1-2")
      const chaptersStr = match2[2]
      const numbers = chaptersStr.match(/\d+/g) || []
      numbers.forEach(num => {
        const chapterNum = parseInt(num)
        if (!chapterNumbers.includes(chapterNum)) {
          chapterNumbers.push(chapterNum)
        }
      })
    } else {
      // Pattern 3: "Title - Chương N" or "Title Chương N" (at end, non-parenthetical)
      // Use word boundary to ensure we match "Chương" as a word
      const pattern3 = /(.+?)[\s-]*\bChương\s+(\d+)\b/i
      const match3 = firstLine.match(pattern3)
      if (match3) {
        baseTitle = match3[1].trim()
        chapterNumbers.push(parseInt(match3[2]))
      }
    }
  }

  // Look for more chapter numbers in the content
  const fullText = storyText.toLowerCase()
  const chaptersInContent = fullText.match(/\bchương\s+(\d+)\b/gi) || []
  const uniqueChapters = new Set<number>()
  chaptersInContent.forEach(ch => {
    const num = parseInt(ch.match(/\d+/)![0])
    uniqueChapters.add(num)
  })

  // Merge found chapters
  uniqueChapters.forEach(num => {
    if (!chapterNumbers.includes(num)) {
      chapterNumbers.push(num)
    }
  })

  // Sort chapter numbers
  chapterNumbers.sort((a, b) => a - b)

  // Format display title
  let displayTitle = baseTitle
  if (chapterNumbers.length > 0) {
    if (chapterNumbers.length === 1) {
      displayTitle = `${baseTitle} - Chương ${chapterNumbers[0]}`
    } else if (chapterNumbers.length === 2) {
      displayTitle = `${baseTitle} - Chương ${chapterNumbers[0]}-${chapterNumbers[1]}`
    } else {
      displayTitle = `${baseTitle} - Chương ${chapterNumbers[0]}-${chapterNumbers[chapterNumbers.length - 1]}`
    }
  }

  return { baseTitle, displayTitle, chapterNumbers }
}

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
  // EPUB import state
  epubFilePath?: string
  epubMetadata?: EpubMetadata
  epubTitle?: string
  selectedChapters?: Set<number>
  useEpubInput: boolean
  // Reuse options
  reuseExistingThumbnail: boolean
}

interface SettingsTabState {
  apiKey: string
  appId: string
  youtubeKey: string
  outputDir: string
  youtubeUploadByDefault?: boolean
  youtubeVisibility?: 'public' | 'private' | 'unlisted'
  youtubeCategory?: number
  // Intro settings
  introTemplate: string
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'home' | 'settings' | 'history'>('home')

  // Preserve tab state
  const [homeTabState, setHomeTabState] = useState<HomeTabState>({
    storyText: '',
    douyinUrl: '',
    selectedVoice: 'n_hanoi_female_nguyetnga2_book_vc',
    epubFilePath: undefined,
    epubMetadata: undefined,
    epubTitle: undefined,
    selectedChapters: undefined,
    useEpubInput: false,
    reuseExistingThumbnail: true,
  })

  const [settingsTabState, setSettingsTabState] = useState<SettingsTabState>({
    apiKey: '',
    appId: '',
    youtubeKey: '',
    outputDir: './output',
    youtubeUploadByDefault: false,
    youtubeVisibility: 'public',
    youtubeCategory: 24,
    introTemplate: 'Truyện tiểu thuyết: {bookTitle} (chương {chapters})\nĐăng tải bởi đội ngũ Thính Phong Tiểu Thuyết Audio',
  })

  const [envConfig, setEnvConfig] = useState<EnvConfig>({})
  const [history, setHistory] = useState<Project[]>([])
  const [youtubeAuthenticating, setYoutubeAuthenticating] = useState(false)
  const [youtubeAuthenticated, setYoutubeAuthenticated] = useState(false)

  // Persist logs at dashboard level so they don't get cleared when switching tabs
  const [persistedLogs, setPersistedLogs] = useState<string[]>([])

  // Load environment variables when component mounts
  useEffect(() => {
    loadEnvConfig()
    loadHistory()
    loadYouTubeSettings()
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

  const loadYouTubeSettings = async () => {
    try {
      const settings = await window.api?.getYouTubeSettings?.()
      if (settings) {
        setYoutubeAuthenticated(settings.isAuthenticated)
        setSettingsTabState((prev) => ({
          ...prev,
          youtubeUploadByDefault: settings.uploadByDefault,
          youtubeVisibility: settings.videoVisibility,
          youtubeCategory: settings.defaultCategory,
        }))
      }
    } catch (error) {
      console.error('Failed to load YouTube settings:', error)
    }
  }

  const handleYouTubeLogin = async () => {
    setYoutubeAuthenticating(true)
    try {
      const result = await window.api?.youtubeLogin?.()
      if (result?.success) {
        setYoutubeAuthenticated(true)
        alert(`✅ YouTube account connected: ${result.channelTitle}`)
      } else {
        alert(`❌ YouTube login failed: ${result?.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to authenticate with YouTube:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setYoutubeAuthenticating(false)
    }
  }

  const handleYouTubeLogout = async () => {
    try {
      const result = await window.api?.youtubeLogout?.()
      if (result?.success) {
        setYoutubeAuthenticated(false)
        alert('✅ YouTube account disconnected')
      } else {
        alert(`❌ Logout failed: ${result?.error}`)
      }
    } catch (error) {
      console.error('Failed to logout from YouTube:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : String(error)}`)
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
          <HomeTab
            state={homeTabState}
            setState={setHomeTabState}
            onSuccess={loadHistory}
            persistedLogs={persistedLogs}
            setPersistedLogs={setPersistedLogs}
            youtubeAuthenticated={youtubeAuthenticated}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            state={settingsTabState}
            setState={setSettingsTabState}
            envConfig={envConfig}
            youtubeAuthenticated={youtubeAuthenticated}
            youtubeAuthenticating={youtubeAuthenticating}
            onYouTubeLogin={handleYouTubeLogin}
            onYouTubeLogout={handleYouTubeLogout}
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
  persistedLogs,
  setPersistedLogs,
  youtubeAuthenticated,
}: {
  state: HomeTabState
  setState: (state: HomeTabState) => void
  onSuccess: () => void
  persistedLogs: string[]
  setPersistedLogs: (logs: string[] | ((prev: string[]) => string[])) => void
  youtubeAuthenticated: boolean
}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadToYoutube, setUploadToYoutube] = useState(false)
  const [showEpubImporter, setShowEpubImporter] = useState(false)
  const [showChapterSelector, setShowChapterSelector] = useState(false)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs to bottom when new logs are added
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [persistedLogs])

  // Setup global log listener when component mounts (only once)
  useEffect(() => {
    const unsubscribe = window.api?.onAppLog?.((log) => {
      const levelEmoji = {
        error: '🔴',
        warn: '🟡',
        info: '🔵',
        debug: '⚪',
      }[log.level] || '⚪'
      const formattedLog = `${levelEmoji} [${log.timestamp.split('T')[1].split('.')[0]}] [${log.module}] ${log.message}`
      // Use functional update to avoid dependency on persistedLogs
      setPersistedLogs((prev: string[]) => [...prev, formattedLog])
    })
    return () => unsubscribe?.()
  }, []) // Empty deps - only setup once on mount

  const addLog = (message: string) => {
    setPersistedLogs((prev: string[]) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const handleEpubLoaded = (metadata: EpubMetadata) => {
    setState({
      ...state,
      epubFilePath: metadata.title,
      epubMetadata: metadata,
      epubTitle: metadata.title,
      useEpubInput: true,
    })
    setShowEpubImporter(false)
    setShowChapterSelector(true)
  }

  const handleChaptersSelected = (selectedChapters: number[], renumbering?: { [originalNumber: number]: number }) => {
    // Aggregate selected chapters into story text
    if (state.epubMetadata) {
      const selected = state.epubMetadata.chapters
        .filter(ch => selectedChapters.includes(ch.number))
        .sort((a, b) => a.number - b.number)

      const aggregatedText = selected
        .map(ch => {
          const newChapterNum = renumbering?.[ch.number] ?? ch.number
          return `Chương ${newChapterNum}: ${ch.title}\n\n${ch.content}`
        })
        .join('\n\n---\n\n')

      setState({
        ...state,
        storyText: aggregatedText,
        selectedChapters: new Set(selectedChapters),
      })
      setShowChapterSelector(false)
      addLog(`📚 Đã chọn ${selectedChapters.length} chương từ EPUB`)
      if (renumbering && Object.keys(renumbering).length > 0) {
        const firstChapter = Object.values(renumbering)[0]
        if (firstChapter !== 1) {
          addLog(`🔢 Chương được đánh số lại từ: ${firstChapter}`)
        }
      }
    }
  }

  const handleCreateAudiobook = async () => {
    if (!state.storyText.trim()) {
      alert('Vui lòng nhập nội dung truyện')
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setPersistedLogs([]) // Clear logs for fresh start (but persisted in parent state)

    try {
      addLog('Bắt đầu quy trình tạo audiobook...')

      // Determine project name: use EPUB title if available, otherwise extract from story text
      let projectName = 'Untitled'
      let chapterInfo: ReturnType<typeof extractChapterInfo> | null = null

      if (state.useEpubInput && state.epubTitle) {
        // EPUB input: use EPUB title directly
        projectName = state.epubTitle
        addLog(`📚 Tiêu đề EPUB: ${projectName}`)
        // Still extract chapter numbers from story text for logging
        chapterInfo = extractChapterInfo(state.storyText)
      } else {
        // Manual input: extract chapter info from story text
        chapterInfo = extractChapterInfo(state.storyText)
        projectName = chapterInfo.displayTitle || 'Untitled'
        console.log(`📚 Story Info:`, chapterInfo)
        addLog(`📚 Tiêu đề: ${projectName}`)
      }

      if (chapterInfo && chapterInfo.chapterNumbers.length > 0) {
        addLog(`📖 Chương: ${chapterInfo.chapterNumbers.join(', ')}`)
      }

      // Get next video folder (vid_1, vid_2, etc.) - uses main process to access filesystem
      const { folderPath } = await window.api?.getNextVideoFolder?.() || { folderPath: 'C:\\dev\\audiobook-uploader\\output\\vid_1' }
      console.log(`📁 Output folder: ${folderPath}`)
      addLog(`📁 Sử dụng thư mục: ${folderPath}`)

      // Default intro template
      const defaultIntroTemplate = 'Truyện tiểu thuyết: {bookTitle} (chương {chapters})\nĐăng tải bởi đội ngũ Thính Phong Tiểu Thuyết Audio'

      // Generate intro text from template
      let introText = ''
      const chaptersText = chapterInfo && chapterInfo.chapterNumbers.length > 0
        ? chapterInfo.chapterNumbers.slice(0, -1).join(', ') +
          (chapterInfo.chapterNumbers.length > 1 ? ' và ' : '') +
          chapterInfo.chapterNumbers[chapterInfo.chapterNumbers.length - 1]
        : ''

      introText = defaultIntroTemplate
        .replace('{bookTitle}', projectName)
        .replace('{chapters}', chaptersText)

      // Prepend intro to story text
      const finalStoryText = `${introText}\n\n${state.storyText}`

      // Listen for progress updates from Electron main process
      const unsubscribe = window.api?.onPipelineProgress?.((step) => {
        setProgress(step.progress)
        addLog(`[${step.stepName}] ${step.message}`)
      })

      // Call real pipeline orchestration via IPC
      console.log('📱 UI: Sending pipeline config to IPC handler')
      const result = await window.api?.startPipeline?.({
        // Story content
        storyText: finalStoryText,
        storyTitle: projectName,

        // Input files from C:\dev\audiobook-uploader\input\
        bannerImagePath: 'C:\\dev\\audiobook-uploader\\input\\image\\video_banner.png',
        cookingVideoPath: 'C:\\dev\\audiobook-uploader\\input\\video\\douyin_video.mp4', // Fallback video
        backgroundMusicPath: 'C:\\dev\\audiobook-uploader\\input\\music\\bg-music.m4a',
        avatarImagePath: 'C:\\dev\\audiobook-uploader\\input\\image\\avatar.png',
        referenceImagePath: 'C:\\dev\\audiobook-uploader\\input\\image\\reference_2.jpg', // Story cover reference for thumbnail

        // Output paths (organized by video number: vid_1, vid_2, etc.)
        outputVideoPath: `${folderPath}\\final_video.mp4`,
        outputThumbnailPath: `${folderPath}\\thumbnail.jpg`,

        // Voice settings
        voiceId: state.selectedVoice,

        // Settings
        videoDuration: 60,
        uploadToYoutube: uploadToYoutube && youtubeAuthenticated,
        douyinUrl: state.douyinUrl || undefined, // Pass Douyin URL if provided
        resumeOnExist: true, // Skip steps if files already exist
        reuseExistingThumbnail: state.reuseExistingThumbnail, // Reuse existing thumbnail if checked
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
          epubFilePath: undefined,
          epubMetadata: undefined,
          epubTitle: undefined,
          selectedChapters: undefined,
          useEpubInput: false,
          reuseExistingThumbnail: true,
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
      {/* EPUB Importer Modal */}
      {showEpubImporter && (
        <div className="epub-modal-overlay">
          <div className="epub-modal">
            <EpubImporter
              onEpubLoaded={handleEpubLoaded}
              onClose={() => setShowEpubImporter(false)}
            />
          </div>
        </div>
      )}

      {/* Chapter Selector Modal */}
      {showChapterSelector && state.epubMetadata && (
        <div className="epub-modal-overlay">
          <div className="epub-modal">
            <ChapterSelector
              metadata={state.epubMetadata}
              onConfirm={handleChaptersSelected}
              onClose={() => setShowChapterSelector(false)}
            />
          </div>
        </div>
      )}

      {/* EPUB/Manual Input Toggle */}
      <div className="input-mode-selector">
        <button
          className={`mode-button ${!state.useEpubInput ? 'active' : ''}`}
          onClick={() => setState({ ...state, useEpubInput: false })}
          disabled={isProcessing}
        >
          ✏️ Nhập Thủ Công
        </button>
        <button
          className={`mode-button ${state.useEpubInput ? 'active' : ''}`}
          onClick={() => setState({ ...state, useEpubInput: true })}
          disabled={isProcessing}
        >
          📖 Nhập từ EPUB
        </button>
      </div>

      {/* Manual Input Section */}
      {!state.useEpubInput && (
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
      )}

      {/* EPUB Input Section */}
      {state.useEpubInput && (
        <div className="form-section">
          <h2>Tệp EPUB</h2>
          {!state.epubMetadata ? (
            <div className="epub-input-container">
              <button
                className="btn-select-epub"
                onClick={() => setShowEpubImporter(true)}
                disabled={isProcessing}
              >
                📖 Chọn Tệp EPUB
              </button>
              <p className="epub-help-text">Nhấp để chọn tệp EPUB từ máy tính của bạn</p>
            </div>
          ) : (
            <div className="epub-loaded-container">
              <div className="epub-file-info">
                <strong>Tệp đã tải:</strong> {state.epubMetadata.title}
                {state.epubMetadata.author && <div className="epub-author">Tác giả: {state.epubMetadata.author}</div>}
                <div className="epub-chapters">Tổng số chương: {state.epubMetadata.chapters.length}</div>
              </div>
              {state.selectedChapters && state.selectedChapters.size > 0 ? (
                <div className="epub-selection-info">
                  <strong>Chương đã chọn:</strong> {Array.from(state.selectedChapters).sort((a, b) => a - b).join(', ')}
                  <div className="selected-count">({state.selectedChapters.size} chương)</div>
                </div>
              ) : (
                <p className="epub-no-selection">Chưa chọn chương nào</p>
              )}
              <div className="epub-action-buttons">
                <button
                  className="btn-secondary"
                  onClick={() => setShowChapterSelector(true)}
                  disabled={isProcessing}
                >
                  📋 Chọn Chương
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setState({
                      ...state,
                      epubFilePath: undefined,
                      epubMetadata: undefined,
                      epubTitle: undefined,
                      selectedChapters: undefined,
                      storyText: '',
                    })
                  }}
                  disabled={isProcessing}
                >
                  🔄 Tải EPUB Khác
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
            <option value="n_hanam_male_tunna_zero_shot_story_vc">
              🎙️ Tunna (Nam)
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

      <div className="form-section">
        <h3>⚙️ Upload Options</h3>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={uploadToYoutube}
              onChange={(e) => setUploadToYoutube(e.target.checked)}
              disabled={!youtubeAuthenticated || isProcessing}
            />
            <span> 🎬 Upload to YouTube</span>
          </label>
          {!youtubeAuthenticated && (
            <div className="form-info">
              Connect YouTube in Settings to enable auto-upload
            </div>
          )}
      {/* Reuse Options */}
      <div className="form-section">
        <h3>⚙️ Tùy Chọn Tạo Video</h3>
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={state.reuseExistingThumbnail}
              onChange={(e) => setState({ ...state, reuseExistingThumbnail: e.target.checked })}
              disabled={isProcessing}
            />
            <span>🖼️ Tái sử dụng ảnh AI đã tạo (bỏ qua Gemini)</span>
          </label>
          <small className="checkbox-help">Nếu chọn, sẽ dùng thumbnail.jpg có sẵn, không tạo ảnh mới</small>
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

      {persistedLogs.length > 0 && (
        <div className="logs-section">
          <h3>Nhật Ký ({persistedLogs.length} entries)</h3>
          <div className="logs-container" ref={logsContainerRef}>
            {persistedLogs.map((log: string, idx: number) => (
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
  youtubeAuthenticated,
  youtubeAuthenticating,
  onYouTubeLogin,
  onYouTubeLogout,
}: {
  state: SettingsTabState
  setState: (state: SettingsTabState) => void
  envConfig: EnvConfig
  youtubeAuthenticated: boolean
  youtubeAuthenticating: boolean
  onYouTubeLogin: () => void
  onYouTubeLogout: () => void
}) {
  const handleSaveSettings = () => {
    alert('Cài đặt đã được lưu!')
  }

  return (
    <div className="settings-tab">
      <div className="settings-group">
        <h3>🎬 YouTube Upload Settings</h3>
        {youtubeAuthenticated ? (
          <>
            <div className="form-group">
              <p className="form-info" style={{ color: '#27ae60', fontSize: '16px' }}>
                ✅ Connected to YouTube
              </p>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={state.youtubeUploadByDefault || false}
                  onChange={(e) =>
                    setState({ ...state, youtubeUploadByDefault: e.target.checked })
                  }
                />
                <span> Auto-upload videos after creation</span>
              </label>
            </div>
            <div className="form-group">
              <label>Video Visibility:</label>
              <select
                className="form-input"
                value={state.youtubeVisibility || 'public'}
                onChange={(e) =>
                  setState({
                    ...state,
                    youtubeVisibility: e.target.value as 'public' | 'private' | 'unlisted',
                  })
                }
              >
                <option value="public">🌍 Public (anyone can find)</option>
                <option value="unlisted">🔗 Unlisted (share link only)</option>
                <option value="private">🔒 Private (only me)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Category:</label>
              <select
                className="form-input"
                value={state.youtubeCategory || 24}
                onChange={(e) =>
                  setState({ ...state, youtubeCategory: parseInt(e.target.value) })
                }
              >
                <option value="24">Entertainment</option>
                <option value="26">Howto & Style</option>
                <option value="20">Short Movies</option>
                <option value="27">Education</option>
              </select>
            </div>
            <button
              className="btn-primary"
              onClick={onYouTubeLogout}
              style={{ backgroundColor: '#e74c3c' }}
            >
              🔓 Disconnect YouTube
            </button>
          </>
        ) : (
          <>
            <div className="form-group">
              <p className="form-info" style={{ fontSize: '16px' }}>
                Connect your YouTube account to enable auto-upload
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={onYouTubeLogin}
              disabled={youtubeAuthenticating}
              style={{ backgroundColor: '#e74c3c' }}
            >
              {youtubeAuthenticating ? '🔄 Connecting...' : '🔐 Sign in with Google'}
            </button>
            <p className="form-info">You'll be directed to Google's login page. No password stored locally.</p>
          </>
        )}
      </div>

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

      <div className="settings-group">
        <h3>📝 Intro Voiceover</h3>
        <div className="form-group">
          <label>Template Intro:</label>
          <textarea
            className="form-input intro-textarea"
            value={state.introTemplate}
            onChange={(e) => setState({ ...state, introTemplate: e.target.value })}
            placeholder="Intro template..."
            rows={4}
          />
          <div className="form-info">
            <strong>Biến có sẵn:</strong>
            <br />• {'{bookTitle}'} - Tên truyện
            <br />• {'{chapters}'} - Danh sách chương (vd: Chương 1, 2 và 3)
            <br />
            <br />
            <strong>Ví dụ:</strong>
            <br />
            Truyện tiểu thuyết: {'{bookTitle}'} (chương {'{chapters}'})<br />
            Đăng tải bởi đội ngũ Thính Phong Tiểu Thuyết Audio
          </div>
        </div>
      </div>

      <button className="btn-primary" onClick={handleSaveSettings}>
        💾 Lưu Cài Đặt
      </button>
    </div>
  )
}

function HistoryTab({ projects }: { projects: Project[] }) {
  const handleOpenFolder = async (outputPath: string) => {
    try {
      await window.api?.openPath?.(outputPath)
    } catch (error) {
      console.error('Failed to open folder:', error)
      alert('Không thể mở thư mục: ' + (error instanceof Error ? error.message : String(error)))
    }
  }

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
                  <button className="btn-small" onClick={() => handleOpenFolder(item.outputPath)}>
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
