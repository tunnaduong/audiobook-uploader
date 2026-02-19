# Audiobook Uploader - Deployment Guide

**Version**: 0.1.0
**Status**: Ready for Production
**Last Updated**: February 19, 2026

---

## 📋 Quick Start

### Option 1: Download Pre-Built Executable (Easiest)
1. Go to [GitHub Releases](https://github.com/your-username/audiobook-uploader/releases)
2. Download the latest version:
   - **Windows**: `Audiobook-Uploader-0.1.0-x64.exe`
   - **macOS**: `Audiobook-Uploader-0.1.0.dmg`
3. Run the executable and follow the installer prompts

### Option 2: Build Yourself on Native Machine
1. Clone repository: `git clone <repo-url>`
2. On Windows: `./scripts/build-win.bat` or `./scripts/build-win.sh`
3. On macOS: `./scripts/build-mac.sh`
4. Find executables in `dist/release/`

### Option 3: Use GitHub Actions (Automated)
Tag a new release and GitHub Actions automatically builds Windows and macOS executables.

---

## 🔨 Building Executables

### System Requirements

**Minimum**:
- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- 2GB free disk space
- Stable internet connection

**Build Machine Requirements**:
- Windows 10+ (64-bit) for Windows builds
- macOS 10.13+ (Intel or Apple Silicon) for macOS builds
- Xcode Command Line Tools for macOS builds

### Step-by-Step Build Instructions

#### Building on Windows

**Prerequisite**: Install [Node.js 18+](https://nodejs.org/)

```batch
# Clone repository
git clone <repo-url>
cd audiobook-uploader

# Option A: Using batch script (recommended)
.\scripts\build-win.bat

# Option B: Manual steps
npm install
npm run type-check
npm run build:win
```

**Output**:
- `dist/release/Audiobook-Uploader-0.1.0-x64.exe` (Portable)
- `dist/release/AudiobookUploader-0.1.0-Setup-x64.exe` (NSIS Installer)

#### Building on macOS

**Prerequisite**: Install [Node.js 18+](https://nodejs.org/) and Xcode Command Line Tools

```bash
# Clone repository
git clone <repo-url>
cd audiobook-uploader

# Make script executable
chmod +x ./scripts/build-mac.sh

# Run build script
./scripts/build-mac.sh

# Alternative: Manual steps
npm install
npm run type-check
npm run build:mac
```

**Output**:
- `dist/release/Audiobook-Uploader-0.1.0.dmg` (DMG Installer)
- `dist/release/Audiobook-Uploader-0.1.0.zip` (ZIP Archive)

### Build Configuration

The build configuration is in `electron-builder.config.js`:

```javascript
{
  // Windows targets
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },      // NSIS installer
      { target: 'portable', arch: ['x64'] }   // Portable EXE
    ]
  },

  // macOS targets
  mac: {
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },  // DMG installer
      { target: 'zip', arch: ['x64', 'arm64'] }   // ZIP archive
    ]
  }
}
```

To customize the build, edit `electron-builder.config.js` before running the build script.

---

## 📦 Distribution Methods

### Method 1: GitHub Releases (Recommended)

**Setup**:
1. Push code to GitHub
2. Create a git tag: `git tag -a v0.1.0 -m "Release v0.1.0"`
3. Push tag: `git push origin v0.1.0`
4. GitHub Actions automatically builds and creates release

**Users can**:
- Download from GitHub Releases page
- Use auto-updater in app for seamless updates
- Get release notes and changelog

### Method 2: Website Distribution

Host executables on your website:

```
https://yoursite.com/downloads/
├── windows/
│   ├── Audiobook-Uploader-0.1.0-x64.exe
│   └── Audiobook-Uploader-0.1.0-x64.exe.blockmap
└── macos/
    ├── Audiobook-Uploader-0.1.0.dmg
    └── Audiobook-Uploader-0.1.0.zip
```

### Method 3: Direct File Sharing

- Google Drive
- Dropbox
- OneDrive
- Mega
- S3 or other cloud storage

---

## ✅ Installation Instructions for Users

### Windows Installation

**Option A: Using NSIS Installer** (Recommended)
1. Download `AudiobookUploader-0.1.0-Setup-x64.exe`
2. Double-click to run installer
3. Follow setup wizard
4. Click "Finish" to launch app
5. Desktop and Start Menu shortcuts created automatically

**Option B: Using Portable EXE**
1. Download `Audiobook-Uploader-0.1.0-x64.exe`
2. Double-click to run directly
3. No installation required
4. Can move executable anywhere

**Uninstall**:
- Control Panel → Programs → Uninstall (for NSIS installer)
- Delete executable file (for portable version)

### macOS Installation

**Option A: Using DMG Installer** (Recommended)
1. Download `Audiobook-Uploader-0.1.0.dmg`
2. Double-click to open DMG file
3. Drag "Audiobook Uploader" to Applications folder
4. Wait for copy to complete
5. Eject the DMG
6. Launch from Applications folder

**Option B: Using ZIP Archive**
1. Download `Audiobook-Uploader-0.1.0.zip`
2. Extract the ZIP file
3. Drag "Audiobook Uploader.app" to Applications folder
4. Launch from Applications folder

**Uninstall**:
- Drag app from Applications to Trash
- Empty Trash

---

## 🔧 Post-Installation Setup

After installing the app, users need to configure:

### 1. Environment Configuration

Create `.env` file in the app directory or configure via Settings tab:

```bash
# API Keys
VBEE_API_KEY=your_vbee_key
VBEE_APP_ID=your_vbee_app_id
GEMINI_API_KEY=your_gemini_key
YOUTUBE_OAUTH_CLIENT_ID=your_client_id
YOUTUBE_OAUTH_CLIENT_SECRET=your_client_secret

# Paths (auto-detected, can override)
FFMPEG_PATH=/path/to/ffmpeg
YTDLP_PATH=/path/to/yt-dlp
```

### 2. FFmpeg Installation

**Windows**:
```batch
# Download from https://ffmpeg.org/download.html
# Or use Chocolatey
choco install ffmpeg
```

**macOS**:
```bash
# Using Homebrew
brew install ffmpeg
```

App will auto-detect FFmpeg in PATH.

### 3. YouTube OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials (Desktop application)
5. Copy Client ID and Client Secret
6. Add to .env or Settings tab in app
7. Click "Sign in with Google" in app to authenticate

---

## 🐛 Troubleshooting

### Issue: "App failed to start"

**Solution**:
1. Ensure Node.js 18+ is installed
2. Check that all dependencies installed: `npm install`
3. Verify all API keys configured in Settings
4. Check FFmpeg is installed: `ffmpeg -version`

### Issue: "FFmpeg not found"

**Windows**:
```batch
# Install FFmpeg
choco install ffmpeg

# Or download from ffmpeg.org and add to PATH
```

**macOS**:
```bash
# Install FFmpeg
brew install ffmpeg
```

### Issue: "YouTube OAuth failed"

1. Verify Client ID and Secret are correct
2. Check redirect URL is `http://localhost:3000/oauth/callback`
3. Ensure internet connection is working
4. Try disconnecting and reconnecting

### Issue: "Video encoding failed"

1. Ensure FFmpeg is properly installed
2. Check input files exist and are readable
3. Verify disk space available
4. Try with smaller video file

### Issue: "Thumbnail generation timed out"

1. Check internet connection
2. Verify GEMINI_API_KEY is valid
3. Try again after a few minutes
4. Check Google Cloud API quota

---

## 📊 Hardware Acceleration

The app automatically detects and uses hardware acceleration for video encoding:

**macOS**:
- Uses `h264_videotoolbox` (Apple Silicon M1/M2 and Intel)
- ~5-10x faster than software encoding

**Windows**:
- Uses Intel Quick Sync if available (`h264_qsv`)
- Falls back to software encoding (`libx264`)

**Linux**:
- Uses NVIDIA CUDA if available
- Falls back to software encoding

---

## 🔐 Security Considerations

### API Keys
- Never commit `.env` file to git
- Rotate API keys regularly
- Restrict key permissions in Google Cloud Console

### YouTube Tokens
- Stored securely in OS credential manager (keytar)
- Not stored in plain text files
- Refreshed automatically when expired

### File Permissions
- App creates `~/.audiobook-uploader/` directory
- Logs and config stored locally
- No cloud sync unless explicitly configured

---

## 📈 Monitoring and Logging

App logs are stored in: `~/.audiobook-uploader/logs/`

**Log levels**:
- `ERROR` - Critical errors requiring user attention
- `WARN` - Warnings about potentially problematic situations
- `INFO` - General informational messages
- `DEBUG` - Detailed debugging information

View logs:
- Windows: `C:\Users\<username>\.audiobook-uploader\logs\`
- macOS: `~/.audiobook-uploader/logs/`
- Linux: `~/.audiobook-uploader/logs/`

---

## 🚀 Continuous Deployment

### GitHub Actions Workflow

Automatic builds and releases on push to main:

```yaml
on:
  push:
    tags:
      - 'v*'  # Trigger on version tags
```

**To trigger a release**:
```bash
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin v0.2.0
```

GitHub Actions will:
1. Build Windows executable
2. Build macOS executable
3. Create GitHub Release
4. Upload executables as release assets

---

## 📝 Version Management

### Semantic Versioning

Format: `MAJOR.MINOR.PATCH`

- `MAJOR`: Breaking changes
- `MINOR`: New features (backward compatible)
- `PATCH`: Bug fixes

### Release Process

1. Update version in `package.json`
2. Update `RELEASE_NOTES.md` with changes
3. Commit: `git commit -m "chore: bump version to 0.2.0"`
4. Tag: `git tag -a v0.2.0 -m "Release v0.2.0"`
5. Push: `git push && git push --tags`
6. GitHub Actions automatically creates release

---

## 📞 Support

**For issues or feature requests**:
- [GitHub Issues](https://github.com/your-username/audiobook-uploader/issues)
- Email: your-email@example.com

**Documentation**:
- [README.md](./README.md) - Project overview
- [BUILD_GUIDE.md](./BUILD_GUIDE.md) - Building instructions
- [RELEASE_NOTES.md](./RELEASE_NOTES.md) - Feature list and changelog

---

**Happy deploying! 🚀**
