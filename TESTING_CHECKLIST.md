# Testing Checklist - New Features

## Pre-Testing Setup

- [ ] Copy API key from https://aistudio.google.com/app/apikey
- [ ] Set environment variable: `GEMINI_API_KEY=your_key`
- [ ] Set Vbee keys: `VBEE_API_KEY=...` and `VBEE_APP_ID=...`
- [ ] Run `npm install` (if first time)
- [ ] Terminal 1: `npm run dev` (React dev server)
- [ ] Terminal 2: `npm run electron:dev` (Electron app)
- [ ] Open DevTools: Ctrl+Shift+I in Electron app

---

## Test 1: Vbee Voiceover Generation

### Preconditions
- [ ] VBEE_API_KEY and VBEE_APP_ID set in environment
- [ ] All input files exist (banner, cooking video, avatar)
- [ ] Output directory exists

### Test Steps
1. Open app in Electron
2. Fill in form:
   - Story Title: "Test Story"
   - Story Text: "This is a test audiobook. The hero went on a journey..."
   - Select all file inputs
3. Click pipeline button

### Expected Results
- [ ] Electron console shows: `🔊 Audiobook voiceover generated: voiceover.mp3 (NNNs)`
- [ ] voiceover.mp3 appears in output folder
- [ ] Audio file plays correctly (test with media player)
- [ ] Duration shown in progress message

### Failure Debugging
If fails, check Electron console for:
```
Error: VBEE_API_KEY and VBEE_APP_ID are required
→ Solution: Set environment variables and restart

Error: Vbee API error: {error_message}
→ Solution: Check API keys and Vbee account status

Failed to convert text to speech
→ Solution: See .claude/CLAUDE.md debugging section
```

---

## Test 2: Thumbnail Generation with Vision

### Preconditions
- [ ] GEMINI_API_KEY set in environment
- [ ] Avatar image file exists (e.g., avatar.png)
- [ ] Output directory exists

### Test Steps
1. Same as Test 1
2. Monitor progress for Step 4: "Generate Thumbnail"

### Expected Results
- [ ] Electron console shows: `Avatar image loaded and encoded: /path/to/avatar.png`
- [ ] Log shows: `Avatar image included in request for style reference`
- [ ] Log shows: `✅ Thumbnail saved successfully`
- [ ] thumbnail.jpg appears in output folder
- [ ] File size > 10KB (valid image)

### Image Quality Check
- [ ] Open thumbnail.jpg with image viewer
- [ ] Check image is not corrupted/all black
- [ ] Modern Oriental style visible
- [ ] Avatar style influence present (subjective)

### Failure Debugging
If fails, check Electron console for:
```
No image data found in Gemini response
→ Check: GEMINI_API_KEY valid at aistudio.google.com

Image data appears invalid (length: 0)
→ Check: API key rate limits at console.cloud.google.com

Model not found (404)
→ Check: Model name hasn't changed (imagen-3.0-generate-001)

API Key invalid (401)
→ Solution: Generate new key at aistudio.google.com
```

---

## Test 3: Complete Pipeline Run

### Preconditions
All from Test 1 + Test 2

### Test Steps
1. Complete form with real story text (100-500 words)
2. Click pipeline button
3. Wait for completion (~3-5 minutes)
4. Check all outputs

### Expected Results
- [ ] Step 1: "Input validation successful"
- [ ] Step 2: "Audiobook voiceover generated: voiceover.mp3 (XXXs)"
- [ ] Step 3: "Video composition completed: final_video.mp4"
- [ ] Step 4: "Thumbnail generated: thumbnail.jpg"
- [ ] Step 5: "YouTube upload skipped" (unless enabled)
- [ ] All files appear in output folder
- [ ] Video plays with audio (voiceover)
- [ ] Thumbnail displays correctly

### Performance Notes
- [ ] Vbee step: 30-60s (note actual duration)
- [ ] Video composition: 60-120s (note actual duration)
- [ ] Thumbnail: 20-30s (note actual duration)
- [ ] Total: 3-5 minutes

---

## Test 4: Error Handling - Missing API Key

### Test Steps
1. Comment out GEMINI_API_KEY from environment
2. Run pipeline

### Expected Results
- [ ] Thumbnail step shows warning: "GEMINI_API_KEY not set"
- [ ] Pipeline continues (doesn't fail)
- [ ] Creates placeholder thumbnail instead
- [ ] Log shows: "Using placeholder thumbnail instead"

---

## Test 5: Error Handling - Invalid Input

### Test Steps
1. Run pipeline with empty story text
2. Run pipeline with non-existent file paths
3. Run pipeline with unreadable files

### Expected Results
- [ ] Step 1 fails with clear error message
- [ ] Error shown in UI
- [ ] Explains which file is missing/invalid

---

## Test 6: API Connection Validation

### Preconditions
- [ ] GEMINI_API_KEY set

### Test from Code
Open browser DevTools (F12) and run:
```javascript
// Test Gemini connection
const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + process.env.GEMINI_API_KEY, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      parts: [{ text: 'Say hello' }]
    }]
  })
})
const data = await response.json()
console.log(data)
```

### Expected Results
- [ ] Status 200
- [ ] Response contains: `candidates[0].content.parts[0].text`
- [ ] Text is a greeting ("Hello" or similar)

---

## Test 7: Thumbnail Image Quality

### Visual Inspection
1. Generate thumbnail
2. Open thumbnail.jpg with image viewer
3. Check for:
   - [ ] Proper dimensions (1920x1080)
   - [ ] Not corrupted (should show actual image, not artifacts)
   - [ ] Color palette visible (reds, blues, creams)
   - [ ] Book/audiobook theme present
   - [ ] Text readability (if text present)

### If Issues
- [ ] Check Electron console for Imagen API errors
- [ ] Look for "Image data invalid" messages
- [ ] Verify base64 decoding worked

---

## Test 8: File System Operations

### Test Steps
1. Run pipeline
2. Check output files:
```
output/
├── voiceover.mp3
├── final_video.mp4
└── thumbnail.jpg
```

### Expected Results
- [ ] All files created
- [ ] File sizes reasonable:
  - voiceover.mp3: 1-10MB
  - final_video.mp4: 50-500MB
  - thumbnail.jpg: 100KB-5MB
- [ ] Files readable (no permission errors)
- [ ] Can open files with standard players

---

## Test 9: Logging & Debugging

### Electron Console (Ctrl+Shift+I)

Look for patterns:
```
Step 1:
✓ 🔵 IPC Handler: Starting pipeline
✓ 📋 Config: storyTitle=...

Step 2:
✓ 🟢 Converting text to speech: "..."
✓ 🟢 Voiceover created: /path/to/voiceover.mp3

Step 3:
✓ 🟢 Video created: /path/to/final_video.mp4

Step 4:
✓ 📷 Avatar image loaded and encoded
✓ 👀 Avatar image included in request
✓ ✅ Thumbnail saved successfully

Complete:
✓ ✅ Pipeline completed successfully
```

---

## Test 10: Environment Variable Verification

### Verify Setup
```bash
# Windows PowerShell
$env:GEMINI_API_KEY

# macOS/Linux
echo $GEMINI_API_KEY

# Or check .env file
cat .env
```

### Expected Output
```
sk-xxxxxxxxxxxxx...
```

---

## Regression Testing

After any changes, verify:
- [ ] Type check passes: `npm run type-check`
- [ ] No compilation errors
- [ ] All imports resolve
- [ ] Pipeline still runs to completion
- [ ] Error messages still helpful
- [ ] Logging still informative

---

## Performance Benchmarks

Typical timing (adjust based on system):

| Step | Expected | Actual | Notes |
|------|----------|--------|-------|
| Validate | ~0.1s | __ | Very fast |
| Voiceover | 30-60s | __ | Text length dependent |
| Compose | 60-120s | __ | Video length dependent |
| Thumbnail | 20-30s | __ | API dependent |
| **Total** | **3-5 min** | __ | |

---

## Known Limitations & Workarounds

### Limitation 1: Vbee Rate Limits
- **Issue:** Too many requests in short time
- **Workaround:** Wait 60 seconds between runs on free tier

### Limitation 2: Imagen Generation Slow
- **Issue:** Image generation takes 15-30 seconds
- **Workaround:** This is expected, patience required

### Limitation 3: Avatar Style Not Always Visible
- **Issue:** Avatar style doesn't always influence output
- **Workaround:** Adjust design prompt for more explicit style
- **Note:** Imagen can have inconsistent prompt adherence

### Limitation 4: Video Composition Slow on Windows
- **Issue:** FFmpeg software encoding slow
- **Workaround:** Use h264_qsv or h264_videotoolbox if available

---

## Troubleshooting Decision Tree

```
Pipeline Fails?
├─ Step 1 (Validate)?
│  └─ Check input file paths exist and are readable
│
├─ Step 2 (Voiceover)?
│  ├─ Check VBEE_API_KEY set
│  ├─ Check Vbee account status
│  └─ Check text length (should be 100-2000 chars)
│
├─ Step 3 (Compose)?
│  ├─ Check FFmpeg installed
│  ├─ Check input files valid
│  └─ Check output directory writable
│
├─ Step 4 (Thumbnail)?
│  ├─ Check GEMINI_API_KEY set
│  ├─ Check API key not rate limited
│  └─ Check avatar file readable
│
└─ Step 5 (Upload)?
   ├─ Check YouTube credentials
   └─ Check file size < 128GB
```

---

## Support

- See `.claude/CLAUDE.md` for architecture
- See `GEMINI_API_SETUP.md` for API troubleshooting
- See `DEVELOPMENT_SETUP.md` for dev environment
- Check Electron console (Ctrl+Shift+I) for detailed logs

---

## Quick Reference Commands

```bash
# Type check
npm run type-check

# Dev server (Terminal 1)
npm run dev

# Electron app (Terminal 2)
npm run electron:dev

# Build for production
npm run build:win    # Windows
npm run build:mac    # macOS

# Clean and restart
rm -rf node_modules dist
npm install
```

---

**Last Updated:** February 2026
**Status:** Ready for Testing ✅
