# Diagnostic Guide - Understanding the "Unknown error" Issue

## The Problem

Even after improving error messages in the code, you still see:
```
[8:31:39 PM] ❌ Lỗi: Unknown error - Pipeline
```

This suggests the error message IS being caught, but either:
1. It's being caught as a different type
2. The error object doesn't have a proper `.message` property
3. The error is being truncated somewhere
4. The dev server is using old compiled code

## How to Debug This

### Step 1: Check the Electron Console

The Electron console (not the browser console!) shows the actual errors:

**On Windows:**
1. In your app window, press: `Ctrl + Shift + I` (Developer Tools)
2. Click on "Console" tab
3. Look for lines with these colored prefixes:
   - 🔵 IPC Handler: (blue) - handler starting
   - 🟢 IPC Handler: (green) - success
   - 🔴 IPC Handler: (red) - error
   - 🔵 Starting pipeline... (blue) - pipeline starting

4. The red error lines will show:
   ```
   🔴 IPC Handler: Pipeline error caught
   Error message: [THE ACTUAL ERROR MESSAGE HERE]
   Full stack: [STACK TRACE]
   ```

### Step 2: What You Should See

**If FFmpeg is not installed:**
```
🔴 IPC Handler: Pipeline error caught
Error message: FFmpeg is required but not installed.

INSTALLATION INSTRUCTIONS:

Windows (using Chocolatey):
  choco install ffmpeg
...
```

**If FFmpeg is installed but has a different error:**
```
🔴 IPC Handler: Pipeline error caught
Error message: [Some FFmpeg error or missing file error]
Full stack: [JavaScript stack trace]
```

### Step 3: Rebuild and Restart

If you're still seeing generic "Unknown error", the code might not be recompiled:

```bash
# Kill the dev server (Ctrl+C in terminal)

# Rebuild everything
npm run build:electron
npm run build:renderer

# Start fresh dev server
npm run dev

# Open app again (Ctrl+Shift+I for console)
# Click button again and check Electron console for red errors
```

### Step 4: Check Browser Console vs Electron Console

**Browser Console (F12 in browser):**
- Shows React logs
- Shows IPC calls
- Shows what the UI received

**Electron Console (Ctrl+Shift+I in app):**
- Shows what Electron main process is doing
- Shows FFmpeg errors
- Shows service execution details
- Shows the actual error before it's sent to UI

## What Each Error Means

### "FFmpeg is required but not installed"
**Cause:** FFmpeg not in PATH
**Fix:** Install FFmpeg and add to PATH

### "Cannot find input file: C:\...\video_banner.png"
**Cause:** Input files missing
**Fix:** Verify all input files exist at correct paths

### "Cooking video info call failed"
**Cause:** FFmpeg can't read the cooking video
**Fix:** Check if the video file is valid

### "Failed to generate thumbnail (Gemini API)"
**Cause:** GEMINI_API_KEY not set or invalid
**Fix:** Set environment variable or ignore (fallback to placeholder)

### Something else
**Cause:** Unknown
**Fix:** Check Electron console for full error message

## Files to Check

If error is still "Unknown error - Pipeline", check these files are being used:

```bash
# Should have the new error message code
cat dist/src/utils/ffmpeg-setup.js | grep -A5 "FFmpeg is required"

# Should show multiline error handling
cat dist/src/components/Dashboard.js | grep -A10 "split('\n')"

# Should show console.error calls
cat dist/electron/events.js | grep -B2 -A2 "Error message:"
```

If these don't contain the new code, the build is stale.

## The Complete Flow

```
Button Click
  ↓ (browser)
window.api.startPipeline(config)
  ↓ (IPC to Electron)
electron/events.ts handler (check Electron console here!)
  ↓ (console.log shows 🔵 IPC Handler starting)
executePipeline() in src/services/pipeline.ts
  ↓
composeBannerVideo() in src/services/ffmpeg.ts
  ↓
getFFmpegPath() in src/utils/ffmpeg-setup.ts
  ↓ (if FFmpeg not found)
throw new Error("FFmpeg is required but not installed...")
  ↓ (caught here in Electron console!)
catch (error) {
  console.error('Error message:', error.message) ← Shows detailed error
  ↓
  return { success: false, error: errorMessage }
  ↓ (IPC back to browser)
Dashboard receives result
  ↓ (browser)
Display error in UI
```

## Quick Checklist

- [ ] Opened app (Ctrl+Shift+I for Electron console)
- [ ] Clicked button to run pipeline
- [ ] Looked at Electron console (not browser console)
- [ ] Saw "🔴 IPC Handler: Pipeline error caught"
- [ ] Read the "Error message:" line
- [ ] Copied the full error message

Once you share what's actually in the Electron console error message, I can provide the exact fix needed!

## Next Steps

1. **Open the app**
   - `npm run dev` (if not already running)
   - Navigate to http://localhost:5174

2. **Open Electron Console**
   - In the app window: `Ctrl + Shift + I`
   - Make sure you're in the "Console" tab

3. **Run the pipeline**
   - Click "▶️ Tạo Audiobook" button

4. **Check console for error**
   - Look for red/🔴 colored lines
   - Find line that says "Error message: ..."
   - Copy that entire message

5. **Share the actual error**
   - Tell me what the "Error message:" line says
   - I'll give you the exact fix

---

**The implementation is complete. We just need to see the actual error from the Electron console to fix it!**
