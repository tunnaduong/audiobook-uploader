# Quick Start Guide

## 🚀 Start Development (2 Terminals)

### Terminal 1: React Dev Server
```bash
npm run dev
```
This starts Vite at http://localhost:5173 with hot-reload

### Terminal 2: Electron App
```bash
npm run electron:dev
```
This launches the desktop app with DevTools open

**That's it!** The app will reload as you make changes.

## 📦 Build for Production

### Build for your platform
```bash
npm run build
```

### Build for specific OS
```bash
npm run build:win   # Windows NSIS installer
npm run build:mac   # macOS DMG package
```

Output files will be in `./release/`

## 🔍 Verify Setup

```bash
# Check TypeScript compilation
npm run type-check

# Should output: "> audiobook-uploader@0.1.0 type-check" with no errors
```

## 📁 Important Directories

- **Services:** `src/services/` - Video download, TTS, FFmpeg, YouTube
- **Utilities:** `src/utils/` - Database, FFmpeg setup, Logging
- **Types:** `src/types/` - All TypeScript interfaces
- **Electron:** `electron/` - Main process, IPC handlers
- **Components:** `src/components/` - React UI (to be created)

## 🔑 Environment Setup

1. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Add your API keys:
   ```
   VBEE_API_KEY=your_key_here
   YOUTUBE_API_KEY=your_key_here
   GEMINI_API_KEY=your_key_here
   BANANA_API_KEY=your_key_here
   ```

## 📚 Project Structure

```
src/
├── services/        ← API integration layer (all services)
├── utils/           ← Core utilities (database, logging, FFmpeg)
├── types/           ← TypeScript interfaces
├── components/      ← React UI components (next to implement)
├── pages/           ← Page components (next to implement)
├── App.tsx          ← Root component
└── main.tsx         ← Entry point

electron/
├── main.ts          ← App entry point
├── preload.ts       ← IPC security bridge
├── events.ts        ← IPC event handlers
└── utils.ts         ← Electron utilities
```

## 🐛 Debugging

### View Console Logs
DevTools will open automatically. Check Console tab for logs.

### View Database
Database is stored at: `~/.audiobook-uploader/app.db`
Logs are at: `~/.audiobook-uploader/logs/`

### View Network Calls
DevTools Network tab shows all HTTP requests to APIs

## ✅ Working Features

- ✅ Electron app shell
- ✅ React integration with hot-reload  
- ✅ SQLite database (sql.js)
- ✅ Douyin video download module
- ✅ Vbee TTS service
- ✅ FFmpeg video composition
- ✅ YouTube upload API
- ✅ Gemini thumbnail generation
- ✅ Logging system
- ✅ IPC communication

## ⚠️ Next Steps

1. **Create UI Components:** Dashboard, Pipeline, Settings, History
2. **Implement Pipeline Orchestration:** Wire up services
3. **Add Progress Tracking:** Real-time updates
4. **Build Tests:** Unit & integration tests
5. **Optimize FFmpeg:** Test on different hardware

## 💡 Tips

- Use Vite's hot reload - save files and watch them update instantly
- Keep DevTools open to debug IPC messages
- Check logs in `~/.audiobook-uploader/logs/` for detailed debugging
- Environment variables in `.env` are loaded automatically

---

**Ready to build?** Run `npm run dev` and `npm run electron:dev` in separate terminals!
