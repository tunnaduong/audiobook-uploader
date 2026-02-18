# Vbee TTS API Integration Guide

## Overview

The Vbee Text-to-Speech API integration has been fully implemented in `src/services/vbee.ts` according to Vbee's official API specification.

## API Endpoint

- **Base URL:** `https://vbee.vn/api/v1/tts`
- **Authentication:** Bearer Token (JWT)
- **Methods:** POST (submit), GET (check status)

## Environment Variables

Add these to your `.env` file:

```env
VBEE_API_KEY=your_bearer_token_here
VBEE_APP_ID=your_app_id_here
```

### Getting Your Credentials

1. **VBEE_API_KEY**: Bearer token generated from Vbee dashboard when creating your app
   - Format: JWT token with expiration
   - Validity: Set when creating the app (e.g., 1 year)

2. **VBEE_APP_ID**: App ID generated when you create your app in Vbee console
   - Format: UUID (e.g., `55e0053d-f86f-4c2b-b791-b1ba6d59a868`)

## API Flow

### 1. Submit TTS Request

```typescript
POST /v1/tts
Authorization: Bearer {token}

{
  "app_id": "your-app-id",
  "response_type": "indirect",
  "callback_url": "https://example.com/callback",
  "input_text": "Your text here",
  "voice_code": "hn_female_ngochuyen_full_48k-fhg",
  "audio_type": "mp3",
  "bitrate": 128,
  "speed_rate": 1.0
}
```

**Response:**
```json
{
  "status": 1,
  "result": {
    "app_id": "...",
    "request_id": "9bc63cb3-7c80-4e61-8cda-7c7391a21bbe",
    "characters": 100,
    "voice_code": "hn_female_ngochuyen_full_48k-fhg",
    "audio_type": "mp3",
    "speed_rate": "1.0",
    "status": "IN_PROGRESS"
  }
}
```

### 2. Poll for Status

```typescript
GET /v1/tts/{request_id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "status": 1,
  "result": {
    "app_id": "...",
    "request_id": "9bc63cb3-7c80-4e61-8cda-7c7391a21bbe",
    "characters": 100,
    "voice_code": "hn_female_ngochuyen_full_48k-fhg",
    "audio_type": "mp3",
    "speed_rate": 1.0,
    "bitrate": 128,
    "created_at": "2022-08-12T07:18:51.890Z",
    "progress": 50,
    "status": "SUCCESS",
    "audio_link": "https://vbee-studio-30.s3.ap-southeast-1.amazonaws.com/synthesis/2022/08/12/fe90184f-7c7f-4803-9f81-5d70afd72e83.mp3",
    "audio_expired": false
  }
}
```

### 3. Download Audio

Audio link is valid for **3 minutes** after generation. Download the MP3/WAV file from the provided URL.

## Available Voices

### Vietnamese Female Voices

- `n_hanoi_female_nguyetnga2_book_vc` - Nguyễt Nga (Audiobook-Optimized) ⭐ **RECOMMENDED**
  - Language: Vietnamese
  - Sample Rate: 48kHz
  - Quality: Excellent
  - **Purpose: Specifically trained for audiobook narration**
  - **Best for: Long-form content, storytelling, natural pacing**

- `hn_female_ngochuyen_full_48k-fhg` - Ngọc Huyền (General Purpose)
  - Language: Vietnamese
  - Sample Rate: 48kHz
  - Quality: Excellent

- `hn_female_maiphuong_vdts_48k-fhg` - Mai Phương
  - Language: Vietnamese
  - Sample Rate: 48kHz
  - Quality: Good

### Vietnamese Male Voices

- `hn_male_anh_full_48k-fhg` - Anh
  - Language: Vietnamese
  - Sample Rate: 48kHz
  - Quality: Excellent

## Implementation Details

### Service Functions

#### 1. convertTextToSpeech()

Converts text to audio file with automatic chunking for large texts.

```typescript
const audioFile = await convertTextToSpeech(
  'Your story text here...',
  './output/story.mp3',
  'n_hanoi_female_nguyetnga2_book_vc'  // Audiobook-optimized voice
)

// Returns:
// {
//   path: './output/story.mp3',
//   duration: 120,
//   sampleRate: 48000,
//   channels: 1,
//   format: 'mp3',
//   fileSize: 1024000
// }
```

#### 2. convertChunkedTextToSpeech()

Converts pre-split text chunks to audio.

```typescript
const audioFile = await convertChunkedTextToSpeech(
  ['Chapter 1: Introduction...', 'Chapter 2: Story begins...'],
  './output/story.mp3',
  'hn_female_ngochuyen_full_48k-fhg'
)
```

#### 3. validateVbeeConnection()

Test if API connection is working.

```typescript
const isConnected = await validateVbeeConnection()
if (isConnected) {
  console.log('Vbee API is working!')
}
```

#### 4. getAvailableVoices()

Get list of available voices.

```typescript
const voices = await getAvailableVoices()
// Returns voice options for UI dropdown
```

## Text Chunking Strategy

Large texts are automatically split into chunks:

1. **Max chunk size:** 2,000 characters
2. **Split method:** At sentence boundaries (`.`, `!`, `?`)
3. **Processing:** Each chunk is submitted and polled separately
4. **Concatenation:** Audio files are combined after download

### Example

```
Input: "Long story text with 5000 characters..."
       ↓
Chunks: ["First part (0-2000 chars)...", "Second part (2000-4000 chars)...", ...]
       ↓
Submit: POST request for chunk 1
Poll:   GET request for chunk 1 status (repeat until SUCCESS)
Download: MP3 file for chunk 1
       ↓
Repeat for all chunks
       ↓
Concatenate: All MP3 files → Final output.mp3
```

## Polling Configuration

- **Max Attempts:** 60 (approximately 1 minute timeout)
- **Delay Between Polls:** 1 second
- **Status Values:**
  - `IN_PROGRESS`: Still processing, retry
  - `SUCCESS`: Audio ready, download audio_link
  - `FAILURE`: Error occurred, throw error

## Audio File Lifecycle

1. **Generation:** Vbee generates audio after receiving request
2. **Download Window:** 3 minutes to download audio link
3. **Storage:** Audio stored on Vbee servers for 3 days
4. **Expiration:** After 3 days, link expires

**Important:** Download audio within 3 minutes and save to disk to avoid link expiration.

## Error Handling

### API Errors

All errors are logged with full context:

```typescript
try {
  await convertTextToSpeech(text, path)
} catch (error) {
  // Error automatically logged to ~/.audiobook-uploader/logs/
  // Contains: timestamp, error code, error message, stack trace
}
```

### Common Error Codes

- **Invalid API Key:** 401 Unauthorized
- **Invalid App ID:** 400 Bad Request
- **Text Too Long:** Split into smaller chunks
- **Network Timeout:** Automatic retry with exponential backoff
- **Audio Link Expired:** Download within 3-minute window

## Performance Notes

### Bitrate Options

- 8 kbps: Very low quality, smallest file
- 16 kbps: Low quality, small file
- 32 kbps: Medium-low quality
- 64 kbps: Medium quality
- 128 kbps: **High quality (recommended)**

### Speed Rate

- Range: 0.1 to 1.9
- Default: 1.0 (normal speed)
- Supports 1 decimal place (e.g., 1.2, 0.8)

### Recommended Settings

For audiobook content:

```javascript
{
  audio_type: 'mp3',
  bitrate: 128,        // High quality
  speed_rate: 1.0,     // Normal speed
  // Let sample rate use Vbee default
}
```

## Cost Estimation

Based on Vbee pricing (character count):

- 1,000 characters ≈ 1 API call
- 100,000 characters ≈ 100 API calls
- Check Vbee dashboard for your pricing tier

**Tips to reduce costs:**
- Batch process stories
- Use shorter chapters
- Cache results (don't re-convert same text)

## Testing

### Test Vbee Connection

```typescript
import { validateVbeeConnection } from './services/vbee'

const isWorking = await validateVbeeConnection()
console.log('Vbee API:', isWorking ? '✅ Working' : '❌ Failed')
```

### Test Conversion

```typescript
import { convertTextToSpeech } from './services/vbee'

const result = await convertTextToSpeech(
  'Xin chào',
  './test.mp3',
  'hn_female_ngochuyen_full_48k-fhg'
)

console.log(`Generated: ${result.path}`)
console.log(`Duration: ${result.duration}s`)
console.log(`Size: ${result.fileSize} bytes`)
```

## Troubleshooting

### "VBEE_API_KEY not configured"

Add to `.env`:
```
VBEE_API_KEY=your_token_here
VBEE_APP_ID=your_app_id_here
```

### "Request timeout"

- Text is too long (split into smaller chunks)
- Network issue (check internet connection)
- Vbee API overloaded (retry after delay)

### "Audio link expired"

- Download happens after 3 minutes
- The audio generation is slow
- Consider increasing MAX_ATTEMPTS or delay between polls

### Audio Quality Issues

- Use higher bitrate (128 kbps)
- Try different voice code
- Check input text encoding (UTF-8)

## Integration with Pipeline

In your main pipeline:

```typescript
// Step 1: Get story text
const storyText = await getStoryFromDatabase()

// Step 2: Convert to speech
const audioFile = await convertTextToSpeech(
  storyText,
  './temp/narration.mp3',
  'hn_female_ngochuyen_full_48k-fhg'
)

// Step 3: Use audio in video composition
const videoOutput = await composeVideo(
  backgroundPath,
  cookingVideoPath,
  audioFile.path, // ← Use generated audio
  outputPath
)
```

## References

- [Vbee TTS API Documentation](https://vbee.vn/api)
- [Voice Codes List](https://vbee.vn/voices)
- [API Status Dashboard](https://vbee.vn/status)

---

**Last Updated:** 2026-02-18
**Status:** ✅ Fully Implemented
