# Google Generative AI (Gemini + Imagen) Setup Guide

## Quick Start

### 1. Get Your Free API Key (1 phút)

1. Truy cập: **https://aistudio.google.com/app/apikey**
2. Đăng nhập bằng Google Account
3. Click **"Create API key"**
4. Copy API key

### 2. Set Environment Variable

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="your_api_key_here"
```

**Windows (Command Prompt):**
```cmd
set GEMINI_API_KEY=your_api_key_here
```

**macOS/Linux (Bash):**
```bash
export GEMINI_API_KEY="your_api_key_here"
```

**Permanent Setup (Windows):**
1. Tạo file `.env` trong thư mục gốc project:
```
GEMINI_API_KEY=your_api_key_here
```

2. Package sẽ tự động load từ `.env` file

### 3. Verify Setup

Run trong terminal:
```bash
npm run dev
```

Kiểm tra Electron console (Ctrl+Shift+I) khi click pipeline button. Bạn sẽ thấy:
- `✅ Thumbnail saved successfully` - Nếu thành công
- `No image data in response` - Nếu API key sai hoặc endpoint có vấn đề

---

## Understanding the API

### What You Get (Free Tier)

| Feature | Limit | Notes |
|---------|-------|-------|
| Requests/minute | ~60 | Sufficient for development |
| Image generation | ✅ | 10-30 seconds per image |
| Text generation | ✅ | ~2 seconds per request |
| Daily quota | 1500 requests | More than enough |

### API Models Used

**1. For Prompt Generation (Text → Text)**
```
Model: gemini-2.0-flash
Purpose: Analyze story summary and create detailed image prompt
Speed: ~2 seconds
```

**2. For Image Generation (Text → Image)**
```
Model: imagen-3.0-generate-001
Purpose: Generate Modern Oriental style thumbnail from prompt
Speed: ~15-30 seconds
Output: Base64-encoded JPG image
```

Both models accessible via same endpoint:
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

---

## How It Works in Our App

### Pipeline Flow

```
1. Story Text Input
   ↓
2. Generate Thumbnail Prompt (Gemini 2.0 Flash)
   - Analyzes story summary
   - Creates detailed image prompt with Vietnamese design specs
   - Takes ~2 seconds
   ↓
3. Generate Thumbnail Image (Imagen 3.0)
   - Receives the detailed prompt
   - Generates Modern Oriental style image
   - Takes ~15-30 seconds
   ↓
4. Save as JPG
   - Base64 image decoded to file
   - Saved to output folder
   ↓
5. Video Composition
   - Uses saved thumbnail with video
```

### Request Format (Image Generation)

```javascript
POST /imagen-3.0-generate-001:generateContent

{
  "contents": [{
    "parts": [
      // Optional: Include reference image as vision input
      {
        "inlineData": {
          "mimeType": "image/jpeg",
          "data": "base64_encoded_image"
        }
      },
      // Text prompt
      {
        "text": "Create a YouTube thumbnail in Modern Oriental style..."
      }
    ]
  }],
  "generationConfig": {
    "temperature": 0.85,
    "topP": 0.9,
    "topK": 40
  }
}
```

### Response Format (Image Generation)

```javascript
{
  "candidates": [{
    "content": {
      "parts": [{
        "inlineData": {
          "mimeType": "image/jpeg",
          "data": "base64_encoded_jpg_image_data..."
        }
      }]
    }
  }]
}
```

---

## Troubleshooting

### Error: "No image data found in Gemini response"

**Cause:** API key invalid or endpoint changed

**Solution:**
1. Verify API key at https://aistudio.google.com/app/apikey
2. Check key is set: `echo %GEMINI_API_KEY%` (Windows)
3. Restart app after changing env variable

### Error: "Model not found" (404)

**Cause:** Model name wrong or endpoint changed by Google

**Solution:**
1. Check available models: https://aistudio.google.com
2. If `imagen-3.0-generate-001` not available, Google may have renamed it
3. Common alternatives:
   - `gemini-pro` (text-only, no images)
   - `gemini-1.5-pro` (newer text model)
   - Check documentation for latest image model name

### Error: "Rate limit exceeded" (429)

**Cause:** Too many requests in short time

**Solution:**
1. Wait a minute before trying again
2. Free tier: ~60 requests/minute
3. For production: Upgrade to paid tier

### Error: "API Key invalid" (401)

**Cause:** API key expired or revoked

**Solution:**
1. Go to https://aistudio.google.com/app/apikey
2. Generate new key
3. Update environment variable
4. Restart app

### Image appears as placeholder

**Cause:** Image generation failed but fallback is working

**Solution:**
1. Check Electron console for detailed error message
2. Look for line: `API Error Details: ...`
3. Common issues:
   - Prompt too complex (simplify design requirements)
   - API key rate limited (wait and retry)
   - Model overloaded (try again later)

---

## Advanced: Using Vertex AI (Production)

If you want enterprise-grade setup with higher quotas:

### 1. Setup Google Cloud Project
```bash
# Install Google Cloud CLI
# Create project
gcloud projects create audiobook-uploader

# Enable APIs
gcloud services enable aiplatform.googleapis.com
gcloud services enable generativelanguage.googleapis.com
```

### 2. Setup Authentication
```bash
# Create service account
gcloud iam service-accounts create gemini-service

# Grant permissions
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:gemini-service@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Create key
gcloud iam service-accounts keys create key.json \
  --iam-account=gemini-service@PROJECT_ID.iam.gserviceaccount.com
```

### 3. Update Code
Change `src/services/gemini.ts`:
```typescript
// Instead of query params
-  params: { key: GEMINI_API_KEY }

// Use OAuth2 token in header
+ headers: { Authorization: `Bearer ${accessToken}` }
```

---

## Testing API Connection

### From Command Line

```bash
# Test Gemini (text generation)
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Say hello"}]
    }]
  }'
```

### From App

Run the pipeline in development mode and check Electron console for:
- `✅ Thumbnail saved successfully` - Everything working
- Detailed debug logs showing response structure
- API Status codes and error messages

---

## Performance Notes

### Typical Timing
```
Step 1: Validate Input          ~0.1s
Step 2: Generate Voiceover      ~30-60s  (depends on story length)
Step 3: Compose Video           ~60-120s (depends on video length)
Step 4: Generate Thumbnail      ~20-30s  (Gemini prompt + Imagen)
Step 5: Upload to YouTube       ~60-180s (depends on file size)
────────────────────────────────────────
Total:                          ~3-5 minutes per complete run
```

### Image Generation Breakdown
```
Step 4a: Generate Prompt (Gemini)    ~2s
Step 4b: Generate Image (Imagen)     ~15-30s
Step 4c: Save to Disk                ~1s
────────────────────────────────────
Total Thumbnail Step:                ~20-30s
```

### Optimization Tips
- Keep story summaries concise (< 500 characters)
- Use simpler design prompts for faster generation
- Cache generated prompts if running multiple times
- Batch requests if processing many stories

---

## Resources

- **Google AI Studio:** https://aistudio.google.com
- **Gemini Docs:** https://ai.google.dev/docs
- **Imagen Docs:** https://ai.google.dev/tutorials/imagen_guidance
- **API Reference:** https://ai.google.dev/reference/rest
- **Free Tier Info:** https://ai.google.dev/pricing

---

## Security Best Practices

✅ **DO:**
- Store API key in `.env` file (never commit)
- Use environment variables
- Rotate keys periodically
- Use free tier for development
- Monitor usage at https://console.cloud.google.com

❌ **DON'T:**
- Commit API key to GitHub
- Hardcode key in source code
- Share key in logs/console output
- Use production key for testing
- Leave keys in git history

---

## FAQ

### Q: Why does image generation take 20-30 seconds?
**A:** Imagen 3.0 uses advanced diffusion models. This is normal. The quality is worth the wait.

### Q: Can I use a different image generation model?
**A:** Yes! Try:
- `gemini-pro-vision` (if available)
- Other Google Cloud Vision APIs
- Or integrate third-party services like Stable Diffusion, DALL-E

### Q: What's the difference between Google AI Studio and Vertex AI?
**A:**
- **Google AI Studio:** Free tier, ~60 req/min, easier setup
- **Vertex AI:** Paid, higher quotas, enterprise support, OAuth2 auth

### Q: Can I use my own image instead of generated?
**A:** Yes! Just skip the thumbnail generation step and use an existing image:
```typescript
// In pipeline.ts
const thumbnailResult = {
  path: 'your_custom_image.jpg',
  width: 1920,
  height: 1080,
  format: 'jpg',
  fileSize: 0,
  generatedAt: new Date(),
}
```

### Q: How do I test without API key?
**A:** The app automatically falls back to placeholder thumbnail if API key not set. Good for testing UI without costs.

---

Happy creating! 🎬✨
