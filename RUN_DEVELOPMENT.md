# How to Run Development Server

## The Issue

When you run `npm run dev`, it **only** starts the Vite development server (React frontend).

The **Electron main process is NOT running**, so:
- IPC handlers don't exist
- `window.api` calls return `undefined`
- You see "Received result: undefined"

## The Solution: Run Both in Separate Terminals

### Terminal 1: Start React Dev Server
```bash
npm run dev
```

This starts Vite on http://localhost:5173 or 5174
You should see: "Local: http://localhost:XXXX"

### Terminal 2: Start Electron
```bash
npm run electron:dev
```

This starts the Electron main process which:
- Loads the React app from Terminal 1
- Registers all IPC handlers
- Opens the app window

## What You Should See

**Terminal 1 (Vite):**
```
  VITE v5.4.21  ready in 456 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**Terminal 2 (Electron):**
```
(The app window opens)
```

**In the App Window:**
- Electron DevTools console appears (Ctrl+Shift+I or F12)
- Shows logs from the main process

## Now You Can Test

1. In the app, go to "Tạo Audiobook" tab
2. Paste Vietnamese text
3. Click button
4. Check **Electron console** (Ctrl+Shift+I in app) for logs with 🔵 🟢 🔴 emojis

## Important: Check the Right Console

- **Browser console (F12 in browser):** Shows "📱 UI: Sending..." logs
- **Electron console (Ctrl+Shift+I in app):** Shows "🔵 IPC Handler..." logs (THIS IS WHERE YOU SEE THE ERROR)

## Quick Reference

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run electron:dev

# Then test in the app that opens
```

## Why This Happens

The project structure has TWO processes:
1. **Renderer Process** (React/Frontend) - Started by Vite
2. **Main Process** (Electron) - Must be started separately with `npm run electron:dev`

Both must be running for IPC communication to work.

## If You Want One Command

You could modify the build setup to run both in one command, but for now, two terminals is the proper way.
