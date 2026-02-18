# 🎙️ Audiobook Uploader - Desktop Application

> Automate Vietnamese audiobook creation with cooking videos using Vbee TTS, FFmpeg, and YouTube API

## 🚀 Current Status

### ✅ Phase 1-4 Complete
- **UI/UX:** Complete with WinForm-style interface
- **Project Structure:** Fully organized
- **Build System:** Vite + Electron configured
- **Backend Services:** All implemented (not yet wired to UI)

### 🔄 Next: Backend Integration
- Connect UI to actual API calls
- Implement progress tracking
- Add error handling

---

## 📋 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your API keys
```

### Development
```bash
# Start Vite dev server
npm run dev
# Open http://localhost:5173

# Compile Electron in another terminal
npm run build:electron
```

### Production Build
```bash
npm run build
```

---

## 🎨 User Interface

The application features a classic Windows Forms-style interface with three main tabs:

### 1. 📝 Tạo Audiobook (Create Audiobook)
- Paste your story text
- Select Vietnamese voice (Nguyễt Nga audiobook-optimized ⭐)
- Optional: Input Douyin video URL
- Real-time progress tracking
- Live execution logs

### 2. ⚙️ Cài Đặt (Settings)
- Configure Vbee API credentials
- YouTube API key
- Output directory
- Save and persist settings

### 3. 📚 Lịch Sử (History)
- View all audiobook projects
- See creation date and duration
- Delete old projects
- One-click access to outputs

---

## 🔧 Architecture

```
Electron Main Process (Node.js)
        ↕ IPC
React UI (TypeScript)
        ↕
Backend Services
  ├─ Vbee TTS API
  ├─ FFmpeg Video Composition
  ├─ YouTube Upload
  ├─ Douyin Video Download
  └─ SQLite Database
```

---

## 📦 Key Technologies

| Component | Technology |
|-----------|-----------|
| **Desktop** | Electron 27 |
| **Frontend** | React 18 + TypeScript |
| **Build** | Vite 5 |
| **TTS** | Vbee API |
| **Video** | FFmpeg |
| **Database** | SQLite (sql.js) |
| **YouTube** | Data API v3 |

---

## 📚 Documentation

- **[DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md)** - Full project status
- **[BACKEND_INTEGRATION_GUIDE.md](./BACKEND_INTEGRATION_GUIDE.md)** - Integration steps
- **[VBEE_API_INTEGRATION.md](./VBEE_API_INTEGRATION.md)** - TTS API reference
- **[VBEE_USAGE_EXAMPLE.md](./VBEE_USAGE_EXAMPLE.md)** - Code examples
- **[UI_INTEGRATION_COMPLETE.md](./UI_INTEGRATION_COMPLETE.md)** - UI implementation details

---

## 🎯 Features

### Implemented ✅
- [x] WinForm-style UI
- [x] Tab-based navigation
- [x] Story text input
- [x] Voice selection
- [x] Settings management
- [x] Project history
- [x] Progress tracking
- [x] Real-time logs

### In Development 🔄
- [ ] Vbee TTS integration
- [ ] FFmpeg video composition
- [ ] Douyin video download
- [ ] YouTube upload
- [ ] Thumbnail generation

### Planned 📋
- [ ] Batch processing
- [ ] Custom templates
- [ ] Advanced filters
- [ ] Auto-retry logic
- [ ] Cloud sync

---

## 💡 Usage Example

```typescript
// Automatic audiobook creation workflow:
1. Input story text → "Chương 1: Ngày xưa có một cô gái..."
2. Select voice → Nguyễt Nga (audiobook-optimized)
3. Click "Tạo Audiobook"
4. System automatically:
   - Downloads cooking video from Douyin
   - Converts text to speech via Vbee
   - Composes video with FFmpeg
   - Generates thumbnail
   - Uploads to YouTube
5. Get YouTube link + video ID
```

---

## 🛠 Development Commands

```bash
# Start development
npm run dev

# Compile Electron
npm run build:electron

# Build React
npm run build:renderer

# Full production build
npm run build

# Type checking
npm run type-check

# Run Electron app
npm run electron:dev
```

---

## 📝 Environment Variables

Required in `.env`:

```env
VBEE_API_KEY=your_bearer_token
VBEE_APP_ID=your_app_id
YOUTUBE_API_KEY=your_youtube_key
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_secret
GEMINI_API_KEY=your_gemini_key
BANANA_API_KEY=your_banana_key
BANANA_MODEL_KEY=your_model_key
```

---

## 📊 Project Structure

```
audiobook-uploader/
├── electron/                   # Electron main process
│   ├── main.ts
│   ├── preload.ts
│   └── events.ts
├── src/
│   ├── components/             # React components
│   │   └── Dashboard.tsx       # Main UI
│   ├── services/               # Backend services
│   │   ├── vbee.ts
│   │   ├── ffmpeg.ts
│   │   ├── youtube.ts
│   │   └── ...
│   ├── utils/                  # Utilities
│   └── types/                  # TypeScript types
├── dist/                       # Build output
│   ├── electron/               # Compiled Electron
│   └── renderer/               # Built React app
├── public/                     # Static assets
└── docs/                       # Documentation
```

---

## 🐛 Known Issues

- UI is mocked (progress simulation, no real API calls yet)
- Settings not yet persisted to disk
- History loads mock data
- Electron app not yet fully integrated

---

## 🤝 Contributing

Development is currently in progress. See [BACKEND_INTEGRATION_GUIDE.md](./BACKEND_INTEGRATION_GUIDE.md) for integration tasks.

---

## 📞 Support

For issues or questions:
1. Check logs in `~/.audiobook-uploader/logs/`
2. Review documentation files
3. Check error messages in console

---

## 📄 License

Project in development - License TBD

---

**Built with ❤️ for Vietnamese Content Creators**

Version: 0.1.0 | Last Updated: Feb 18, 2026
