# Local Build Guide for Beginners

Welcome to Electron development! Here's a simple step-by-step guide to build and test the app locally.

## 📋 Prerequisites

Make sure you have installed:
- **Node.js** (v18+) - Check with: `node --version`
- **npm** - Comes with Node.js - Check with: `npm --version`
- **Git** - For version control

## 🚀 Step 1: Install Dependencies

This downloads all the packages the app needs:

```bash
npm install
```

**What this does**: Downloads ~500MB of dependencies from npm registry into the `node_modules/` folder.

## ✅ Step 2: Verify TypeScript Compiles

Before building, make sure there are no TypeScript errors:

```bash
npm run type-check
```

**Expected output**: No errors (just returns to prompt)

## 🔨 Step 3: Build Components

The app has two parts that need to be compiled:

### Part A: Build Electron (Backend)
```bash
npm run build:electron
```

**What this does**:
- Compiles TypeScript code in `electron/` folder
- Creates JavaScript files in `dist/electron/`
- This is the app backend that handles file operations, system access, etc.

### Part B: Build React (Frontend)
```bash
npm run build:renderer
```

**What this does**:
- Builds React UI code using Vite bundler
- Creates optimized HTML/CSS/JavaScript in `dist/renderer/`
- This is what users see in the window

## 🎯 Step 4: Build the Executable (Local Test Version)

Now we build the actual Windows executable:

```bash
npm run build:win:local
```

**What this does**:
- Packages everything into a Windows .exe file
- Creates `dist/Audiobook Uploader-0.1.0.exe` (portable version)
- No installation needed - just run it!
- Skips code signing (CSC_IDENTITY_AUTO_DISCOVERY=false) for local testing

**Expected output**:
```
electron-builder version=24.13.3
loaded configuration file=package.json ("build" field)
rebuilding native dependencies
packaging platform=win32 arch=x64
building target=portable
✓ built in XXXs
```

## 🎮 Step 5: Test the App

After step 4 completes, find your executable:

```
dist/Audiobook Uploader-0.1.0.exe
```

**To run it**:
1. Open File Explorer
2. Navigate to: `C:\dev\audiobook-uploader\dist\`
3. Double-click: `Audiobook Uploader-0.1.0.exe`

**Expected**: The app window opens with the React UI

## 🐛 Debugging

If the window appears blank/white:

1. **Open Developer Tools**:
   - Press `Ctrl+Shift+I` in the app window
   - Check the "Console" tab for errors

2. **Check Electron Console**:
   - Look for messages about where it's looking for `index.html`
   - Should show something like: `📱 Found index.html at: ...`

## 📁 Folder Structure

```
audiobook-uploader/
├── electron/          ← Electron (backend) source code
│   ├── main.ts       ← Main entry point
│   ├── preload.ts    ← Bridge between UI and backend
│   └── events.ts     ← IPC handlers
├── src/
│   ├── components/   ← React components (UI)
│   ├── services/     ← Business logic
│   └── types/        ← TypeScript types
├── dist/             ← Compiled output (created by build)
│   ├── electron/     ← Compiled backend
│   ├── renderer/     ← Compiled UI (HTML/CSS/JS)
│   └── Audiobook...exe ← Final executable
└── package.json      ← Scripts and dependencies
```

## 🔄 Build Process Flow

```
1. npm run build:electron
   electron/**/*.ts → (TypeScript compile) → dist/electron/**/*.js

2. npm run build:renderer
   src/**/*.tsx → (Vite bundle) → dist/renderer/**/*

3. npm run build:win:local
   dist/ → (electron-builder package) → dist/Audiobook...exe
```

## ✅ What Each Part Does

| Component | Purpose | Location |
|-----------|---------|----------|
| **Electron** | Backend - file access, system operations | `electron/` → `dist/electron/` |
| **React** | Frontend - user interface | `src/` → `dist/renderer/` |
| **electron-builder** | Packaging - creates .exe installer | `package.json` → `dist/*.exe` |

## 🎯 Troubleshooting

### Error: "Could not find index.html"
**Cause**: Renderer files not built
**Fix**: Run `npm run build:renderer` again

### Error: "ENOENT: no such file or directory"
**Cause**: Missing files
**Fix**: Run `npm run build:electron && npm run build:renderer`

### App shows blank window
**Cause**: Renderer path detection failing
**Fix**: Check DevTools console (Ctrl+Shift+I) for path messages

### Build takes forever
**Cause**: First build downloads electron and tools
**Fix**: Normal - first build takes 5-10 minutes, subsequent builds are faster

## 📝 Full Build Command (One Line)

If you want to do everything in one command:

```bash
npm run build:electron && npm run build:renderer && npm run build:win:local
```

Or even simpler - we can add a helper script. Would you like me to add one?

## 🚀 After Testing

Once the local exe works:

1. **Push changes to GitHub**:
   ```bash
   git add .
   git commit -m "your message"
   git push origin main
   ```

2. **Create release tag**:
   ```bash
   git tag -a v0.2.16 -m "Release v0.2.16"
   git push origin v0.2.16
   ```

3. **GitHub Actions builds automatically** for Windows release

## 💡 Tips

- **First build is slow** (downloads Electron, tools, compiles everything)
- **Subsequent builds are faster** (only recompiles changed files)
- **If build fails**, check error message - usually missing dependencies or TypeScript errors
- **Use `npm run type-check`** before building to catch errors early

---

That's it! You now know how to build the app locally. 🎉

Feel free to ask if you get stuck on any step!
