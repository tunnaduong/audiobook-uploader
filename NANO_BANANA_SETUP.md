# Nano Banana (Gemini 2.5 Flash Image) Setup Guide

## What is Nano Banana?

**Nano Banana** is the community nickname for **Gemini 2.5 Flash Image** — Google's latest high-quality, low-latency image generation model. It's specifically designed for:

- ✅ **Text → Image** generation (perfect for our use case!)
- ✅ **Image → Image** editing and transformation
- ✅ **Multi-image blending** and composition
- ✅ **Consistency preservation** (crucial for avatar-guided thumbnails)
- ✅ **Speed** (Flash = high-throughput, ~15-30s per image)

## Why We Switched from Imagen to Nano Banana

| Feature | Imagen 3.0 | Nano Banana |
|---------|-----------|------------|
| **Consistency** | Good | ⭐⭐⭐ Excellent |
| **Avatar guidance** | Basic | ⭐⭐⭐ Superior |
| **Speed** | 20-40s | ⭐⭐⭐ 15-30s (Flash) |
| **Cost** | Higher | ⭐⭐⭐ Lower (via CometAPI) |
| **Image editing** | Limited | ⭐⭐⭐ Advanced |
| **SynthID watermark** | Yes | ⭐⭐⭐ Yes (provenance) |

**Bottom line:** Nano Banana is better for avatar-guided thumbnail generation with lower cost.

---

## Quick Start (5 minutes)

### Step 1: Get CometAPI Key (2 minutes)

CometAPI is a unified AI API platform that aggregates 500+ models, including Nano Banana, at lower prices than official APIs.

1. **Sign up** at https://cometapi.com
2. **Create project** and copy your API key
3. **That's it!** CometAPI handles all the complexity

### Step 2: Get Gemini API Key (1 minute)

Still needed for text prompt generation (Gemini 2.0 Flash).

1. Visit https://aistudio.google.com/app/apikey
2. Create or use existing API key
3. Copy the key

### Step 3: Set Environment Variables (2 minutes)

**Option A: Windows (PowerShell)**
```powershell
$env:COMET_API_KEY = "your_cometapi_key_here"
$env:GEMINI_API_KEY = "your_google_gemini_key_here"
```

**Option B: Windows (Command Prompt)**
```cmd
set COMET_API_KEY=your_cometapi_key_here
set GEMINI_API_KEY=your_google_gemini_key_here
```

**Option C: Create `.env` file** (recommended for development)

Create `C:\dev\audiobook-uploader\.env`:
```
COMET_API_KEY=your_cometapi_key_here
GEMINI_API_KEY=your_google_gemini_key_here
VBEE_API_KEY=your_vbee_key_here
VBEE_APP_ID=your_vbee_app_id_here
```

### Step 4: Test the Setup

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run electron:dev

# In app: Click pipeline button and watch Electron console (Ctrl+Shift+I)
# Look for: ✅ Nano Banana thumbnail saved successfully
```

---

## How Nano Banana Works in Our Pipeline

### Architecture

```
Story Text + Avatar Image
    ↓
1. Generate Prompt
   (Gemini 2.0 Flash via Google)
    ↓
2. Generate Image with Avatar Reference
   (Nano Banana via CometAPI)
   - Avatar provides style guidance
   - Nano Banana's strength: consistency
    ↓
3. Save thumbnail.jpg
```

### What Happens in Detail

**Step 1: Text Prompt Generation** (2 seconds)
- Input: Story title + design requirements
- Model: Gemini 2.0 Flash (Google's text model)
- Output: Detailed image generation prompt
- API: Direct Google endpoint

**Step 2: Image Generation** (15-30 seconds)
- Input: Detailed prompt + avatar image (as base64)
- Model: Nano Banana (Gemini 2.5 Flash Image)
- Avatar usage: **Style reference** for consistency
- Output: Base64-encoded JPG image
- API: CometAPI gateway (cheaper than Google official)

**Step 3: Save to Disk** (< 1 second)
- Decode base64 → PNG/JPG binary
- Write to `output/thumbnail.jpg`
- Verify file exists

---

## API Details

### CometAPI + Nano Banana

**Endpoint:**
```
POST https://api.cometapi.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent
```

**Authentication:**
```
Authorization: Bearer YOUR_COMET_API_KEY
Content-Type: application/json
```

**Request Format:**
```json
{
  "contents": [
    {
      "parts": [
        {
          "inlineData": {
            "mimeType": "image/jpeg",
            "data": "base64_encoded_avatar_image"
          }
        },
        {
          "text": "Create a YouTube thumbnail with Modern Oriental style..."
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.8,
    "topP": 0.95,
    "topK": 40,
    "responseModalities": ["IMAGE", "TEXT"]
  }
}
```

**Response Format:**
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "inlineData": {
              "mimeType": "image/jpeg",
              "data": "base64_encoded_generated_image"
            }
          }
        ]
      }
    }
  ]
}
```

### Gemini 2.0 Flash (Text Prompts)

**Endpoint:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
```

**Authentication:**
```
key=YOUR_GEMINI_API_KEY (in query params)
```

---

## Performance & Pricing

### Speed Expectations

| Step | Time | Notes |
|------|------|-------|
| Generate Prompt | ~2s | Fast text generation |
| Generate Image | 15-30s | Nano Banana generation |
| Save to Disk | <1s | Quick write |
| **Total** | **20-35s** | Per thumbnail |

### Pricing Comparison

**Gemini 2.5 Flash Image (Imagen 3.0 for reference):**
- Google official: $0.10 per image (high)
- CometAPI: $0.02-0.05 per image (2-5x cheaper!)

**Why CometAPI is cheaper:**
- Aggregates many providers
- Volume discounts
- No cloud infrastructure overhead
- No minimum commitments

### Free Tier on CometAPI

- ✅ ~60 requests/minute
- ✅ Up to $5 credit/month
- ✅ Full access to Nano Banana
- ✅ Great for development & testing

---

## Troubleshooting

### Error: "COMET_API_KEY not set"

**Solution:**
1. Sign up at https://cometapi.com
2. Get API key from dashboard
3. Set `COMET_API_KEY` environment variable
4. Restart app

### Error: "Model not found" (404)

**Causes & Solutions:**
- ❌ Wrong API key: Verify key at https://cometapi.com
- ❌ Wrong endpoint: Check it's `api.cometapi.com` (not `.com`)
- ❌ Model name changed: Check CometAPI docs for latest model name

**Current model name:** `gemini-2.5-flash-image-preview`

### Error: "API Key invalid" (401)

**Solution:**
1. Go to https://cometapi.com
2. Generate new API key
3. Update `COMET_API_KEY` environment variable
4. Restart app

### Error: "Rate limit exceeded" (429)

**Causes:**
- Free tier limit: ~60 requests/minute
- Too many parallel requests

**Solutions:**
1. Wait 60 seconds
2. Retry after waiting
3. Upgrade to paid tier for higher limits

### "Thumbnail is placeholder instead of actual image"

**Debugging steps:**
1. Check Electron console: Ctrl+Shift+I
2. Look for error logs starting with ❌
3. Check if COMET_API_KEY is set: `echo $COMET_API_KEY`
4. Verify file permissions on output folder

### "Thumbnail saved but image looks wrong"

**Causes:**
- Avatar style not applied (check avatar file format - must be JPEG)
- Prompt too complex
- Model overloaded (retry later)

**Solutions:**
1. Verify avatar is actual JPEG/PNG file
2. Simplify design requirements in prompt
3. Wait 5 minutes and retry
4. Check CometAPI console for detailed error

---

## Advanced: Using Google Official Endpoint Instead

If you prefer Google's official endpoint over CometAPI:

### Setup

1. Create Google Cloud project
2. Enable Vertex AI API
3. Create service account
4. Download JSON credentials
5. Set `GOOGLE_APPLICATION_CREDENTIALS` environment variable

### Code Changes Needed

In `src/services/gemini.ts`, change:

```typescript
// From CometAPI
const COMET_API_URL = 'https://api.cometapi.com/v1beta/models'
const COMET_API_KEY = process.env.COMET_API_KEY

// To Google Vertex AI
const VERTEX_API_URL = 'https://YOUR_PROJECT_REGION-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT/locations/YOUR_REGION/publishers/google/models'
const VERTEX_ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN
```

**Note:** This is more complex. CometAPI is recommended for simplicity and cost.

---

## Best Practices

### Prompt Engineering

✅ **DO:**
- Be explicit: "YouTube thumbnail, 1920x1080, Deep Red (#990000)"
- Include style references: "Modern Oriental, Flat Design, Vietnamese aesthetic"
- Specify quality: "Professional, high-fidelity, polished appearance"

❌ **DON'T:**
- Use copyrighted character names without permission
- Include watermarks (Nano Banana adds SynthID automatically)
- Request features outside model's scope (video generation, etc.)

### Avatar Images

✅ **DO:**
- Use JPEG or PNG format
- 500x500px or larger
- Clear subject (representative of target audience/style)
- Good lighting

❌ **DON'T:**
- Use very small images (< 100x100px)
- Use blurry or low-quality avatars
- Expect Nano Banana to match avatars pixel-for-pixel

### Cost Optimization

1. **Cache prompts:** If generating multiple thumbnails for same story, reuse the prompt
2. **Batch processing:** Generate multiple thumbnails when possible
3. **Simpler designs:** Complex prompts don't always generate better images
4. **Monitor usage:** Check CometAPI dashboard for cost tracking

---

## Monitoring & Debugging

### Check API Connection

```bash
# Test Gemini (text prompt generation)
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Say hello"}]
    }]
  }'

# Test Nano Banana (image generation)
curl -X POST \
  "https://api.cometapi.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent" \
  -H "Authorization: Bearer $COMET_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "Generate a simple blue background image"}]
    }]
  }'
```

### Monitor Logs

**Electron Console (Ctrl+Shift+I):**
```
✅ Nano Banana thumbnail saved successfully
   📁 Path: C:\...\output\thumbnail.jpg
   📊 Size: 156.3 KB
   🎨 Model: Gemini 2.5 Flash Image (Nano Banana) via CometAPI
```

**Debug Issues:**
```
❌ Nano Banana thumbnail generation failed: 401 Unauthorized
💡 Hint: Check COMET_API_KEY is valid from https://cometapi.com
```

---

## Switching Between APIs

### If CometAPI becomes unavailable:

Switch to Google official endpoint:
1. Create Vertex AI project
2. Update constants in `gemini.ts`
3. Change authentication headers
4. Update endpoint URLs

This is why the code is modular!

### If Nano Banana changes name:

1. Check CometAPI model catalog: https://cometapi.com/models
2. Look for `gemini-2.5-flash-image` variants
3. Update `NANO_BANANA_MODEL` constant
4. Restart app

---

## FAQ

### Q: Why CometAPI instead of Google official?

**A:** Three reasons:
1. **Cost:** 2-5x cheaper than Google official
2. **Simplicity:** Single API key, one endpoint, no Cloud setup
3. **Flexibility:** Can switch to other providers if needed (vendor-agnostic)

### Q: Can I use this with other AI image generators?

**A:** Yes! Code is modular. You could add:
- Stable Diffusion (via CometAPI or custom)
- DALL-E (via OpenAI)
- Midjourney (via CometAPI)

Just add new function and update pipeline.ts.

### Q: What's the SynthID watermark?

**A:** Invisible watermark added by Google for provenance. It:
- Marks images as AI-generated
- Can be detected to verify authenticity
- Doesn't affect image quality
- Automatic (you don't need to do anything)

### Q: How do I monitor costs?

**A:** CometAPI dashboard:
1. Log in to https://cometapi.com
2. Go to Usage → API Usage
3. See cost breakdown by model
4. Set usage limits if desired

### Q: Can I batch generate thumbnails?

**A:** Yes! The pipeline function can be called multiple times:
```javascript
for (const story of stories) {
  await executePipeline(config)  // Generate one thumbnail at a time
}
```

For parallel generation, use Promise.all() (with caution on rate limits).

---

## Getting Help

**CometAPI Issues:**
- Docs: https://cometapi.com/docs
- Status: https://status.cometapi.com
- Support: support@cometapi.com

**Google Generative AI Issues:**
- Docs: https://ai.google.dev/docs
- Playground: https://aistudio.google.com
- Support: Through Google Cloud console

**Our App Issues:**
- Check `.claude/IMPROVEMENTS_SUMMARY.md` for architecture
- Check `.claude/CLAUDE.md` for code patterns
- Check logs in Electron console (Ctrl+Shift+I)

---

## Summary

✅ **Setup:** 5 minutes
✅ **Cost:** $0.02-0.05 per thumbnail (CometAPI)
✅ **Speed:** 20-35 seconds per thumbnail
✅ **Quality:** Superior with avatar guidance
✅ **Reliability:** Proven model from Google

**Ready to generate beautiful thumbnails with Nano Banana!** 🎨

---

**Last Updated:** February 2026
**Model:** Gemini 2.5 Flash Image (Nano Banana)
**API:** CometAPI (v1beta)
**Status:** Production Ready ✅
