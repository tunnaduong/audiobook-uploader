# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Project Rules

- **NEVER proactively create documentation files** (*.md) unless explicitly requested
- **Do what has been asked; nothing more, nothing less**
- **ALWAYS prefer editing existing files to creating new ones**
- **Do not create summary files or progress documentation**


## Essential Project Context

This is an **Electron + React desktop application** for automating audiobook + cooking video content creation (Vietnamese "re-up" format). The app runs a video processing pipeline that combines video composition, AI-generated thumbnails, and YouTube uploads.

**Current Status (Feb 2026):**
- Option 1 implementation complete: Video composition (FFmpeg) + Modern Oriental thumbnail generation (Gemini)
- Real IPC wiring functional and type-safe
- TypeScript strict mode, zero compilation errors
- Blocker: FFmpeg must be installed on user's system (auto-download not yet implemented)

## Development Commands

```bash
# Type checking (zero errors required)
npm run type-check

# Development server (Vite + Electron in same window)
npm run dev

# Build for Windows or macOS
npm run build:win
npm run build:mac

# Build only (no packaging)
npm run build

# Electron main process compilation
npm run build:electron

# React app compilation
npm run build:renderer

# Testing
npm run test
```

## Architecture Overview

### IPC Communication Bridge (Critical)
The app uses **Electron IPC** for type-safe communication between React UI and Electron main process:

1. **React Component** → `window.api.startPipeline(config)` (renderer/preload.ts)
2. **IPC Handler** → `electron/events.ts` validates and calls services
3. **Services** → `src/services/` execute real work (FFmpeg, Gemini API, etc.)
4. **Progress Callbacks** → `mainWindow.webContents.send('pipeline-progress', ...)` updates UI in real-time

**Key Files:**
- `electron/preload.ts` - Exposes type-safe API to React
- `electron/events.ts` - IPC handler implementation (where main logic orchestration happens)
- `src/types/index.ts` - `ElectronAPI`, `PipelineConfig`, `PipelineResult` type definitions
- `src/components/Dashboard.tsx` - UI component that calls `window.api.startPipeline()`

### Pipeline Architecture (Core Logic)
```
User clicks button (Dashboard.tsx)
    ↓
window.api.startPipeline(PipelineConfig) [IPC call]
    ↓
electron/events.ts 'start-pipeline' handler
    ↓
src/services/pipeline.ts: executePipeline()
    ├─ Step 1: Validate input files
    ├─ Step 2: composeBannerVideo() [FFmpeg service]
    ├─ Step 3: generateModernOrientalThumbnail() [Gemini service]
    └─ Step 4: uploadVideo() [YouTube service, optional]
    ↓ (real-time progress via IPC)
Return PipelineResult { success, videoPath, thumbnailPath, error }
    ↓
Dashboard displays actual results or error messages
```

### Service Layer Organization

Each service is **self-contained with specific responsibilities**:

- **`src/services/pipeline.ts`** - Orchestration: Calls other services in sequence, manages progress tracking, error handling
- **`src/services/ffmpeg.ts`** - Video composition using FFmpeg filter graphs
  - `composeBannerVideo()`: Overlays cooking video on banner with music
  - Uses hardware acceleration (h264_videotoolbox on macOS, h264_qsv on Windows, libx264 fallback)
- **`src/services/gemini.ts`** - Thumbnail generation via Google Generative AI
  - `generateModernOrientalThumbnail()`: Uses Imagen 3.0 with detailed design prompt
  - Color spec: Deep Red #990000, Slate Blue #5D7B93, cream background
- **`src/services/youtube.ts`** - YouTube upload (prepared, currently optional)
- **`src/services/vbee.ts`** - TTS conversion (prepared, not in Option 1)
- **`src/services/douyin.ts`** - Douyin download via yt-dlp (prepared, not in Option 1)

## Type Safety Requirements

**Strict TypeScript Mode Enabled** - All files must pass `npm run type-check` with zero errors.

### Critical Type Definitions to Maintain

**IPC Data Flow:**
```typescript
// UI sends this to IPC handler
interface PipelineConfig {
  storyText: string
  storyTitle: string
  bannerImagePath: string
  cookingVideoPath: string
  backgroundMusicPath: string
  avatarImagePath: string
  outputVideoPath: string
  outputThumbnailPath: string
  videoDuration?: number
  uploadToYoutube?: boolean
  youtubeAccessToken?: string
}

// IPC handler returns this to UI
interface PipelineResult {
  success: boolean
  videoPath?: string
  thumbnailPath?: string
  youtubeResult?: YouTubeUploadResult
  error?: string
  steps: PipelineStep[]
}

// Real-time progress events sent to UI
interface PipelineProgress {
  stepName: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number  // 0-100
  message: string
  error?: string
}
```

**Type Verification Rule:** When modifying IPC handler or services, verify types match at every layer:
- UI passes `PipelineConfig` → Handler receives `PipelineConfig`
- Handler returns `PipelineResult` → UI expects `PipelineResult`
- Services send `PipelineProgress` via callback → UI listener expects `PipelineProgress`

## Key Design Patterns

### 1. Error Handling & Propagation
- Errors thrown in services are caught by pipeline orchestrator
- Pipeline returns `PipelineResult { success: false, error: "..." }` to IPC handler
- IPC handler logs to Electron console and returns same result to UI
- UI displays multiline error messages with proper formatting

**When adding new error:** Always ensure error message is propagated through all layers (service → pipeline → handler → UI)

### 2. Progress Tracking
- Services execute long operations (FFmpeg, Gemini API calls)
- Pipeline calls `onProgress?.()` callback after each step
- Callback data sent via IPC to UI which updates progress bar and logs
- This creates real-time user feedback (not instant/mocked)

**When adding new step:**
1. Create PipelineStep object with status='in_progress'
2. Call `onProgress?.(step)`
3. Update step.status and message when complete
4. Call `onProgress?.()` again with updated step

### 3. Logging Strategy
- **Browser console (F12):** React component logs (UI-centric)
- **Electron console (Ctrl+Shift+I in app):** Main process logs (backend execution)
- Use `createLogger('module-name')` from `src/utils/logger.ts` for structured logging
- Prefix logs with emojis (🔵 starting, 🟢 success, 🔴 error, 📊 progress, 📁 files, etc.)

**When debugging:** Always check **Electron console** for actual service errors, not browser console

## File Structure Reference

```
electron/
  ├── main.ts           # App initialization, window creation
  ├── events.ts         # IPC handlers - orchestrates services
  ├── preload.ts        # Security bridge exposing API to React
  └── utils.ts          # Platform detection, utilities

src/
  ├── services/
  │   ├── pipeline.ts     # Main orchestration (executePipeline)
  │   ├── ffmpeg.ts       # Video composition (composeBannerVideo)
  │   ├── gemini.ts       # Thumbnail generation (generateModernOrientalThumbnail)
  │   ├── youtube.ts      # Video upload (uploadVideo)
  │   ├── vbee.ts         # TTS (prepared, not in Option 1)
  │   └── douyin.ts       # Video download (prepared, not in Option 1)
  │
  ├── components/
  │   └── Dashboard.tsx   # Main UI component calling window.api.startPipeline()
  │
  ├── utils/
  │   ├── ffmpeg-setup.ts # FFmpeg path detection (throws detailed error if not found)
  │   ├── logger.ts       # Logging utility
  │   ├── database.ts     # SQLite operations
  │   └── ytdlp-setup.ts  # yt-dlp path detection
  │
  └── types/
      └── index.ts        # All TypeScript interfaces including ElectronAPI
```

## Common Tasks & Troubleshooting

### Adding a New Service Function
1. Create async function in appropriate `src/services/*.ts` file
2. Define strict input/output types
3. Add logging at start and end
4. Handle errors with try-catch, throw with descriptive message
5. Call from `pipeline.ts` executePipeline function
6. Update PipelineStep tracking in pipeline.ts
7. Run `npm run type-check` - must pass with zero errors

### Fixing IPC Communication Issues
1. Check if types match between preload.ts (exposed API) and Dashboard.tsx (usage)
2. Verify `electron/events.ts` handler accepts correct parameter type
3. Ensure handler returns correct PipelineResult shape
4. Add console.log debugging in both electron/events.ts (backend) and Dashboard.tsx (frontend)
5. Check **Electron console** (Ctrl+Shift+I in app window) for actual errors

### Debugging Pipeline Execution
1. Set breakpoints in Electron console or add console.log statements
2. Check FFmpeg availability: `ffmpeg -version` in command prompt
3. Verify input files exist at paths specified in PipelineConfig
4. Check Electron console for detailed error messages (prefixed with 🔴)
5. Verify GEMINI_API_KEY environment variable is set for thumbnail generation

### Modifying Error Messages
- Error messages thrown in services automatically propagate through pipeline and IPC
- Update ffmpeg-setup.ts getFFmpegPath() for FFmpeg-specific errors
- Error messages should be multiline-safe (code splits on '\n' and indents continuation lines)

## TypeScript Configuration

- **`tsconfig.json`** - React/frontend TypeScript
- **`tsconfig.electron.json`** - Electron main process TypeScript
  - Module system: **CommonJS** (not ES2020)
  - This is critical - Electron main process needs CommonJS output

When modifying TypeScript config, remember the split: React uses ES modules, Electron uses CommonJS.

## Build Process Details

1. **Development:** `npm run dev` runs Vite dev server on port 5173 + Electron in same window
2. **Production Build:**
   - Compile Electron main: `tsc --project tsconfig.electron.json` → `dist/electron/*.js`
   - Bundle React: `vite build` → `dist/renderer/*`
   - Package app: `electron-builder` → distributable executable

Build must pass TypeScript checking. If build fails, `npm run type-check` will show errors.

## Platform-Specific Notes

### FFmpeg Encoding
- **macOS:** Uses `h264_videotoolbox` (hardware acceleration, fastest)
- **Windows:** Detects `h264_qsv` (Intel Quick Sync) if available
- **Fallback:** `libx264` (software encoding, slower)

Auto-detection in `src/services/ffmpeg.ts` getVideoEncoder() function.

### Windows PATH Considerations
- FFmpeg path detection tries three methods in order:
  1. Bundled FFmpeg at `~/.audiobook-uploader/bin/ffmpeg.exe`
  2. Global PATH: `ffmpeg` command
  3. Throw detailed error with installation instructions
- Auto-download not yet implemented

## When Continuing Development

1. **First:** Run `npm run type-check` to verify current state
2. **Understand:** The IPC layer (preload → handler → services) before making changes
3. **Test changes:** Always verify with `npm run type-check` and `npm run build:electron && npm run build:renderer`
4. **Look in right place:** UI issues in browser console, backend issues in Electron console
5. **Error propagation:** Trace errors through all three layers (service → pipeline → IPC handler → UI)

The architecture is designed for clear separation between UI, orchestration, and services with type-safe IPC communication.
