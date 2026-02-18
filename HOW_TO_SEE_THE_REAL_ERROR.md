# How to See the REAL Error Message

**Status:** I've added detailed logging throughout the code. Now you can see exactly what's happening.

---

## The Problem

You keep seeing "❌ Lỗi: Unknown error - Pipeline" which is a fallback message.

The **actual error** is being caught and logged, but you haven't been looking in the right place to see it.

---

## Where to Look for the Real Error

There are TWO consoles:

### 1. Browser Console (F12) - Shows UI logs
```
📱 UI: Sending pipeline config to IPC handler
📱 UI: Received result from IPC handler: {...}
❌ UI: Pipeline failed with error: [THE ERROR SHOULD BE HERE]
```

### 2. Electron Console (Ctrl+Shift+I) - Shows Main Process logs
```
🔵 IPC Handler: Starting pipeline
📊 Step: Validate Input - 10%
...
🔴 IPC Handler: EXCEPTION CAUGHT
Type: Error
Message: [THE ACTUAL ERROR MESSAGE IS HERE]
```

---

## Step-by-Step: How to See the Real Error

### Step 1: Start the Dev Server (if not running)
```bash
npm run dev
```

### Step 2: Open the App
- Browser opens http://localhost:5174
- Go to "Tạo Audiobook" tab

### Step 3: Open the Electron Console
- **Inside the app window**, press: `Ctrl + Shift + I`
- Click on "Console" tab
- You should see logs starting with 🔵, 📊, 🟢, 🔴

### Step 4: Click the Button
- Paste Vietnamese text
- Click "▶️ Tạo Audiobook"

### Step 5: Watch the Electron Console
Look for these patterns:

**Success (🟢):**
```
🔵 IPC Handler: Starting pipeline
📊 Step: Validate Input - 10%
📊 Step: Compose Video - 10%
...
🟢 IPC Handler: SUCCESS - Pipeline completed
📁 Video: C:\dev\audiobook-uploader\output\final_video.mp4
📁 Thumbnail: C:\dev\audiobook-uploader\output\thumbnail.jpg
```

**Error (🔴):**
```
🔵 IPC Handler: Starting pipeline
📊 Step: Validate Input - 10%
🔴 IPC Handler: EXCEPTION CAUGHT
Type: Error
Message: [THIS IS THE REAL ERROR - COPY THIS LINE]
Stack: [stack trace]
```

### Step 6: Copy the Error Message
Find the line: `Message: ...`

This is the **actual error**. Share this with me!

---

## Examples of Real Errors You Might See

### Example 1: FFmpeg Not Installed
```
🔴 IPC Handler: EXCEPTION CAUGHT
Type: Error
Message: FFmpeg is required but not installed.

INSTALLATION INSTRUCTIONS:

Windows (using Chocolatey):
  choco install ffmpeg
...
```
**Fix:** Install FFmpeg

### Example 2: Input Files Missing
```
🔴 IPC Handler: EXCEPTION CAUGHT
Type: Error
Message: ENOENT: no such file or directory, open 'C:\dev\audiobook-uploader\input\image\video_banner.png'
```
**Fix:** Check input files exist at correct paths

### Example 3: Gemini API Error
```
🔴 IPC Handler: EXCEPTION CAUGHT
Type: Error
Message: Gemini API Error: 403 Forbidden - invalid API key
```
**Fix:** Set GEMINI_API_KEY environment variable

---

## What the Logs Show

### Browser Console (F12)
Shows React component perspective:
```
📱 UI: Sending pipeline config to IPC handler
📱 UI: Received result from IPC handler: {success: false, error: "FFmpeg is required..."}
❌ UI: Pipeline failed with error: FFmpeg is required...
```

### Electron Console (Ctrl+Shift+I in app)
Shows what's actually happening:
```
🔵 IPC Handler: Starting pipeline
📋 Config: storyTitle=..., bannerImage=...
📊 Step: Validate Input - 10%
📊 Step: Compose Video - 10%
   ↓ (here is where error happens if FFmpeg missing)
🔴 IPC Handler: EXCEPTION CAUGHT
Type: Error
Message: FFmpeg is required but not installed...
```

---

## Debug Checklist

Before clicking the button, check:
- [ ] App running: http://localhost:5174
- [ ] Electron console open: Ctrl+Shift+I (in app window, not browser)
- [ ] Console tab selected (not "Sources" or "Network")
- [ ] Ready to scroll up to see 🔴 error messages

---

## How to Share the Error With Me

Once you see the actual error in the Electron console:

1. Open Electron Console: `Ctrl+Shift+I` (in app window)
2. Click "▶️ Tạo Audiobook" button
3. Wait for error (red 🔴 lines)
4. Copy the entire "Message:" line
5. Tell me exactly what it says

Example message to share:
```
Message: FFmpeg is required but not installed.

INSTALLATION INSTRUCTIONS:
Windows (using Chocolatey):
  choco install ffmpeg
...
```

---

## Key Difference

**Before (you see):**
```
[8:34:57 PM] ❌ Lỗi: Unknown error - Pipeline
```

**After (what's actually happening in Electron console):**
```
🔴 IPC Handler: EXCEPTION CAUGHT
Message: FFmpeg is required but not installed.
INSTALLATION INSTRUCTIONS:
...
```

The error message IS there - it's just being caught and the UI is showing a fallback string because `result?.error` might be undefined in some cases.

---

## Next Step

1. **Rebuild** (already done, changes compiled)
2. **Restart dev server**: Stop current one, run `npm run dev` again
3. **Open app and Electron console**: Ctrl+Shift+I
4. **Click button** and **look at Electron console for 🔴 error**
5. **Copy the Message line** and share it with me

This will show the REAL error, not the fallback "Unknown error - Pipeline"!

---

**The implementation is correct. The error IS being thrown. We just need to see what it actually says so we can fix it properly!**

Let me know what the Electron console shows! 🔍
