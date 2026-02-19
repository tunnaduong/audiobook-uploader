# Audiobook Uploader v0.1.0 - Build Guide

## ✅ Build Status

- ✅ **Source Code**: Fully compiled and ready
- ✅ **Electron Main**: TypeScript compiled to JavaScript
- ✅ **React UI**: Vite bundled for production
- ✅ **Dependencies**: All dependencies included in package.json
- ⚠️  **Executable Packaging**: See solutions below

## 🚀 Building Executables

### On **Native Windows**:
```bash
npm install
npm run build:win
# Output: dist/release/*.exe (NSIS installer + portable)
```

### On **Native macOS**:
```bash
npm install
npm run build:mac
# Output: dist/release/*.dmg (DMG installer)
# Output: dist/release/*.zip (ZIP archive)
```

### On **Native Linux**:
```bash
npm install
npm run build        # Generates AppImage
```

## 🔧 Current Environment Status

**Environment**: Windows Subsystem for Linux (WSL2)

**Current Limitation**: electron-builder encounters file locking issues on WSL2 when packaging the application.

**Reason**: app.asar file is locked during the build process, preventing electron-builder from completing the packaging step.

## ✅ Alternative Solutions

### Solution 1: Build on Native Windows
1. Install Node.js on native Windows
2. Extract the source
3. Run `npm run build:win`
4. Executables will be in `dist/release/`

### Solution 2: Build on macOS
For macOS builds, use a native macOS machine:
```bash
npm run build:mac
```

### Solution 3: Use GitHub Actions (CI/CD)
Set up GitHub Actions to automatically build on Windows and macOS runners:
```yaml
jobs:
  build:
    runs-on: [windows-latest, macos-latest]
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build:win  # On Windows runner
      - run: npm run build:mac  # On macOS runner
```

### Solution 4: Use Docker
Build inside a clean Docker container:
```bash
docker build -t audiobook-uploader .
docker run -v $(pwd):/app audiobook-uploader npm run build:win
```

## 📦 Current Distributable Files

### Source + Build Config (Ready Now)
- **audiobook-uploader-v0.1.0-source.zip** (152 KB)
  - Contains: source code, build config, all dependencies listed
  - Ready to build on any platform with `npm install && npm run build:win/mac`

### Distribution Methods

#### Method 1: Portable Executable (Recommended for testing)
1. On native Windows:
   ```bash
   npm run build:win
   ```
2. Users run `.exe` directly - no installation needed
3. File size: ~300-400 MB

#### Method 2: NSIS Installer (Professional)
1. On native Windows with npm run build:win
2. Users install via Setup wizard
3. Creates Start Menu shortcuts
4. Allows custom installation directory
5. File size: ~150-200 MB

#### Method 3: DMG Package (macOS)
1. On native macOS:
   ```bash
   npm run build:mac
   ```
2. Users drag & drop to Applications
3. Professional appearance
4. Supports Intel and Apple Silicon

## 🛠️ Build Configuration

The application uses `electron-builder` which is configured in:
- **electron-builder.config.js**:
  - Windows targets: NSIS installer + portable EXE
  - macOS targets: DMG + ZIP
  - Code signing: Disabled (set to null for development)

### Customization

To customize the build:

1. **Change output directory**:
   ```javascript
   directories: {
     output: 'your/custom/path'
   }
   ```

2. **Add code signing**:
   ```javascript
   win: {
     certificateFile: 'path/to/cert.pfx',
     certificatePassword: 'password'
   }
   ```

3. **Add auto-updates**:
   ```javascript
   publish: {
     provider: 'github',
     owner: 'your-username',
     repo: 'audiobook-uploader'
   }
   ```

## 📋 Pre-Build Checklist

Before running builds:
- [ ] `npm install` completed successfully
- [ ] `.env` file configured with API keys
- [ ] `npm run type-check` passes
- [ ] `npm run build:electron` compiles
- [ ] `npm run build:renderer` completes

## 🐛 Troubleshooting

### Issue: "The process cannot access the file because it is being used by another process"
**Solution**: 
- On WSL: Switch to native Windows or use Docker
- Kill Node processes: `taskkill /F /IM node.exe`
- Clean build: `rm -rf dist && npm run build:win`

### Issue: "Author is missed in package.json"
**Solution**: Add author field to package.json:
```json
{
  "author": "Your Name <your.email@example.com>"
}
```

### Issue: "Icon file not found"
**Solution**: Create icon at `public/icon.png` (at least 512x512 PNG)

## 📦 Deployment

Once you have built `.exe`, `.dmg`, or other executables:

1. **Windows EXE**:
   - Distribute via your website
   - Auto-update via electron-updater
   - Code sign for Windows SmartScreen

2. **macOS DMG**:
   - Distribute via website
   - Notarize for Gatekeeper
   - Code sign

3. **Both Formats**:
   - Host on GitHub Releases
   - Include version notes
   - Provide checksums for verification

## ✅ Verification Checklist After Build

```bash
# Test the executable
./dist/release/Audiobook-Uploader-0.1.0-x64.exe

# Verify it:
# 1. Launches successfully
# 2. Can access Settings tab
# 3. Can click "Sign in with Google"
# 4. Browser opens for OAuth
# 5. Can select files and create videos
```

## 🔗 Next Steps

1. **For Windows Builds**: 
   - Use native Windows with Node.js installed
   - Run `npm run build:win`
   - Output: `dist/release/*.exe` and `*.exe.blockmap`

2. **For macOS Builds**:
   - Use native macOS
   - Run `npm run build:mac`
   - Output: `dist/release/*.dmg` and `*.zip`

3. **For Automated Builds**:
   - Set up GitHub Actions
   - Use matrix builds for Windows + macOS
   - Auto-publish to GitHub Releases

---

**Last Updated**: Feb 19, 2026
**Version**: 0.1.0
**Status**: Ready for deployment

For more information, see `RELEASE_NOTES.md`
