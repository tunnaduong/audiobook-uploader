# FFmpeg & yt-dlp Setup Guide

**Status:** Automatic setup implemented
**Setup Required:** Optional (Auto-setup available)

---

## Overview

Ứng dụng hỗ trợ 3 cách setup FFmpeg & yt-dlp:

1. **Tự động** (Recommended) - App tự động download & cài đặt
2. **Global Installation** - Dùng phiên bản đã cài trên hệ thống
3. **Manual Path** - Chỉ định đường dẫn trong `.env`

---

## Option 1: Tự Động Setup (Recommended) ⭐

Đây là **cách dễ nhất**. App sẽ tự động:
1. Check xem FFmpeg/yt-dlp đã cài trên hệ thống chưa
2. Nếu chưa → tự động download & extract
3. Lưu vào: `~/.audiobook-uploader/bin/`

### Cách sử dụng:

```bash
# Chỉ cần để `.env` như thế này:
FFMPEG_PATH=
YTDLP_PATH=

# Hoặc bỏ trống hoàn toàn
```

App sẽ tự động detect và download khi cần.

### Log output:

```
[ffmpeg-setup] Using bundled FFmpeg: /Users/user/.audiobook-uploader/bin/ffmpeg
[ytdlp-setup] Using bundled yt-dlp: /Users/user/.audiobook-uploader/bin/yt-dlp
```

---

## Option 2: Global Installation

Nếu bạn đã cài FFmpeg & yt-dlp trên hệ thống:

### Windows:
```bash
# Cài FFmpeg
choco install ffmpeg
# hoặc
winget install ffmpeg

# Cài yt-dlp
pip install yt-dlp
```

### macOS:
```bash
# Cài FFmpeg
brew install ffmpeg

# Cài yt-dlp
brew install yt-dlp
```

### Linux:
```bash
# Debian/Ubuntu
sudo apt-get install ffmpeg
sudo apt-get install yt-dlp

# Fedora
sudo dnf install ffmpeg yt-dlp

# Arch
sudo pacman -S ffmpeg yt-dlp
```

### Verification:

```bash
# Verify FFmpeg
ffmpeg -version

# Verify yt-dlp
yt-dlp --version
```

### Configuration in `.env`:

```env
# Leave empty để use global installation
FFMPEG_PATH=
YTDLP_PATH=
```

Hoặc bỏ qua các dòng này hoàn toàn.

---

## Option 3: Manual Path

Nếu FFmpeg/yt-dlp ở vị trí đặc biệt:

### Setup:

1. Tìm đường dẫn:
```bash
# Windows
where ffmpeg
where yt-dlp

# macOS/Linux
which ffmpeg
which yt-dlp
```

2. Thêm vào `.env`:
```env
FFMPEG_PATH=/usr/local/bin/ffmpeg
YTDLP_PATH=/usr/local/bin/yt-dlp
```

Hoặc (Windows):
```env
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
YTDLP_PATH=C:\yt-dlp\yt-dlp.exe
```

---

## Automatic Setup Behavior

### Startup Flow:

```
App Start
  ↓
getFFmpegPath()
  ├─ Check app bin directory (~/.audiobook-uploader/bin/)
  ├─ Check global installation
  └─ Download + extract if needed
  ↓
Proceed with pipeline
```

### Download Locations by Platform:

**macOS:**
- Intel: ffmpeg-macos-intel (amd64)
- M1/M2: ffmpeg-macos-arm64 (arm64)

**Windows:**
- x64: ffmpeg-win64

**Linux:**
- x64: ffmpeg-linux-x64

**All platforms:**
- yt-dlp latest release

### Storage:

```
~/.audiobook-uploader/
├── bin/
│   ├── ffmpeg          (or ffmpeg.exe)
│   └── yt-dlp
└── logs/
    └── ...
```

---

## Troubleshooting

### Problem: "FFmpeg not found"

**Solution 1:** Install globally
```bash
# macOS
brew install ffmpeg

# Windows
choco install ffmpeg

# Linux
sudo apt-get install ffmpeg
```

**Solution 2:** Specify manual path in `.env`
```env
FFMPEG_PATH=/full/path/to/ffmpeg
```

### Problem: "yt-dlp not found"

**Solution 1:** Install globally
```bash
# All platforms
pip install yt-dlp
```

Or:
```bash
brew install yt-dlp  # macOS
```

**Solution 2:** Specify manual path
```env
YTDLP_PATH=/full/path/to/yt-dlp
```

### Problem: "Downloaded FFmpeg is corrupted"

Delete the cache and re-download:
```bash
rm -rf ~/.audiobook-uploader/bin/
# App will re-download on next startup
```

---

## Implementation Details

### Files Involved:

**src/utils/ffmpeg-setup.ts**
- `getFFmpegPath()` - Main entry point
- `downloadFFmpeg()` - Auto download logic
- Platform detection & download URL building

**src/utils/ytdlp-setup.ts**
- Same pattern as FFmpeg setup
- Handles yt-dlp auto-download

### Environment Variables:

```env
# src/services/ffmpeg.ts
FFMPEG_PATH=                    # Optional manual path

# src/services/douyin.ts
YTDLP_PATH=                     # Optional manual path
```

### Log Files:

Check logs for setup details:
```bash
~/.audiobook-uploader/logs/ffmpeg-setup-YYYY-MM-DD.log
~/.audiobook-uploader/logs/ytdlp-setup-YYYY-MM-DD.log
```

---

## Quick Setup Checklist

### For Development:

```
□ Leave FFMPEG_PATH and YTDLP_PATH empty in .env
□ App will auto-setup on first run
□ Check logs for setup confirmation
```

### For Production:

**Option A (Recommended):**
```
□ Leave FFMPEG_PATH and YTDLP_PATH empty
□ App handles all setup automatically
□ Bundled binaries in ~/.audiobook-uploader/bin/
```

**Option B (Manual):**
```
□ Install FFmpeg globally (apt-get, brew, choco, etc.)
□ Install yt-dlp globally (pip, apt-get, brew, etc.)
□ Leave .env FFMPEG_PATH and YTDLP_PATH empty
```

**Option C (Custom):**
```
□ Provide explicit paths in .env
□ FFMPEG_PATH=/path/to/ffmpeg
□ YTDLP_PATH=/path/to/yt-dlp
```

---

## Performance Considerations

### First Run:

If FFmpeg/yt-dlp need to be downloaded:
- FFmpeg: ~30-50 MB
- yt-dlp: ~10-15 MB
- Download time: Depends on internet speed

### Subsequent Runs:

- No download overhead
- Uses cached binaries
- Fast startup

---

## Cross-Platform Compatibility

### Windows:
✅ Auto-download supported
✅ Global installation detected
✅ Manual path supported

### macOS:
✅ Intel (x64) supported
✅ Apple Silicon (M1/M2/M3) supported
✅ Auto-download for both architectures

### Linux:
✅ x64 supported
✅ Auto-download supported
✅ Global installation detected

---

## Updating Tools

### Update FFmpeg:

**Option 1: Auto-update**
```bash
# Delete cached version
rm ~/.audiobook-uploader/bin/ffmpeg
# App re-downloads latest on next run
```

**Option 2: Manual update**
```bash
# macOS
brew upgrade ffmpeg

# Windows
choco upgrade ffmpeg

# Linux
sudo apt-get update && sudo apt-get upgrade ffmpeg
```

### Update yt-dlp:

**Option 1: Auto-update**
```bash
rm ~/.audiobook-uploader/bin/yt-dlp
# App re-downloads latest on next run
```

**Option 2: Manual update**
```bash
pip install --upgrade yt-dlp
```

---

## Debugging

### Check FFmpeg paths:

```bash
# Test FFmpeg
ffmpeg -version

# Test yt-dlp
yt-dlp --version
```

### Check app logs:

```bash
tail -f ~/.audiobook-uploader/logs/ffmpeg-setup-*.log
tail -f ~/.audiobook-uploader/logs/ytdlp-setup-*.log
```

### Manual path verification:

```bash
# Verify custom paths work
/path/to/ffmpeg -version
/path/to/yt-dlp --version
```

---

## Summary

| Method | Effort | Pros | Cons |
|--------|--------|------|------|
| **Automatic** | None | Easy, no setup | Requires internet |
| **Global** | Low | Fast, clean | Need to install manually |
| **Manual Path** | Medium | Full control | Need to maintain |

**Recommendation:** Use **Automatic** setup (default) for easiest experience.

---

## Next Steps

1. Leave `FFMPEG_PATH` and `YTDLP_PATH` empty in `.env`
2. Run the app - it will auto-setup on first use
3. Check logs to confirm successful setup
4. Proceed with pipeline implementation

See `BACKEND_INTEGRATION_GUIDE.md` for next implementation steps.
