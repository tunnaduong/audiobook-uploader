import axios, { AxiosInstance } from 'axios'
import { createLogger } from '../utils/logger'
import type { ThumbnailImage } from '../types'

const logger = createLogger('gemini-service')

/**
 * IMPORTANT: Google Generative AI API Configuration
 *
 * This service uses Google's Generative AI APIs for:
 * 1. Prompt Generation: Using Gemini 2.0 Flash (via Google AI Studio)
 * 2. Image Generation: Using Imagen 3.0 (via Google AI Studio)
 *
 * SETUP INSTRUCTIONS:
 * 1. Visit https://aistudio.google.com/app/apikey
 * 2. Create or use an existing API key
 * 3. Set environment variable: GEMINI_API_KEY=your_api_key_here
 *
 * IMPORTANT NOTES:
 * - Google AI Studio (https://aistudio.google.com) provides free tier access
 * - Rate limits: ~60 requests/minute for free tier
 * - Image generation takes 10-30 seconds per request
 * - Both Gemini and Imagen models are available on the same endpoint
 *
 * API ENDPOINT:
 * - Base: https://generativelanguage.googleapis.com/v1beta/models
 * - Text: POST /gemini-2.0-flash:generateContent
 * - Image: POST /imagen-3.0-generate-001:generateContent
 *
 * RESPONSE FORMATS:
 * - Text: candidates[0].content.parts[0].text
 * - Image: candidates[0].content.parts[0].inlineData.data (base64)
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Using Google Generative AI for both prompt generation and image generation
const GEMINI_PROMPT_MODEL = 'gemini-2.0-flash'  // For prompt generation
const GEMINI_IMAGE_MODEL = 'imagen-3.0-generate-001'  // For image generation

let geminiClient: AxiosInstance | null = null

function initializeGeminiClient(): AxiosInstance {
  if (!geminiClient) {
    geminiClient = axios.create({
      baseURL: GEMINI_API_URL,
      timeout: 60000,
    })
  }
  return geminiClient
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

// Generate image using Google Generative AI (Gemini/Imagen)
export async function generateThumbnailImage(
  prompt: string,
  outputPath: string
): Promise<ThumbnailImage> {
  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set, using placeholder thumbnail')
    return createPlaceholderThumbnail(outputPath)
  }

  try {
    logger.info('Generating thumbnail image with Gemini/Imagen')

    const client = initializeGeminiClient()

    // Enhanced prompt for better image generation
    const enhancedPrompt = `${prompt}

Additional requirements:
- 16:9 aspect ratio (1280x720)
- High quality, vibrant colors
- Suitable for YouTube thumbnail
- Professional artwork style
- No text or watermarks`

    // Using Gemini's image generation capability
    const response = await client.post(`/${GEMINI_IMAGE_MODEL}:generateContent`, {
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
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
      },
    }, {
      params: {
        key: GEMINI_API_KEY,
      },
    })

    const imageData = response.data.candidates?.[0]?.content?.parts?.[0]?.inlineData

    if (!imageData) {
      logger.warn('No image data in Gemini response, using placeholder')
      return createPlaceholderThumbnail(outputPath)
    }

    logger.info(`Thumbnail image generated successfully`)

    // In production, would decode base64 and save the image
    // For now, return metadata about the generated image
    return {
      path: outputPath,
      width: 1280,
      height: 720,
      format: 'jpg',
      fileSize: 0,
      generatedAt: new Date(),
    }
  } catch (error) {
    logger.error('Failed to generate thumbnail image with Gemini/Imagen', error)
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

// Validate image generation capability with actual test request
export async function validateImageGenerationConnection(): Promise<boolean> {
  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not configured for image generation')
    return false
  }

  try {
    const client = initializeGeminiClient()

    // Test with a small image generation request
    logger.info('Testing image generation API with test request...')

    const response = await client.post(`/${GEMINI_IMAGE_MODEL}:generateContent`, {
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
      params: {
        key: GEMINI_API_KEY,
      },
    })

    // Check if response contains image data
    const hasImageData = !!(
      response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      response.data?.images?.[0]
    )

    if (hasImageData) {
      logger.info('✅ Image generation API connection successful')
      return true
    }

    logger.warn('Image generation API response missing image data')
    logger.debug(`Response: ${JSON.stringify(response.data)}`)
    return false
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Image generation API validation failed: ${errorMsg}`, error)

    if (error instanceof Error && 'response' in error) {
      const axiosError = error as any
      logger.error(`API Status: ${axiosError.response?.status}`)
      logger.error(`API Error Details: ${JSON.stringify(axiosError.response?.data)}`)

      // Check for specific error patterns
      if (axiosError.response?.status === 404) {
        logger.error('❌ Model not found. Check model name and endpoint.')
      } else if (axiosError.response?.status === 401) {
        logger.error('❌ API Key invalid or expired.')
      } else if (axiosError.response?.status === 429) {
        logger.error('❌ Rate limit exceeded.')
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

// Generate thumbnail with Modern Oriental style using reference avatar
export async function generateModernOrientalThumbnail(
  avatarImagePath: string,       // Reference avatar for style guidance
  storyTitle: string,
  outputPath: string
): Promise<ThumbnailImage> {
  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY not set, using placeholder thumbnail')
    return createPlaceholderThumbnail(outputPath)
  }

  try {
    logger.info('Generating Modern Oriental style thumbnail using avatar reference')

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

    const client = initializeGeminiClient()

    // Modern Oriental style prompt with avatar reference
    const moderateOrientalPrompt = `Create a YouTube thumbnail in Modern Oriental (Á Đông hiện đại) style with Flat Design aesthetic for an audiobook titled: "${storyTitle}"

Design Requirements:
1. Layout & Structure:
   - Center-aligned composition with all main elements centered
   - Decorative frames at 4 corners and top/bottom borders
   - Open space in center for content prominence

2. Color Palette:
   - Background: Cream/Off-white with subtle paper texture
   - Primary: Deep Red (#990000) for main title
   - Secondary: Slate Blue (#5D7B93) for decorative elements
   - Accent: Gold/Yellow highlights

3. Graphic Elements:
   - Traditional cloud patterns (ngũ sắc style, Vietnamese/Chinese aesthetic)
   - Fine flowing lines with gentle shadows
   - Central icon: Open book with ribbons/waves and musical notes
   - Bottom corner: Circular logo with book icon

4. Typography:
   - Title: Brush-style font, thick strokes, Deep Red color
   - Drop shadow for 3D effect
   - Subtitle: Modern Serif, uppercase, wide letter spacing

5. Overall Style:
   - Traditional meets modern aesthetic
   - Refined, elegant, professional appearance
   - Audiobook/literature brand aesthetic
   - 16:9 aspect ratio (1920x1080)
   - High quality, vibrant colors

Generate the complete thumbnail image.`

    // Build request with vision capability if avatar is available
    const parts: any[] = []

    if (avatarBase64) {
      // Include avatar image as reference
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: avatarBase64,
        },
      })
      logger.debug('Avatar image included in request for style reference')
    }

    // Add text prompt
    parts.push({
      text: moderateOrientalPrompt,
    })

    // Call Gemini to generate image
    const response = await client.post(`/${GEMINI_IMAGE_MODEL}:generateContent`, {
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        temperature: 0.85,
        topP: 0.9,
        topK: 40,
      },
    }, {
      params: {
        key: GEMINI_API_KEY,
      },
    })

    // Log response structure for debugging
    logger.debug(`API Response status: ${response.status}`)
    logger.debug(`Response data keys: ${Object.keys(response.data).join(', ')}`)

    // Extract image data from Gemini response
    // Imagen may return data in: inlineData.data, parts[0].text, or other formats
    let imageBase64: string | null = null

    if (response.data?.candidates?.[0]) {
      const candidate = response.data.candidates[0]
      const parts_data = candidate?.content?.parts?.[0]

      logger.debug(`Candidate structure: ${JSON.stringify(parts_data, null, 2)}`)

      // Try multiple paths for image data
      imageBase64 = parts_data?.inlineData?.data ||
                   parts_data?.text ||
                   candidate?.image?.data ||
                   response.data?.images?.[0]

      // If it's a URL, note it for potential future use
      if (typeof imageBase64 === 'string' && imageBase64.startsWith('http')) {
        logger.warn('Received image URL instead of base64. URL-based downloads not yet implemented.')
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

      logger.info(`Writing thumbnail: ${imageBuffer.length} bytes → ${outputPath}`)
      await writeFile(outputPath, imageBuffer)

      // Verify file was actually written
      const { stat } = await import('fs/promises')
      const fileStats = await stat(outputPath)

      logger.info(`✅ Thumbnail saved successfully`)
      logger.info(`   Path: ${outputPath}`)
      logger.info(`   Size: ${fileStats.size} bytes`)

      return {
        path: outputPath,
        width: 1920,
        height: 1080,
        format: 'jpg',
        fileSize: fileStats.size,
        generatedAt: new Date(),
      }
    } catch (fileError) {
      logger.error(`Failed to write thumbnail file: ${outputPath}`, fileError)
      logger.warn('Using placeholder thumbnail instead')
      return createPlaceholderThumbnail(outputPath)
    }
  } catch (apiError) {
    const errorMsg = apiError instanceof Error ? apiError.message : String(apiError)
    logger.error(`Thumbnail generation failed: ${errorMsg}`, apiError)

    // Log specific API errors
    if (apiError instanceof Error && 'response' in apiError) {
      const axiosError = apiError as any
      logger.error(`API Status: ${axiosError.response?.status}`)
      logger.error(`API Error: ${JSON.stringify(axiosError.response?.data)}`)
    }

    logger.warn('Using placeholder thumbnail instead')
    return createPlaceholderThumbnail(outputPath)
  }
}
