/**
 * EPUB Utility Functions
 * Helper functions for EPUB parsing and processing
 */

/**
 * Decode HTML entities - works in both Node.js and browser
 */
function decodeHtmlEntities(html: string): string {
  // Try to use he library if in Node.js context
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const he = require('he')
    return he.decode(html)
  } catch {
    // Fallback to simple regex decoding for browser/React
    return html
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
  }
}

/**
 * Strip HTML tags from content while preserving paragraph breaks
 */
export function stripHtmlTags(html: string): string {
  // Decode HTML entities first
  let text = decodeHtmlEntities(html)

  // Replace common block-level elements with line breaks
  text = text.replace(/<\/p>/gi, '\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<\/blockquote>/gi, '\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<hr\s*\/?>/gi, '\n\n')

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Clean up whitespace
  text = text
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 0)
    .join('\n')

  // Remove excessive blank lines
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

/**
 * Estimate word count from text (rough approximation)
 * For Vietnamese text, estimate ~6 characters per word on average
 */
export function estimateWordCount(text: string): number {
  const cleaned = text.trim()
  if (cleaned.length === 0) return 0

  // For Vietnamese: roughly 6 characters per word
  // For English: roughly 5 characters per word
  // Use conservative estimate of 6 chars/word
  return Math.max(1, Math.ceil(cleaned.length / 6))
}

/**
 * Extract chapter number from various formats
 * Handles: "Chương 1", "Chapter 1", "Ch. 1", "第1章", etc.
 */
export function extractChapterNumber(text: string): number | null {
  if (!text || text.trim().length === 0) return null

  const text_lower = text.toLowerCase()

  // Vietnamese patterns
  if (text_lower.includes('chương')) {
    const match = text_lower.match(/chương\s+(\d+)/i)
    if (match) return parseInt(match[1])
  }

  // English patterns
  if (text_lower.includes('chapter')) {
    const match = text_lower.match(/chapter\s+(\d+)/i)
    if (match) return parseInt(match[1])
  }

  // Chinese pattern
  const chineseMatch = text.match(/第(\d+)章/)
  if (chineseMatch) return parseInt(chineseMatch[1])

  // Generic pattern at start: "1", "01", "001", etc.
  const numMatch = text.match(/^(\d+)[\s.\-:_]*/)
  if (numMatch) {
    const num = parseInt(numMatch[1])
    // Only accept if it's a reasonable chapter number (1-999)
    if (num > 0 && num < 1000) return num
  }

  return null
}

/**
 * Normalize chapter title by removing common prefixes
 */
export function normalizeChapterTitle(title: string): string {
  let normalized = title.trim()

  // Remove leading chapter indicators
  normalized = normalized.replace(/^(chương|chapter|ch\.?|第.*?章)\s*[\s:\-]*/i, '')
  normalized = normalized.replace(/^\d+[\s:\-]*/i, '')

  return normalized.trim()
}

/**
 * Format estimated duration in Vietnamese
 * Assumes ~250 words per minute for Vietnamese TTS
 */
export function formatEstimatedDuration(wordCount: number): string {
  const wordsPerMinute = 250
  const minutes = Math.ceil(wordCount / wordsPerMinute)

  if (minutes < 1) return '< 1 phút'
  if (minutes === 1) return '1 phút'
  return `${minutes} phút`
}

/**
 * Validate EPUB file by checking magic number
 */
export async function isValidEpubFile(buffer: Buffer): Promise<boolean> {
  // EPUB files are ZIP archives with specific structure
  // ZIP files start with 0x504B (PK)
  if (buffer.length < 4) return false
  return buffer[0] === 0x50 && buffer[1] === 0x4b
}

/**
 * Format selected chapters for display
 * Example: [1, 2, 5, 6, 7] -> "1-2, 5-7"
 */
export function formatChapterRanges(chapters: number[]): string {
  if (chapters.length === 0) return ''

  const sorted = [...chapters].sort((a, b) => a - b)
  const ranges: string[] = []
  let start = sorted[0]
  let end = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      // Range ended
      if (start === end) {
        ranges.push(String(start))
      } else {
        ranges.push(`${start}-${end}`)
      }
      start = sorted[i]
      end = sorted[i]
    }
  }

  // Add final range
  if (start === end) {
    ranges.push(String(start))
  } else {
    ranges.push(`${start}-${end}`)
  }

  return ranges.join(', ')
}
