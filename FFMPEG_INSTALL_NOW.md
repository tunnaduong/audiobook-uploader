# FFmpeg Installation Guide - For Windows

**Your Situation:** You said you installed FFmpeg, but it's not in your PATH yet.

**What needs to happen:** FFmpeg must be accessible from command prompt/terminal so the app can find it.

---

## Quick Fix - Choose ONE Method

### Method 1: Chocolatey (Easiest - Recommended)

**Prerequisites:** Chocolatey installed
- Check: Open Command Prompt (Admin) and run `choco -v`
- If not installed, see: https://chocolatey.org/install

**Steps:**
```powershell
# Open Command Prompt as Administrator
choco install ffmpeg

# Wait for installation to complete
# Close and reopen all command prompts and terminal windows

# Verify it worked
ffmpeg -version
```

**Expected output:**
```
ffmpeg version 7.0 Copyright (c) 2000-2024 the FFmpeg developers
...
```

### Method 2: Manual Installation (If Chocolatey doesn't work)

**Step 1: Download FFmpeg**
1. Go to: https://ffmpeg.org/download.html
2. Click "Windows builds"
3. Download one of these (Full build recommended):
   - gyan.dev builds: https://www.gyan.dev/ffmpeg/builds/
   - Download "full" version (ffmpeg-2024-XX-XX-git-XXXX-full_build.7z or .zip)

**Step 2: Extract to a Folder**
1. Extract the downloaded file to: `C:\ffmpeg` (create the folder if needed)
2. You should see:
   ```
   C:\ffmpeg\
   ├── bin\
   │   ├── ffmpeg.exe
   │   ├── ffprobe.exe
   │   └── ...
   ├── doc\
   └── ...
   ```

**Step 3: Add to Windows PATH**

**Option A: Using GUI (Easiest)**
1. Right-click on "This PC" or "My Computer" → Properties
2. Click "Advanced system settings" (on left side)
3. Click "Environment Variables" button (bottom right)
4. Under "System variables" section, find "Path" and click "Edit"
5. Click "New" and add: `C:\ffmpeg\bin`
6. Click "OK", "OK", "OK"

**Option B: Using Command Prompt (Admin)**
```powershell
# Open Command Prompt as Administrator and run:
setx PATH "%PATH%;C:\ffmpeg\bin"

# Close and reopen command prompt
# Verify it worked
ffmpeg -version
```

**Step 4: Verify Installation**
1. Close all command prompts and IDE windows
2. Open new Command Prompt (not as Admin)
3. Run: `ffmpeg -version`

**Expected output:**
```
ffmpeg version 7.0 Copyright (c) 2000-2024 the FFmpeg developers
...
```

**If you see:** `'ffmpeg' is not recognized...`
- Path was not updated correctly
- Go back to Step 3 and try again
- Make sure to close and reopen command prompt after changing PATH

---

## Verify Installation is Working

Open a new Command Prompt (NOT as Admin) and run:

```powershell
ffmpeg -version
```

You should see:
```
ffmpeg version X.X (output from ffmpeg)
...
```

**NOT:**
```
'ffmpeg' is not recognized as an internal or external command
```

---

## After Installing FFmpeg

1. **Close all command prompts and IDE windows**
   - Fully close VS Code, your terminal, everything

2. **Restart your dev server**
   ```powershell
   cd C:\dev\audiobook-uploader
   npm run dev
   ```

3. **Test in browser**
   - Open http://localhost:5174
   - Go to "Tạo Audiobook" tab
   - Paste story and click button

4. **Now you should see**
   - Real progress (not instant)
   - FFmpeg actually running
   - Video and thumbnail created in output/

---

## If It Still Doesn't Work

### Issue: "ffmpeg -version" still shows "command not found"

**Solution:**
1. Make absolutely sure you ran the PATH command correctly
2. Verify the folder exists: `dir C:\ffmpeg\bin\ffmpeg.exe`
3. If it doesn't exist, re-extract FFmpeg to correct location
4. If Path editing via GUI didn't work, try Command Prompt method
5. Make sure to **fully close and reopen** command prompt

### Issue: Still getting "FFmpeg not found" error in app

**After verifying** `ffmpeg -version` works in command prompt:

1. Restart your dev server: `npm run dev`
2. Close browser tab
3. Open new browser window to http://localhost:5174
4. Try again

The new dev server instance should now find FFmpeg.

---

## What the App Will Show After FFmpeg is Installed

### Before (Current)
```
[8:16:22 PM] Bắt đầu quy trình tạo audiobook...
[8:16:22 PM] ❌ Lỗi: Unknown error
```

### After FFmpeg is Installed
```
[8:30:00 PM] Bắt đầu quy trình tạo audiobook...
[8:30:00 PM] [Validate Input] 10% - Checking input files...
[8:30:01 PM] [Validate Input] 100% - Input validation successful
[8:30:01 PM] [Compose Video] 10% - Starting banner video composition...
[8:30:60 PM] [Compose Video] 100% - Video composition completed: final_video.mp4
[8:30:60 PM] [Generate Thumbnail] 10% - Generating thumbnail...
[8:31:15 PM] [Generate Thumbnail] 100% - Thumbnail generated: thumbnail.jpg
[8:31:15 PM] ✅ Hoàn thành! Video đã được tạo thành công.
[8:31:15 PM] Video: C:\dev\audiobook-uploader\output\final_video.mp4
[8:31:15 PM] Thumbnail: C:\dev\audiobook-uploader\output\thumbnail.jpg
```

---

## Summary

1. **Install FFmpeg**
   - Chocolatey: `choco install ffmpeg`
   - Or: Manual download + PATH setup

2. **Verify in Command Prompt**
   - New command prompt window
   - Run: `ffmpeg -version`
   - Should show version (not error)

3. **Restart Everything**
   - Close VS Code, terminals, browser
   - Re-run: `npm run dev`
   - Test in fresh browser window

4. **Check Output Folder**
   - Should see actual MP4 and JPG files
   - Takes 30-120 seconds (real execution)

---

## Need Help?

When you've installed FFmpeg and run the app again, if it still shows an error:
- The **error message will now be much more detailed**
- It will show the actual installation instructions in the app
- Check that you:
  1. ✅ Ran `ffmpeg -version` in command prompt (showed version)
  2. ✅ Closed and reopened command prompt AFTER PATH change
  3. ✅ Restarted dev server (`npm run dev`)
  4. ✅ Used a NEW browser window/tab

---

**Let me know once FFmpeg is installed and the app shows the proper error messages with installation instructions!**
