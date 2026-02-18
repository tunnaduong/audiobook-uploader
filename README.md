# Audiobook + Cooking Video Automation Desktop App

A powerful desktop application for automating the creation of audiobook + cooking video content (popular Vietnamese "re-up" format). This app streamlines the entire workflow from video sourcing to YouTube upload.

## Features

- **Douyin Video Download**: Automatically source cooking videos from Douyin using yt-dlp
- **Text-to-Speech Conversion**: Convert story text to audio using Vbee API
- **Video Composition**: Combine cooking video, background, and narration into 1920x1080 output
- **Thumbnail Generation**: Auto-generate anime-style thumbnails using Gemini + Banana APIs
- **YouTube Upload**: Direct video upload to YouTube with metadata
- **Project History**: Track all past projects with SQLite database
- **Cross-Platform**: Native support for Windows and macOS

## Tech Stack

- **Desktop Framework**: Electron.js
- **Frontend**: React 18 + TypeScript
- **Backend**: Node.js (child processes)
- **Database**: SQLite (better-sqlite3)
- **Video Processing**: FFmpeg (hardware-accelerated)
- **Styling**: CSS + TailwindCSS

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <repo-url>
cd audiobook-uploader
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from template:
```bash
cp .env.example .env
```

4. Add your API keys to `.env`:
```
COMET_API_KEY=your_cometapi_key_here      # For Nano Banana image generation
GEMINI_API_KEY=your_gemini_key_here       # For text prompt generation
VBEE_API_KEY=your_vbee_key_here
VBEE_APP_ID=your_vbee_app_id_here
YOUTUBE_API_KEY=your_youtube_key_here     # Optional
```

**API Key Setup:**
- **Nano Banana (Image Generation):** See [NANO_BANANA_SETUP.md](./NANO_BANANA_SETUP.md) - CometAPI setup (5 min, 2-5x cheaper than Google official!)
- **Gemini (Text Prompts):** Get from https://aistudio.google.com/app/apikey
- **Vbee (Voiceover):** Get from https://vbee.vn
- **YouTube (Optional):** Get from Google Cloud Console

## Development

### Start Development Server

```bash
# Terminal 1: Start React dev server
npm run dev

# Terminal 2: Start Electron app
npm run electron:dev
```

### Build for Production

```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:win   # Windows
npm run build:mac   # macOS
```

## Project Structure

```
audiobook-uploader/
├── electron/                 # Electron main process
│   ├── main.ts              # App entry point
│   ├── preload.ts           # IPC security bridge
│   ├── events.ts            # IPC event handlers
│   └── utils.ts             # Electron utilities
├── src/                      # React frontend
│   ├── components/          # React components
│   ├── pages/               # Page components
│   ├── services/            # API/service layer
│   ├── utils/               # Utilities
│   │   ├── database.ts      # SQLite operations
│   │   ├── ffmpeg-setup.ts  # FFmpeg management
│   │   ├── ytdlp-setup.ts   # yt-dlp management
│   │   └── logger.ts        # Logging system
│   ├── types/               # TypeScript interfaces
│   ├── App.tsx              # Root component
│   └── main.tsx             # React entry point
├── public/                   # Static assets
└── package.json             # Project configuration
```

## Pipeline Workflow

1. **Validate Input**: Check all input files exist
2. **Generate Audiobook Voiceover**: Transform story text into MP3 audio using Vbee API
3. **Compose Video**: Combine banner + looped cooking video + voiceover (FFmpeg)
4. **Generate Thumbnail**: Create Modern Oriental style thumbnail using Nano Banana (Gemini 2.5 Flash Image) with avatar style reference
5. **Upload to YouTube** (Optional): Publish video with metadata

**Technology Stack:**
- Video: FFmpeg (hardware-accelerated)
- Audio: Vbee TTS (Vietnamese optimized)
- Thumbnail: Nano Banana via CometAPI (fast, high-quality, affordable)

## Configuration

### Environment Variables

See `.env.example` for all available options.

### FFmpeg & yt-dlp

The app will automatically:
1. Check for globally installed FFmpeg/yt-dlp
2. Fall back to bundled versions in `~/.audiobook-uploader/bin/`
3. Download if missing

## Troubleshooting

### FFmpeg Not Found
- Ensure FFmpeg is installed globally, or
- The app will attempt to download it automatically

### yt-dlp Connection Issues
- Check internet connection
- Update yt-dlp: `yt-dlp -U`
- Configure proxy if behind corporate firewall

### Database Errors
- Delete `~/.audiobook-uploader/app.db` to reset
- Check logs in `~/.audiobook-uploader/logs/`

## Performance Tips

### macOS M1/M2
- Uses hardware video encoding (`h264_videotoolbox`) for 5-10x faster rendering

### Windows
- Enable Intel Quick Sync if available
- Use SSD for temp files

## API Keys & Services

Required services and their setup:

1. **Vbee API**: Text-to-speech
   - Get key from: https://vbee.vn

2. **YouTube API**: Video upload
   - Create project at: https://console.cloud.google.com
   - Enable YouTube Data API v3

3. **Gemini API**: Thumbnail prompt generation
   - Get key from: https://ai.google.dev

4. **Banana API**: Image generation
   - Get key from: https://www.banana.dev

## License

Proprietary - All rights reserved

## Support

For issues and questions, please check the logs at `~/.audiobook-uploader/logs/`

