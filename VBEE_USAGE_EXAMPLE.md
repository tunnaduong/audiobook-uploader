# Vbee TTS API - Usage Examples

## Basic Usage

### Example 1: Convert Simple Text

```typescript
import { convertTextToSpeech } from './src/services/vbee'

async function createAudiobook() {
  try {
    const audioFile = await convertTextToSpeech(
      'Chương 1: Ngày xưa có một cô gái tên là Linh...',
      './output/chapter1.mp3'
    )

    console.log('✅ Audio created!')
    console.log(`Duration: ${audioFile.duration}s`)
    console.log(`Size: ${audioFile.fileSize} bytes`)
    console.log(`Path: ${audioFile.path}`)
  } catch (error) {
    console.error('❌ Failed:', error.message)
  }
}

createAudiobook()
```

### Example 2: Specific Voice

```typescript
const audioFile = await convertTextToSpeech(
  'Your story here...',
  './output/story.mp3',
  'hn_male_anh_full_48k-fhg'  // Use male voice
)
```

### Example 3: Long Story (Auto-Chunking)

```typescript
const longStory = `
  Chương 1: Khởi đầu...
  (5000+ characters)
  Chương 2: Phát triển...
  Chương 3: Kết thúc...
`

// Service automatically splits into chunks
const audioFile = await convertTextToSpeech(
  longStory,
  './output/full_story.mp3'
)

// All chunks are automatically:
// 1. Split at sentence boundaries
// 2. Submitted to Vbee separately
// 3. Polled for completion
// 4. Downloaded when ready
// 5. Concatenated into single file
```

### Example 4: Pre-Split Chapters

```typescript
const chapters = [
  'Chương 1: Mở đầu...',
  'Chương 2: Cuộc phiêu lưu...',
  'Chương 3: Kết thúc...',
]

const audioFile = await convertChunkedTextToSpeech(
  chapters,
  './output/story.mp3',
  'hn_female_ngochuyen_full_48k-fhg'
)
```

## Integration with Pipeline

### Example 5: Full Pipeline Integration

```typescript
import { convertTextToSpeech } from './services/vbee'
import { composeVideo } from './services/ffmpeg'
import { uploadVideo } from './services/youtube'

async function processStoryToYoutube(
  storyText: string,
  storyTitle: string
) {
  try {
    // Step 1: Convert text to audio
    console.log('📝 Converting text to speech...')
    const audioFile = await convertTextToSpeech(
      storyText,
      './temp/narration.mp3',
      'hn_female_ngochuyen_full_48k-fhg'
    )
    console.log(`✅ Audio created: ${audioFile.duration}s`)

    // Step 2: Get cooking video
    console.log('🎥 Getting cooking video...')
    const cookingVideo = './videos/recipe.mp4'

    // Step 3: Compose video
    console.log('🎬 Composing video...')
    const finalVideo = await composeVideo(
      './templates/background.png',
      cookingVideo,
      audioFile.path,
      './output/final.mp4'
    )
    console.log(`✅ Video created: ${finalVideo.path}`)

    // Step 4: Upload to YouTube
    console.log('📤 Uploading to YouTube...')
    const result = await uploadVideo(
      finalVideo.path,
      {
        title: `[Audiobook] ${storyTitle}`,
        description: 'Auto-generated audiobook video',
        tags: ['audiobook', 'story', 'recipe'],
        visibility: 'public',
      },
      process.env.YOUTUBE_ACCESS_TOKEN!
    )
    console.log(`✅ Video uploaded: ${result.url}`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    throw error
  }
}

// Usage
processStoryToYoutube(
  'Long story text here...',
  'My Awesome Story'
)
```

## React Integration

### Example 6: React Component (UI)

```typescript
// components/AudiobookCreator.tsx
import React, { useState } from 'react'
import { convertTextToSpeech } from '../services/vbee'

export function AudiobookCreator() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleConvert = async () => {
    setLoading(true)
    setProgress(0)

    try {
      setProgress(20)
      const audioFile = await convertTextToSpeech(
        text,
        './output/audiobook.mp3'
      )

      setProgress(100)
      alert(`✅ Audio created! Duration: ${audioFile.duration}s`)

    } catch (error) {
      alert(`❌ Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your story here..."
        rows={10}
      />

      <button
        onClick={handleConvert}
        disabled={loading || !text}
      >
        {loading ? `Converting... ${progress}%` : 'Convert to Audio'}
      </button>
    </div>
  )
}
```

## Electron Integration

### Example 7: IPC Handler (Main Process)

```typescript
// electron/events.ts
import { ipcMain } from 'electron'
import { convertTextToSpeech } from '../src/services/vbee'

export function setupIpcHandlers(mainWindow) {
  ipcMain.handle('convert-to-audio', async (_event, text, voiceCode) => {
    try {
      const audioFile = await convertTextToSpeech(
        text,
        './output/story.mp3',
        voiceCode
      )

      // Send progress to renderer
      mainWindow.webContents.send('audio-ready', {
        path: audioFile.path,
        duration: audioFile.duration,
      })

      return { success: true, audioFile }
    } catch (error) {
      mainWindow.webContents.send('audio-error', error.message)
      throw error
    }
  })
}
```

### Example 8: Renderer Process (React)

```typescript
// src/components/Dashboard.tsx
import { useEffect } from 'react'

export function Dashboard() {
  useEffect(() => {
    // Listen for audio-ready event
    const unsubscribe = window.api.onAudioReady((data) => {
      console.log('Audio ready:', data.path)
      console.log(`Duration: ${data.duration}s`)
    })

    return unsubscribe
  }, [])

  const handleConvert = async () => {
    await window.api.convertToAudio(
      'Your story text...',
      'hn_female_ngochuyen_full_48k-fhg'
    )
  }

  return (
    <button onClick={handleConvert}>
      Convert Story to Audio
    </button>
  )
}
```

## Error Handling Examples

### Example 9: Comprehensive Error Handling

```typescript
import { convertTextToSpeech, validateVbeeConnection } from './services/vbee'

async function safeConvertToAudio(text: string, outputPath: string) {
  // Check connection first
  const isConnected = await validateVbeeConnection()
  if (!isConnected) {
    throw new Error('Vbee API is not available. Check your credentials.')
  }

  // Validate input
  if (!text || text.trim().length === 0) {
    throw new Error('Story text cannot be empty')
  }

  if (text.length > 100000) {
    console.warn('⚠️ Story is very long, this may take several minutes')
  }

  try {
    const audioFile = await convertTextToSpeech(text, outputPath)
    return audioFile

  } catch (error) {
    if (error.message.includes('timeout')) {
      throw new Error(
        'Conversion timeout. Text is too long or Vbee is overloaded. Try again later.'
      )
    }

    if (error.message.includes('VBEE_API_KEY')) {
      throw new Error(
        'Missing Vbee API key. Check your .env file.'
      )
    }

    throw error
  }
}

// Usage
try {
  const audio = await safeConvertToAudio(storyText, outputPath)
  console.log('✅ Success!')
} catch (error) {
  console.error('❌ Error:', error.message)
  // Show user-friendly error message
}
```

### Example 10: Retry Logic

```typescript
async function convertWithRetry(
  text: string,
  outputPath: string,
  maxAttempts = 3
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxAttempts}...`)
      return await convertTextToSpeech(text, outputPath)

    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }

      const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
      console.log(`Retrying after ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}

// Usage
const audioFile = await convertWithRetry(storyText, outputPath)
```

## Batch Processing

### Example 11: Process Multiple Stories

```typescript
async function processMultipleStories(stories: Array<{
  title: string
  text: string
}>) {
  const results = []

  for (const story of stories) {
    try {
      console.log(`Processing: ${story.title}...`)

      const audioFile = await convertTextToSpeech(
        story.text,
        `./output/${story.title}.mp3`
      )

      results.push({
        title: story.title,
        status: 'success',
        audioFile,
      })

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error) {
      results.push({
        title: story.title,
        status: 'error',
        error: error.message,
      })
    }
  }

  return results
}

// Usage
const stories = [
  { title: 'Story 1', text: 'Once upon a time...' },
  { title: 'Story 2', text: 'In a far away land...' },
]

const results = await processMultipleStories(stories)
results.forEach(result => {
  if (result.status === 'success') {
    console.log(`✅ ${result.title}: ${result.audioFile.duration}s`)
  } else {
    console.log(`❌ ${result.title}: ${result.error}`)
  }
})
```

## Configuration Examples

### Example 12: Custom Settings

```typescript
// Create a configuration object
const vbeeConfig = {
  voices: {
    female: 'hn_female_ngochuyen_full_48k-fhg',
    male: 'hn_male_anh_full_48k-fhg',
  },
  audioSettings: {
    bitrate: 128,        // High quality
    speedRate: 1.0,      // Normal speed
    audioType: 'mp3',    // MP3 format
  },
  processing: {
    maxChunkSize: 2000,  // Characters per chunk
    pollAttempts: 60,    // Max polling attempts
    pollDelay: 1000,     // 1 second between polls
  },
}

// Use configuration
const audioFile = await convertTextToSpeech(
  text,
  outputPath,
  vbeeConfig.voices.female
)
```

## Advanced: Custom Polling

### Example 13: Custom Polling with Progress Updates

```typescript
async function convertWithProgressTracking(
  text: string,
  outputPath: string,
  onProgress?: (progress: number) => void
) {
  // Submit TTS request
  const requestId = await submitTtsRequest(text)

  // Custom polling with progress updates
  let progress = 0
  const maxAttempts = 60

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkTtsStatus(requestId)

    if (status.status === 'SUCCESS') {
      onProgress?.(100)
      return downloadAndSaveAudio(status.audio_link, outputPath)
    }

    progress = Math.round((attempt / maxAttempts) * 100)
    onProgress?.(progress)

    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error('Conversion timeout')
}

// Usage with progress callback
await convertWithProgressTracking(
  storyText,
  outputPath,
  (progress) => {
    console.log(`Progress: ${progress}%`)
    // Update UI progress bar
    progressBar.style.width = `${progress}%`
  }
)
```

---

**For more examples and detailed documentation, see:**
- VBEE_API_INTEGRATION.md
- src/services/vbee.ts (source code with comments)
- README.md (project overview)
