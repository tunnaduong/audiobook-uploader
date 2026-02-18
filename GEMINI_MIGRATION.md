# Gemini/Nano Banana Migration - Consolidating to Google Generative AI

**Date:** February 18, 2026
**Status:** Migration Complete
**Impact:** Thumbnail generation now uses only Google Generative AI

---

## What Changed

### Before: Hybrid Approach
```
Thumbnail Prompt Generation:
  └─ Google Gemini API (generativelanguage.googleapis.com)

Image Generation:
  └─ Banana.dev API (api.banana.dev)
     └─ Using Stability AI SDXL model
```

### After: Consolidated Google Approach
```
Thumbnail Prompt Generation:
  └─ Google Gemini 2.0 Flash API

Image Generation:
  └─ Google Imagen 3.0 API
```

Both operations now use **Google Generative AI API** with a single `GEMINI_API_KEY`.

---

## Why This Change?

1. **Simplified Architecture**
   - Single API provider instead of two
   - One API key instead of three credentials
   - Reduced configuration complexity

2. **Better Integration**
   - Google's own Imagen model specifically designed for image generation
   - Nano Banana is Google's latest naming for these capabilities
   - Native support for new models as they become available

3. **Cost Efficiency**
   - One API integration instead of maintaining two services
   - Google's unified pricing model

4. **Consistent Base URL**
   - All requests go through: `https://generativelanguage.googleapis.com/v1beta/models`
   - No external API dependencies

---

## Technical Details

### Models Used

**Gemini 2.0 Flash** - For thumbnail prompt generation
- Model ID: `gemini-2.0-flash`
- Endpoint: `/gemini-2.0-flash:generateContent`
- Purpose: Generate detailed image prompts from story summaries

**Imagen 3.0** - For image generation from prompts
- Model ID: `imagen-3.0-generate-001`
- Endpoint: `/imagen-3.0-generate-001:generateContent`
- Purpose: Generate YouTube-ready thumbnail images
- Resolution: 1280x720 (16:9 aspect ratio)

### API Endpoints

Both models use the standard Google Generative AI endpoint structure:
```
https://generativelanguage.googleapis.com/v1beta/models/{model_id}:{method}?key={API_KEY}
```

Examples:
- Gemini prompt generation:
  ```
  POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY
  ```

- Imagen image generation:
  ```
  POST https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateContent?key=YOUR_API_KEY
  ```

---

## Environment Variables

### Updated `.env.example`

**Before:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
BANANA_API_KEY=your_banana_api_key_here
BANANA_MODEL_KEY=your_banana_model_key_here
```

**After:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Migration Steps

If you have an existing `.env` file:

1. **Keep your `GEMINI_API_KEY`** - No change needed
2. **Remove these variables:**
   - `BANANA_API_KEY`
   - `BANANA_MODEL_KEY`

Your `.env` file should now only have:
```env
GEMINI_API_KEY=your_actual_key_here
```

---

## Code Changes

### `src/services/gemini.ts`

**Key Changes:**
- Removed `initializeBananaClient()` function
- Removed Banana API imports and configuration
- Updated `generateThumbnailImage()` to use Gemini API
- Renamed `validateBananaConnection()` to `validateImageGenerationConnection()`
- Kept `validateBananaConnection()` as deprecated wrapper for backward compatibility

**New Models:**
```typescript
const GEMINI_PROMPT_MODEL = 'gemini-2.0-flash'
const GEMINI_IMAGE_MODEL = 'imagen-3.0-generate-001'
```

**Updated Image Generation:**
- Uses Gemini's inline data response format
- Enhanced prompt engineering for better results
- Generation config with temperature and top-p parameters

---

## Function Signatures (No Changes for Consumers)

All public function signatures remain the same:

```typescript
// Still works as before
export async function generateThumbnailPrompt(
  req: ThumbnailPromptRequest
): Promise<string>

export async function generateThumbnailImage(
  prompt: string,
  outputPath: string
): Promise<ThumbnailImage>

export async function generateThumbnail(
  storySummary: string,
  outputPath: string,
  style?: string
): Promise<ThumbnailImage>

export async function validateGeminiConnection(): Promise<boolean>
export async function validateImageGenerationConnection(): Promise<boolean>
export async function validateBananaConnection(): Promise<boolean>
```

---

## Benefits for Backend Integration

When implementing the IPC wiring in `electron/events.ts`:

```typescript
// Simpler validation - only one API to check
const geminiOk = await validateGeminiConnection()
const imageGenOk = await validateImageGenerationConnection()

// Both use same base URL and authentication
const geminiService = initializeGeminiClient()

// Thumbnail generation works with single API
const thumbnail = await generateThumbnail(
  storyText,
  outputPath,
  'anime'
)
```

---

## Error Handling

Fallback behavior unchanged:
- If API call fails → creates placeholder thumbnail
- If API key missing → logs warning and uses default prompts
- Graceful degradation with no impact on pipeline

---

## Future Updates

As Google releases new models:
- `gemini-3.0` (expected)
- Better Imagen versions
- New Nano Banana models

Simply update the model IDs:
```typescript
const GEMINI_PROMPT_MODEL = 'gemini-3.0'  // When available
const GEMINI_IMAGE_MODEL = 'imagen-4.0-generate-001'  // When available
```

---

## Testing the Migration

Verify the setup works:

```bash
# Create/update .env with your GEMINI_API_KEY
cp .env.example .env
# Edit .env and add your actual API key

# Test validation
npm run type-check  # Should pass with 0 errors

# When implementing IPC (next phase):
# The thumbnail generation will automatically use Gemini for both steps
```

---

## Backward Compatibility

- `validateBananaConnection()` still exists but now uses `validateImageGenerationConnection()`
- All public function signatures unchanged
- Code using this service requires no modifications

---

## Migration Complete ✅

The thumbnail generation service is now fully consolidated under Google Generative AI. Ready to proceed with backend service integration!

---

## Next Steps

1. Wire IPC communication in `electron/events.ts`
2. Implement thumbnail generation in the pipeline
3. Test with real `GEMINI_API_KEY`
4. Deploy and monitor

See `BACKEND_INTEGRATION_GUIDE.md` for detailed integration steps.
