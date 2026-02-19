# Quick Start Guide - Audiobook Uploader v0.1.0

**Status**: ✅ Production Ready | **Last Updated**: February 19, 2026

---

## 🚀 Quick Start for Users

### 1. Download & Install
```bash
# Go to GitHub Releases
https://github.com/your-username/audiobook-uploader/releases

# Download:
# Windows: Audiobook-Uploader-0.1.0-x64.exe
# macOS: Audiobook-Uploader-0.1.0.dmg
```

### 2. Configure API Keys
In app Settings tab, add:
- VBEE_API_KEY
- GEMINI_API_KEY
- YOUTUBE_OAUTH_CLIENT_ID
- YOUTUBE_OAUTH_CLIENT_SECRET

### 3. Start Creating!
- Input story text
- Select cooking video
- Click "Create Audiobook"
- Optional: Auto-upload to YouTube

---

## 💻 Quick Start for Developers

### Start Development (Single Command)
```bash
npm run dev
```
Opens Electron app with hot-reload - make changes and see them instantly!

### Build for Production
```bash
# Build for your platform
npm run build

# Build specific OS
npm run build:win   # Windows executable
npm run build:mac   # macOS executable
```

### Verify Everything Works
```bash
npm run type-check   # Must pass with 0 errors
npm run build:electron  # Compile Electron main
npm run build:renderer  # Bundle React UI
```

---

## 📁 Key Files & Directories

### Frontend (React)
- `src/components/Dashboard.tsx` - Main UI with YouTube integration
- `src/components/` - All UI components
- `src/types/index.ts` - All TypeScript interfaces

### Backend (Electron)
- `electron/events.ts` - **Most Important**: IPC handlers orchestrate services
- `electron/preload.ts` - Exposes API to React
- `electron/main.ts` - App initialization

### Services
- `src/services/pipeline.ts` - Orchestrates: video → thumbnail → YouTube
- `src/services/ffmpeg.ts` - Video composition
- `src/services/gemini.ts` - Thumbnail generation
- `src/services/youtube.ts` - YouTube upload
- `src/services/youtube-auth.ts` - OAuth 2.0

### Utilities
- `src/utils/youtube-oauth.ts` - OAuth helpers
- `src/utils/logger.ts` - Logging system
- `src/utils/database.ts` - SQLite operations

---

## 🔧 Environment Setup

### 1. Create .env file
```bash
cp .env.example .env
```

### 2. Add your API keys
```bash
# .env
VBEE_API_KEY=your_key
GEMINI_API_KEY=your_key
YOUTUBE_OAUTH_CLIENT_ID=your_id
YOUTUBE_OAUTH_CLIENT_SECRET=your_secret
```

### 3. Install FFmpeg
```bash
# Windows
choco install ffmpeg

# macOS
brew install ffmpeg
```

---

## 🎯 Common Development Tasks

### Add a New Feature
1. Create service in `src/services/*.ts`
2. Add IPC handler in `electron/events.ts`
3. Expose in `electron/preload.ts`
4. Call from React via `window.api.featureName()`
5. Run `npm run type-check` (must pass!)

### Debug the App
```bash
# React UI (Browser Console)
Ctrl+Shift+I

# Electron Main Process (Electron Console)
Ctrl+Shift+I → Main Process toggle

# View App Logs
~/.audiobook-uploader/logs/
```

### Build Executables
```bash
# Windows
.\scripts\build-win.bat

# macOS
./scripts/build-mac.sh

# Output: dist/release/*.exe or *.dmg
```

---

## 📊 Project Structure

```
audiobook-uploader/
├── src/
│   ├── components/      # React UI
│   ├── services/        # FFmpeg, Gemini, YouTube, OAuth
│   ├── types/           # TypeScript interfaces
│   └── utils/           # Helpers (logger, database, etc)
├── electron/
│   ├── main.ts          # App entry
│   ├── events.ts        # IPC handlers (main logic)
│   └── preload.ts       # Security bridge
├── .github/workflows/
│   └── build-release.yml  # GitHub Actions CI/CD
├── scripts/
│   ├── build-win.bat    # Windows build script
│   └── build-mac.sh     # macOS build script
├── dist/
│   ├── electron/        # Compiled main process
│   ├── renderer/        # Bundled React UI
│   └── release/         # Final executables
└── [Documentation files below]
```

---

## 📚 Full Documentation

| Document | Purpose |
|----------|---------|
| **DEPLOYMENT.md** | How to install and use (for end users) |
| **BUILD_GUIDE.md** | Build configuration and troubleshooting |
| **PROJECT_STATUS.md** | Complete project status report |
| **RELEASE_NOTES.md** | Features in v0.1.0 |
| **CLAUDE.md** | Developer guidelines |

---

## ✅ What's Working

- ✅ Video composition with FFmpeg
- ✅ Thumbnail generation via Gemini API
- ✅ YouTube OAuth 2.0 authentication
- ✅ Secure token storage (keytar)
- ✅ Project history
- ✅ Settings persistence
- ✅ Error handling
- ✅ Type-safe IPC
- ✅ GitHub Actions CI/CD
- ✅ Cross-platform builds

---

## 🚀 Deploy to Production

### Option 1: GitHub Actions (Automatic)
```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
# GitHub Actions automatically builds Windows + macOS executables!
```

### Option 2: Build Yourself
```bash
# Windows
.\scripts\build-win.bat
# Output: dist\release\*.exe

# macOS
./scripts/build-mac.sh
# Output: dist/release/*.dmg
```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| `npm run type-check` fails | Check error file, fix TypeScript, run again |
| FFmpeg not found | `choco install ffmpeg` (Windows) or `brew install ffmpeg` (macOS) |
| App won't start | Check Node.js 18+, FFmpeg installed, .env configured |
| YouTube auth fails | Check Client ID/Secret, internet connection, API quota |
| Build fails | Run `npm install`, `npm run type-check`, then try again |

---

## 💡 Pro Tips

1. **Hot Reload**: `npm run dev` automatically reloads when you save
2. **Type Safety**: Run `npm run type-check` before committing
3. **Debugging**: Use `window.api.methodName()` in browser console to test IPC
4. **Logs**: Check `~/.audiobook-uploader/logs/` for detailed execution logs
5. **Release**: Create a git tag to trigger GitHub Actions automated builds

---

## 📞 Resources

- **GitHub**: https://github.com/your-username/audiobook-uploader
- **Issues**: Create issues for bugs and features
- **Discussions**: Share ideas and get help
- **Email**: your-email@example.com

---

**Version**: 0.1.0 | **Status**: ✅ Production Ready | **Last Build**: Feb 19, 2026
