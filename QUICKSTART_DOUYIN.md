# 🚀 Quick Start: Douyin Video Download

## 1️⃣ Verify Setup (30 seconds)

```bash
node test-douyin.js
```

Expected output:
```
✅ Python found: Python 3.14.2
✅ douyin-downloader found
✅ DouYinCommand.py found
✅ All dependencies installed
✅ cookies.txt found (6.3 KB)
✅ All checks passed! Ready to download from Douyin
```

## 2️⃣ Start the App

```bash
npm run dev
```

App will open at `http://localhost:5173`

## 3️⃣ Download a Video

1. **Paste Douyin URL** in the input field
   - Example: `https://v.douyin.com/FUJdBNuX9Ok/`
   - Or: `https://www.douyin.com/video/7589651446241785178`

2. **Click "🎙️ Tạo Audiobook"** button

3. **Watch the "Nhật Ký" (Journal)** section for logs

Expected logs:
```
🔵 [HH:MM:SS] [douyin-service] 🎬 Downloading Douyin video: https://v.douyin.com/...
🔵 [HH:MM:SS] [douyin-service] ✅ Executing douyin-downloader (V1.0 - Stable)...
🟢 [HH:MM:SS] [douyin-service] ✅ Successfully downloaded video in 45s
```

## ✅ Success Indicators

- ✅ No errors in "Nhật Ký"
- ✅ Video appears in `C:\dev\audiobook-uploader\output\`
- ✅ File is an MP4 video file
- ✅ File size > 0 MB

## ❌ If Download Fails

### Error: "Python not found"
→ Install Python 3.9+ from https://www.python.org/

### Error: "Fresh cookies needed"
→ Cookies expired. Visit https://www.douyin.com in Chrome, watch 2-3 videos, restart app

### Error: "douyin-downloader not installed"
→ Run: `pip install -r requirements.txt` in douyin-downloader folder

### For detailed help:
→ See **DOUYIN_SETUP.md** (comprehensive guide)
→ See **MIGRATION_NOTES.md** (technical details)

## 📖 Full Docs

- **Setup Guide**: `DOUYIN_SETUP.md`
- **Technical Docs**: `MIGRATION_NOTES.md`
- **Diagnostics**: `node test-douyin.js` or `bash test-douyin-full.sh`

## 🎯 Success = Full Pipeline Works

Once Douyin download works:
1. ✅ TTS audio generation (Vbee)
2. ✅ Video composition (FFmpeg)
3. ✅ Thumbnail generation (Gemini)
4. ✅ YouTube upload (optional)

**Enjoy! 🚀**
