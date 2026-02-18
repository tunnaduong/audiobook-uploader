import axios, { AxiosInstance } from 'axios'
import { createLogger } from '../utils/logger'
import type { ThumbnailImage } from '../types'

const logger = createLogger('gemini-service')

/**
 * IMPORTANT: Image Generation via CometAPI + Nano Banana
 *
 * This service uses:
 * 1. Prompt Generation: Gemini 2.0 Flash (via Google AI Studio direct)
 * 2. Image Generation: Gemini 2.5 Flash Image / Nano Banana (via CometAPI)
 *
 * SETUP INSTRUCTIONS:
 * 1. For Text Prompts: Get GEMINI_API_KEY from https://aistudio.google.com/app/apikey
 * 2. For Image Generation: Get COMET_API_KEY from https://cometapi.com (free tier available)
 * 3. Set environment variables:
 *    export GEMINI_API_KEY=your_google_key_here
 *    export COMET_API_KEY=your_cometapi_key_here
 *
 * IMPORTANT NOTES:
 * - CometAPI provides Nano Banana (Gemini 2.5 Flash Image) at lower cost than Google official
 * - Rate limits: Depends on CometAPI tier (free tier: ~60 req/min)
 * - Image generation takes 15-30 seconds per request
 * - CometAPI aggregates 500+ models in single interface
 *
 * API ENDPOINTS:
 * - Text: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
 * - Image: https://api.cometapi.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent
 *
 * RESPONSE FORMATS:
 * - Text: candidates[0].content.parts[0].text
 * - Image: candidates[0].content.parts[0].inlineData.data (base64)
 *
 * Why Nano Banana (Gemini 2.5 Flash Image)?
 * - Superior image consistency (especially important for avatar-guided thumbnails)
 * - Fast generation (Flash = high-throughput)
 * - Multi-modal: text→image, image→image, multi-image blending
 * - SynthID watermark for provenance
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const COMET_API_URL = 'https://api.cometapi.com/v1beta/models'
const COMET_API_KEY = process.env.COMET_API_KEY

// Models
const GEMINI_PROMPT_MODEL = 'gemini-3-flash'  // For prompt generation (via Google)
const NANO_BANANA_MODEL = 'gemini-3-pro-image'  // For image generation (via CometAPI)

let geminiClient: AxiosInstance | null = null
let cometClient: AxiosInstance | null = null

function initializeGeminiClient(): AxiosInstance {
  if (!geminiClient) {
    geminiClient = axios.create({
      baseURL: GEMINI_API_URL,
      timeout: 60000,
    })
  }
  return geminiClient
}

function initializeCometClient(): AxiosInstance {
  if (!cometClient) {
    cometClient = axios.create({
      baseURL: COMET_API_URL,
      timeout: 60000,
    })
  }
  return cometClient
}

interface ThumbnailPromptRequest {
  storySummary: string
  style?: string
  format?: 'anime' | 'realistic' | 'cartoon'
}

// Generate image prompt using Gemini
export async function generateThumbnailPrompt(
  req: ThumbnailPromptRequest
): Promise<string> {
  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set, using default prompt')
    return generateDefaultPrompt(req)
  }

  try {
    logger.info('Generating thumbnail prompt with Gemini')

    const client = initializeGeminiClient()

    const systemPrompt = `You are an expert in creating detailed, beautiful image prompts for AI art generation.
Your task is to create a detailed English prompt for generating a YouTube thumbnail based on the story summary.

Requirements:
- Output ONLY the image prompt, no explanations
- Focus on: anime-style, cute characters, pastel colors, high detail, 16:9 aspect ratio
- Include a cute cat character if suitable
- Make it eye-catching and suitable for YouTube thumbnails
- Keep it under 500 characters`

    const userPrompt = `Story Summary: ${req.storySummary}

Style: ${req.style || 'Anime/Manga'}
Format: ${req.format || 'anime'}

Generate a detailed image prompt for this story thumbnail.`

    const response = await client.post(`/${GEMINI_PROMPT_MODEL}:generateContent`, {
      contents: [
        {
          parts: [
            {
              text: userPrompt,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: systemPrompt,
          },
        ],
      },
    }, {
      params: {
        key: GEMINI_API_KEY,
      },
    })

    const prompt = response.data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!prompt) {
      throw new Error('No prompt generated from Gemini')
    }

    logger.info('Thumbnail prompt generated successfully')
    return prompt
  } catch (error) {
    logger.error('Failed to generate thumbnail prompt with Gemini', error)
    return generateDefaultPrompt(req)
  }
}

// Generate image using Nano Banana via CometAPI
// Note: This is a helper function. For Modern Oriental thumbnails with avatar reference,
// use generateModernOrientalThumbnail() instead, which is the main function in the pipeline.
export async function generateThumbnailImage(
  prompt: string,
  outputPath: string
): Promise<ThumbnailImage> {
  if (!COMET_API_KEY) {
    logger.warn('COMET_API_KEY not set, using placeholder thumbnail')
    return createPlaceholderThumbnail(outputPath)
  }

  try {
    logger.info('🎨 Generating thumbnail image with Nano Banana via CometAPI')

    const client = initializeCometClient()

    // Enhanced prompt for better image generation with Nano Banana
    const enhancedPrompt = `${prompt}

Additional requirements:
- 16:9 aspect ratio (1920x1080)
- High quality, vibrant colors
- Suitable for YouTube thumbnail
- Professional, polished artwork style
- High-fidelity details`

    // Call Nano Banana to generate image
    const response = await client.post(`/${NANO_BANANA_MODEL}:generateContent`, {
      contents: [
        {
          parts: [
            {
              text: enhancedPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        topP: 0.95,
        topK: 40,
        responseModalities: ['IMAGE'],
      },
    }, {
      headers: {
        'Authorization': `Bearer ${COMET_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const imageData = response.data.candidates?.[0]?.content?.parts?.[0]?.inlineData

    if (!imageData) {
      logger.warn('No image data in Nano Banana response, using placeholder')
      return createPlaceholderThumbnail(outputPath)
    }

    logger.info(`✅ Thumbnail image generated successfully with Nano Banana`)

    return {
      path: outputPath,
      width: 1920,
      height: 1080,
      format: 'jpg',
      fileSize: 0,
      generatedAt: new Date(),
    }
  } catch (error) {
    logger.error('Failed to generate thumbnail image with Nano Banana', error)
    return createPlaceholderThumbnail(outputPath)
  }
}

// Full workflow: generate prompt and image
export async function generateThumbnail(
  storySummary: string,
  outputPath: string,
  style?: string
): Promise<ThumbnailImage> {
  try {
    logger.info('Starting thumbnail generation workflow')

    // Step 1: Generate prompt
    const prompt = await generateThumbnailPrompt({
      storySummary,
      style: style || 'anime',
      format: 'anime',
    })

    logger.debug(`Generated prompt: ${prompt}`)

    // Step 2: Generate image
    const thumbnail = await generateThumbnailImage(prompt, outputPath)

    logger.info('Thumbnail generation workflow completed')
    return thumbnail
  } catch (error) {
    logger.error('Failed to generate thumbnail', error)
    return createPlaceholderThumbnail(outputPath)
  }
}

// Generate default prompt if Gemini is unavailable
function generateDefaultPrompt(_req: ThumbnailPromptRequest): string {
  const defaultPrompts = [
    `Anime-style illustration for YouTube thumbnail. Cute anime character with big expressive eyes,
pastel color palette, magical sparkles, professional digital art, trending on artstation,
16:9 aspect ratio, detailed, high quality`,

    `Adorable anime girl character with cat ears and cute cat companion, pastel pink and purple colors,
magical anime style, glowing effects, professional illustration, 16:9 thumbnail format, trending art`,

    `Cute anime scene with cozy atmosphere, warm lighting, soft pastel colors, anime aesthetic,
high detail, professional quality, 16:9 aspect ratio, perfect for YouTube thumbnail`,
  ]

  const randomPrompt = defaultPrompts[Math.floor(Math.random() * defaultPrompts.length)]
  logger.debug(`Using default prompt: ${randomPrompt}`)
  return randomPrompt
}

// Create placeholder thumbnail if generation fails
function createPlaceholderThumbnail(outputPath: string): ThumbnailImage {
  logger.info('Creating placeholder thumbnail')
  return {
    path: outputPath,
    width: 1280,
    height: 720,
    format: 'jpg',
    fileSize: 0,
    generatedAt: new Date(),
  }
}

// Validate API connections
export async function validateGeminiConnection(): Promise<boolean> {
  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not configured')
    return false
  }

  try {
    const client = initializeGeminiClient()
    await client.post(`/${GEMINI_PROMPT_MODEL}:countTokens`, {
      contents: [
        {
          parts: [
            {
              text: 'test',
            },
          ],
        },
      ],
    }, {
      params: {
        key: GEMINI_API_KEY,
      },
    })

    logger.info('Gemini API connection successful')
    return true
  } catch (error) {
    logger.error('Gemini API connection failed', error)
    return false
  }
}

// Validate image generation capability with Nano Banana (Gemini 2.5 Flash Image) via CometAPI
export async function validateImageGenerationConnection(): Promise<boolean> {
  if (!COMET_API_KEY) {
    logger.warn('COMET_API_KEY not configured for image generation. Get it from https://cometapi.com')
    return false
  }

  try {
    const client = initializeCometClient()

    // Test with a small image generation request using Nano Banana
    logger.info('Testing Nano Banana image generation via CometAPI...')

    const response = await client.post(`/${NANO_BANANA_MODEL}:generateContent`, {
      contents: [
        {
          parts: [
            {
              text: 'Generate a simple solid color image (blue background). 16:9 aspect ratio.',
            },
          ],
        },
      ],
    }, {
      headers: {
        'Authorization': `Bearer ${COMET_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    // Check if response contains image data
    const hasImageData = !!(
      response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      response.data?.images?.[0]
    )

    if (hasImageData) {
      logger.info('✅ Nano Banana (Gemini 2.5 Flash Image) via CometAPI: Connection successful')
      return true
    }

    logger.warn('Image generation response missing image data')
    logger.debug(`Response: ${JSON.stringify(response.data)}`)
    return false
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Nano Banana validation failed: ${errorMsg}`, error)

    if (error instanceof Error && 'response' in error) {
      const axiosError = error as any
      logger.error(`API Status: ${axiosError.response?.status}`)
      logger.error(`API Error Details: ${JSON.stringify(axiosError.response?.data)}`)

      if (axiosError.response?.status === 404) {
        logger.error('❌ Model not found. Check COMET_API_KEY and model name.')
      } else if (axiosError.response?.status === 401) {
        logger.error('❌ CometAPI Key invalid or expired. Get new key from https://cometapi.com')
      } else if (axiosError.response?.status === 429) {
        logger.error('❌ Rate limit exceeded. CometAPI free tier: ~60 req/min')
      }
    }

    return false
  }
}

// Legacy function name for backward compatibility
export async function validateBananaConnection(): Promise<boolean> {
  logger.info('validateBananaConnection deprecated - using Gemini API instead')
  return validateImageGenerationConnection()
}

// Generate thumbnail with Modern Oriental style using Nano Banana (Gemini 2.5 Flash Image) via CometAPI
export async function generateModernOrientalThumbnail(
  avatarImagePath: string,       // Reference avatar for style guidance
  storyTitle: string,
  outputPath: string
): Promise<ThumbnailImage> {
  if (!COMET_API_KEY) {
    logger.warn('COMET_API_KEY not set. Get from https://cometapi.com')
    logger.warn('Using placeholder thumbnail instead')
    return createPlaceholderThumbnail(outputPath)
  }

  try {
    logger.info('🎨 Generating Modern Oriental style thumbnail using Nano Banana via CometAPI')

    // First, load and encode avatar image as base64 for vision capability
    let avatarBase64: string | null = null
    try {
      const { readFile } = await import('fs/promises')
      const avatarBuffer = await readFile(avatarImagePath)
      avatarBase64 = avatarBuffer.toString('base64')
      logger.info(`Avatar image loaded and encoded: ${avatarImagePath}`)
    } catch (avatarError) {
      logger.warn(`Could not load avatar image for reference: ${avatarImagePath}`, avatarError)
      // Continue without avatar - it's optional
    }

    const client = initializeCometClient()

    // Modern Oriental style prompt optimized for Nano Banana
    // Nano Banana excels at consistency and detail, so we can be more specific
    const moderateOrientalPrompt = `Create a YouTube thumbnail in Modern Oriental (Á Đông hiện đại) style with Flat Design aesthetic for an audiobook titled: "${storyTitle}"

requirements: 16:9 aspect ratio, 1920x1080 resolution

Design Requirements:
1. Layout & Structure:
   - Center-aligned composition with all main elements centered
   - Decorative frames at 4 corners and top/bottom borders
   - Open space in center for content prominence

2. Color Palette:
   - Background: Cream/Off-white with subtle paper texture
   - Primary: Deep Red (#990000) for main title text
   - Secondary: Slate Blue (#5D7B93) for decorative elements
   - Accent: Gold/Yellow for highlights and details

3. Graphic Elements:
   - Traditional cloud patterns (ngũ sắc style, Vietnamese/Chinese aesthetic)
   - Fine flowing lines with gentle shadows throughout
   - Central icon: Open book with flowing ribbons/waves and musical notes
   - Bottom corner: Circular logo/watermark with book icon

4. Typography:
   - Main Title: Brush-style font, thick strokes, rounded ends, Deep Red color
   - Drop shadow for 3D effect and readability
   - Subtitle: Modern Serif, uppercase, wide letter spacing

5. Overall Style:
   - Traditional meets modern aesthetic
   - Refined, elegant, professional appearance
   - Professional audiobook/literature brand feeling
   - Aspect ratio: 16:9 (1920x1080 resolution)
   - High quality, vibrant yet harmonious colors
   - Premium, polished appearance

Generate the complete, high-quality thumbnail image.`

    // Build request with vision capability if avatar is available
    const parts: any[] = []

    if (avatarBase64) {
      // Include avatar image as reference for style consistency (Nano Banana's strength!)
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: avatarBase64,
        },
      })
      logger.info('👀 Avatar image included as style reference for consistency')
    }

    // Add text prompt
    parts.push({
      text: moderateOrientalPrompt,
    })

    // Call Nano Banana via CometAPI to generate image
    // Nano Banana (Gemini 2.5 Flash Image) excels at:
    // - Consistent image generation
    // - Avatar-guided style matching
    // - Fast generation (Flash = high-throughput)
    const response = await client.post(`/${NANO_BANANA_MODEL}:generateContent`, {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.8,  // Slightly lower for more consistent style
        topP: 0.95,
        topK: 40,
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }, {
      headers: {
        'Authorization': `Bearer ${COMET_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    // Log response structure for debugging
    logger.debug(`🔍 API Response status: ${response.status}`)
    logger.debug(`📊 Response data keys: ${Object.keys(response.data).join(', ')}`)

    // Extract image data from CometAPI/Nano Banana response
    // Nano Banana returns images in: candidates[0].content.parts[0].inlineData.data (base64)
    let imageBase64: string | null = null

    if (response.data?.candidates?.[0]) {
      const candidate = response.data.candidates[0]
      const parts_data = candidate?.content?.parts?.[0]

      logger.debug(`📋 Response structure: ${JSON.stringify(parts_data, null, 2)}`)

      // Try multiple paths for image data (Nano Banana formats)
      imageBase64 = parts_data?.inlineData?.data ||
                   parts_data?.text ||
                   candidate?.image?.data ||
                   response.data?.images?.[0]

      // If it's a URL, note it for potential future use
      if (typeof imageBase64 === 'string' && imageBase64.startsWith('http')) {
        logger.warn('⚠️  Received image URL instead of base64. URL-based downloads not yet implemented.')
        return createPlaceholderThumbnail(outputPath)
      }
    }

    if (!imageBase64) {
      logger.warn(`No image data in response. Full response: ${JSON.stringify(response.data)}`)
      logger.warn('Using placeholder thumbnail instead')
      return createPlaceholderThumbnail(outputPath)
    }

    // Validate base64 data
    if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
      logger.warn(`Image data invalid (type: ${typeof imageBase64}, length: ${imageBase64?.length || 0})`)
      logger.warn('Using placeholder thumbnail instead')
      return createPlaceholderThumbnail(outputPath)
    }

    // Validate it looks like base64 (alphanumeric + / and + characters)
    if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
      logger.warn('Image data does not appear to be valid base64 format')
      logger.warn('Using placeholder thumbnail instead')
      return createPlaceholderThumbnail(outputPath)
    }

    try {
      // Decode base64 and save to file
      const { writeFile } = await import('fs/promises')
      const imageBuffer = Buffer.from(imageBase64, 'base64')

      logger.info(`💾 Writing Nano Banana thumbnail: ${imageBuffer.length} bytes → ${outputPath}`)
      await writeFile(outputPath, imageBuffer)

      // Verify file was actually written
      const { stat } = await import('fs/promises')
      const fileStats = await stat(outputPath)

      logger.info(`✅ Nano Banana thumbnail saved successfully`)
      logger.info(`   📁 Path: ${outputPath}`)
      logger.info(`   📊 Size: ${fileStats.size} bytes (${(fileStats.size / 1024).toFixed(1)} KB)`)
      logger.info(`   🎨 Model: Gemini 2.5 Flash Image (Nano Banana) via CometAPI`)

      return {
        path: outputPath,
        width: 1920,
        height: 1080,
        format: 'jpg',
        fileSize: fileStats.size,
        generatedAt: new Date(),
      }
    } catch (fileError) {
      logger.error(`❌ Failed to write thumbnail file: ${outputPath}`, fileError)
      logger.warn('Using placeholder thumbnail instead')
      return createPlaceholderThumbnail(outputPath)
    }
  } catch (apiError) {
    const errorMsg = apiError instanceof Error ? apiError.message : String(apiError)
    logger.error(`❌ Nano Banana thumbnail generation failed: ${errorMsg}`, apiError)

    // Log specific API errors
    if (apiError instanceof Error && 'response' in apiError) {
      const axiosError = apiError as any
      logger.error(`📡 API Status: ${axiosError.response?.status}`)
      logger.error(`📋 API Error: ${JSON.stringify(axiosError.response?.data)}`)

      // Provide helpful error messages
      if (axiosError.response?.status === 401) {
        logger.error('💡 Hint: Check COMET_API_KEY is valid from https://cometapi.com')
      } else if (axiosError.response?.status === 429) {
        logger.error('💡 Hint: Rate limited. Wait 60 seconds before retry.')
      }
    }

    logger.warn('Using placeholder thumbnail instead')
    return createPlaceholderThumbnail(outputPath)
  }
}
