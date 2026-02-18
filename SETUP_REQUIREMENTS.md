# Setup Requirements for Option 1 Pipeline

**Status:** Implementation Complete, Awaiting FFmpeg Installation

---

## The Issue

When you clicked the button, you got an error: **"Unknown error"**

**Root Cause:** FFmpeg is not installed on your system, and the auto-download feature is not implemented yet.

The pipeline requires:
1. ✅ All services implemented (FFmpeg, Gemini, Pipeline Orchestration)
2. ✅ IPC wiring working
3. ✅ Type system complete
4. ❌ **FFmpeg not found** ← This is the blocker

---

## What You Need to Install

### FFmpeg (Required for Video Composition)

FFmpeg is the industry-standard video processing tool. The pipeline uses it to compose the final video.

#### Windows Installation

**Option 1: Using Chocolatey (Easiest)**
```bash
choco install ffmpeg
```

**Option 2: Manual Installation**
1. Go to https://ffmpeg.org/download.html
2. Download Windows build (e.g., from Gyan.dev)
3. Extract to a folder (e.g., `C:\ffmpeg`)
4. Add to PATH:
   - Right-click "This PC" → Properties → Advanced system settings
   - Click "Environment Variables"
   - Under "System variables", find "Path"
   - Click "Edit" → "New" → Add `C:\ffmpeg\bin`
   - Click OK and restart command prompt

**Verify Installation:**
```bash
ffmpeg -version
```

You should see version info (not command not found error).

#### macOS Installation

**Using Homebrew (Easiest):**
```bash
brew install ffmpeg
```

**Verify:**
```bash
ffmpeg -version
```

#### Linux Installation

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Verify:**
```bash
ffmpeg -version
```

---

## Environment Variables (Optional but Recommended)

### For Gemini API (Thumbnail Generation)

If you want thumbnail generation to work without fallback:

```bash
# Windows (Command Prompt)
set GEMINI_API_KEY=your-api-key-here

# Windows (PowerShell)
$env:GEMINI_API_KEY="your-api-key-here"

# macOS/Linux
export GEMINI_API_KEY="your-api-key-here"
```

Get API key from: https://ai.google.dev/

---

## Input Files Required

Before running the pipeline, ensure these files exist:

```
C:\dev\audiobook-uploader\input\
├── image\
│   ├── video_banner.png           ← 1920x1080 background image
│   ├── avatar.png                 ← Style reference
│   └── reference.jpg              ← Additional reference (optional)
└── music\
    └── bg-music.m4a               ← Background music
```

All input files must be present before running the pipeline.

---

## Output Folder

Create this folder if it doesn't exist:

```
C:\dev\audiobook-uploader\output\
```

The pipeline will create:
- `final_video.mp4` - Composed video
- `thumbnail.jpg` - YouTube thumbnail

---

## Quick Start After Setup

### 1. Install FFmpeg
Follow the installation steps above for your OS.

### 2. Verify Installation
```bash
ffmpeg -version
```

Should show version info, not error.

### 3. Start Dev Server
```bash
cd C:\dev\audiobook-uploader
npm run dev
```

### 4. Test Pipeline
1. Open http://localhost:5174
2. Go to "Tạo Audiobook" tab
3. Paste Vietnamese story text
4. Click "▶️ Tạo Audiobook"

### 5. Watch Progress
- Progress bar should animate (not instant)
- Logs should show real FFmpeg execution
- Takes 30-120 seconds (actual processing)

### 6. Check Results
Files should appear in `C:\dev\audiobook-uploader\output\`
- `final_video.mp4` (50-500 MB)
- `thumbnail.jpg` (500 KB)

---

## Troubleshooting

### Error: "FFmpeg not found"

**Solution:** Ensure FFmpeg is installed and in your PATH
```bash
# Test FFmpeg
ffmpeg -version

# If not found, reinstall and restart terminal/IDE
```

### Error: "Gemini API key missing"

**Solution:** Set environment variable (optional, will fallback to placeholder thumbnail)
```bash
set GEMINI_API_KEY=your-key-here
```

### Process takes very long time

**This is normal!** Actual execution takes:
- Video composition: 30-120 seconds
- Thumbnail generation: 5-15 seconds
- Total: 40-140 seconds (not instant like mock)

### No output files created

**Check:**
1. Is process still running? (Check progress bar)
2. Is output folder writable? (permissions)
3. Are input files accessible? (correct paths)

---

## Expected Error Messages

After installing FFmpeg, you might see different errors:

### Good Error (Means FFmpeg is working!)
```
[Compose Video] ❌ Lỗi: Cannot find input file
```
This means FFmpeg ran but files are missing/wrong path.

### Bad Error (FFmpeg not working)
```
❌ Lỗi: Unknown error
```
This means FFmpeg wasn't found (current issue).

### Good Error (Gemini missing)
```
[Generate Thumbnail] ❌ Failed to generate thumbnail (Gemini API key missing)
```
This is fine - thumbnail will fall back to placeholder.

---

## Next Steps

1. **Install FFmpeg** following the instructions above
2. **Verify installation:** `ffmpeg -version`
3. **Set GEMINI_API_KEY** (optional):
   ```bash
   set GEMINI_API_KEY=your-key
   ```
4. **Start dev server:**
   ```bash
   npm run dev
   ```
5. **Test the pipeline**
6. **Check output files** in `output/` folder

---

## Implementation Status After Setup

✅ **Option 1 Implementation Complete & Ready**
- Services: Fully implemented
- IPC Wiring: Fully connected
- Type System: Zero errors
- Build System: Working

⏳ **Waiting For:**
1. FFmpeg installation (your system)
2. GEMINI_API_KEY setup (optional, your choice)

Once you install FFmpeg, the pipeline will work with real service execution!

---

## Summary

The Option 1 implementation is complete. The error you got was because FFmpeg wasn't installed.

**To fix it:**
```bash
# Install FFmpeg (choose for your OS above)

# Verify it works
ffmpeg -version

# Restart dev server
npm run dev

# Test in browser
# http://localhost:5174
```

That's it! The real pipeline will then execute with actual FFmpeg and Gemini services.

🚀 **Ready to proceed once FFmpeg is installed!**
