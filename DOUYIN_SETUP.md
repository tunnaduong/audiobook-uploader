# Douyin Video Download Setup Guide

This app now uses the **jiji262/douyin-downloader** (V1.0 Stable) for downloading Douyin videos instead of yt-dlp.

## ✅ Prerequisites

### 1. Python 3.9 or Higher
- Download from: https://www.python.org/downloads/
- **Important**: Check "Add Python to PATH" during installation
- Verify installation:
  ```bash
  python --version
  ```

### 2. douyin-downloader Dependencies
The downloader is already cloned in `bin/douyin-downloader/`. Install dependencies:

```bash
cd "C:\dev\audiobook-uploader\bin\douyin-downloader"
pip install -r requirements.txt
```

This installs:
- `requests` - HTTP library
- `pyyaml` - YAML config parsing
- `rich` - Terminal formatting
- And other utilities

## 🍪 Cookies Setup

Douyin requires **valid, fresh cookies** to download videos. There are 3 methods:

### Method 1: Auto-Extract from Chrome (Easiest) ⭐
If you don't want to create a cookies file, the app will **automatically extract cookies from Chrome** when needed. Just:

1. Open Chrome
2. Visit: https://www.douyin.com/
3. Watch 2-3 videos (to ensure cookies are set)
4. Run the app - it will auto-extract cookies from Chrome

**Pros**: No manual file management
**Cons**: Requires Chrome to be on your system

### Method 2: Manual Cookie Extraction (Recommended)
If auto-extract doesn't work or you prefer a file:

```bash
cd "C:\dev\audiobook-uploader\bin\douyin-downloader"
python cookie_extractor.py
```

This will:
1. Open a browser automatically
2. Wait for you to login and browse Douyin
3. Save cookies to `config.yml`

**Pros**: One-time setup, works offline
**Cons**: Requires Playwright installation

### Method 3: Manual Browser DevTools (If others fail)
1. Open Chrome → https://www.douyin.com/
2. Login to your account
3. Press `F12` → Network tab
4. Refresh page, find any request
5. Copy Cookie header values:
   - `msToken`
   - `ttwid`
   - `odin_tt`
   - `passport_csrf_token`
   - `sid_guard`
6. Create `cookies.txt` with these values

## 🔧 Configuration

### Option A: Using Cookies File (Method 2/3)

1. After extracting cookies, copy the cookies file to project root:
   ```bash
   copy "C:\dev\audiobook-uploader\bin\douyin-downloader\config.yml" "C:\dev\audiobook-uploader\cookies.txt"
   ```

2. Uncomment in `.env`:
   ```
   DOUYIN_COOKIES_FILE="C:\dev\audiobook-uploader\cookies.txt"
   ```

3. Restart the app

### Option B: Auto-Extract from Chrome (Method 1) - NO SETUP NEEDED ✅

Just leave `DOUYIN_COOKIES_FILE` commented out in `.env`:
```
# DOUYIN_COOKIES_FILE="C:\dev\audiobook-uploader\cookies.txt"
```

The app will automatically extract cookies from Chrome when downloading.

## 🚀 How It Works

When you paste a Douyin URL and click "Tạo Audiobook":

1. **Validate URL** - Check if it's a valid Douyin link
2. **Check Python** - Verify Python 3.9+ is installed
3. **Load/Extract Cookies** - Either from file or Chrome
4. **Generate Config** - Create temporary `config.yml`
5. **Execute Download** - Run `python DouYinCommand.py`
6. **Find Video** - Locate the downloaded MP4 file
7. **Continue Pipeline** - Use video for TTS, composition, etc.

## 🐛 Troubleshooting

### Error: "Python not found"
```
❌ Python is required to use douyin-downloader.
Please install Python 3.9+ from: https://www.python.org/
After installation, restart the app.
```
**Fix**: Install Python and add to PATH

### Error: "douyin-downloader not installed"
```
⚠️ douyin-downloader not installed.
Please install dependencies:
1. cd "C:\dev\audiobook-uploader\bin\douyin-downloader"
2. pip install -r requirements.txt
```
**Fix**: Install the requirements

### Error: "Fresh cookies needed" or "Cookie expired"
```
⚠️ Douyin requires valid cookies to download videos.
To get fresh cookies:
1. Open Chrome and visit: https://www.douyin.com/
2. Watch 2-3 videos to ensure cookies are set
3. Restart the app
4. Try downloading again
```
**Fix**: Refresh your cookies using Method 1 or 2

### Error: "Video file not found after download"
1. Check the logs (Nhật Ký section) for error messages
2. Verify output directory exists: `C:\dev\audiobook-uploader\output\`
3. Try downloading again with a different URL
4. Check internet connection

### Slow Download Speed
- Adjust `thread` value in config (currently set to 1 for stability)
- Modify in `src/utils/douyin-downloader-setup.ts`, function `createDouyinConfig()`
- Increase `config.thread` from 1 to 3-5 for faster downloads (may be less stable)

## 📊 Supported Douyin Links

✅ **Working:**
- Single video: `https://v.douyin.com/xxxxx/`
- Video direct: `https://www.douyin.com/video/xxxxx`
- Images: `https://www.douyin.com/note/xxxxx`

⚠️ **May work but not tested:**
- User profile: `https://www.douyin.com/user/xxxxx`
- Collections: `https://www.douyin.com/collection/xxxxx`
- Music: `https://www.douyin.com/music/xxxxx`

❌ **Not tested:**
- Live streams: `https://live.douyin.com/xxxxx`

## 📝 Logs

All download activity is logged in the app's "Nhật Ký" section with timestamps. Key logs:

```
🔵 [HH:MM:SS] [douyin-service] 🎬 Downloading Douyin video: https://v.douyin.com/...
🔵 [HH:MM:SS] [douyin-downloader-setup] ✅ douyin-downloader found at: ...
🔵 [HH:MM:SS] [douyin-downloader-setup] 📝 Reading cookies from: ...
🔵 [HH:MM:SS] [douyin-service] 🔧 Executing douyin-downloader (V1.0 - Stable)...
🟢 [HH:MM:SS] [douyin-service] ✅ Successfully downloaded video in 45s
```

## 🔗 References

- Douyin Downloader: https://github.com/jiji262/douyin-downloader
- Python: https://www.python.org/
- Douyin Web: https://www.douyin.com/

## 💡 Tips

1. **Keep cookies fresh**: Douyin API changes often. If downloads start failing, re-extract cookies
2. **Use Chrome method**: The auto-extract from Chrome is most reliable
3. **Check Douyin API**: If massive failures occur, check the GitHub repo for API changes
4. **Test URL**: Paste URL into browser first to verify it works before trying to download
5. **Network**: Slow internet = slow downloads. Downloads happen server-side through yt-dlp, not your ISP

## ✨ What's Next

After Douyin download succeeds, the pipeline automatically:
1. Converts story text to TTS audio (Vbee) 🔊
2. Composes video with banner + TTS + music (FFmpeg) 🎬
3. Generates thumbnail (Gemini) 🎨
4. Uploads to YouTube (optional) 📤

Enjoy! 🚀
