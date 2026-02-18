# Development Setup - Two Terminal Method

## Step 1: Terminal 1 - Start Vite Dev Server

```bash
npm run dev
```

**You should see:**
```
  VITE v5.4.21  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**Important:** Note the port number (5173 or 5174 if 5173 is busy)

If you see something different, make sure you:
- ✅ Are in the `C:\dev\audiobook-uploader` directory
- ✅ Ran `npm install` (if you haven't already)
- ✅ Have Node.js 18+ installed

## Step 2: Terminal 2 - Start Electron

In a **different terminal/tab**, run:

```bash
npm run electron:dev
```

**What happens:**
1. Electron main process starts
2. App window opens
3. Loads React app from Vite dev server (Terminal 1)
4. Shows browser console with logs

## Step 3: Test the Pipeline

1. In the app window, go to "Tạo Audiobook" tab
2. Paste Vietnamese story text
3. Click "▶️ Tạo Audiobook" button

**Watch the console logs:**

**Browser Console (F12 in browser tab):**
```
📱 UI: Sending pipeline config to IPC handler
📱 UI: Received result from IPC handler: {...}
```

**Electron Console (Ctrl+Shift+I in app window):**
```
🔵 IPC Handler: Starting pipeline
📋 Config: storyTitle=..., bannerImage=...
🔴 IPC Handler: EXCEPTION CAUGHT
Message: FFmpeg is required but not installed.
```

## Important: Which Console to Check

| Console | How to Open | Shows |
|---------|------------|-------|
| **Browser** | F12 in browser tab | React/UI logs (📱 prefix) |
| **Electron** | Ctrl+Shift+I in app window | Main process logs (🔵🟢🔴 prefix) |

**The actual error is in the Electron console!**

## If Electron Shows Error

If Electron window doesn't open or shows error:

### Error: "Failed to load dev server"
- ✅ Check Terminal 1: Is Vite running on port 5173 or 5174?
- ✅ Check port number in Terminal 1 output
- ✅ If different port, Electron will auto-retry (Vite has `strictPort: false`)

### Error: "Cannot find module X"
- ✅ Run `npm install` to ensure dependencies installed
- ✅ Run `npm run build:electron` to recompile

### Error about "require() of ES Module"
- ✅ That's fixed! You should not see this anymore

## Troubleshooting Checklist

- [ ] Terminal 1: Running `npm run dev` (shows "Local: http://localhost:5173" or similar)
- [ ] Terminal 2: Running `npm run electron:dev` (app window opens)
- [ ] App window shows tabs (Tạo Audiobook, Settings, etc.)
- [ ] Electron DevTools shows logs when button is clicked
- [ ] You can see 🔵 or 🔴 logs in Electron console

## Next: Finding the Real Error

Once both are running and you click the button:

1. Open Electron console: `Ctrl+Shift+I` in app window
2. Look for red 🔴 lines
3. Find line that says: `Message: ...`
4. **That's the real error!**

Expected errors:
- "FFmpeg is required but not installed" → Install FFmpeg
- "Cannot find input file" → Check input files exist
- "Gemini API key missing" → Set GEMINI_API_KEY environment variable

## Quick Start

```bash
# Terminal 1
npm run dev

# Terminal 2 (in another terminal/tab)
npm run electron:dev

# Then test in the app that opens
```

That's it! Both must run together for development.
