/**
 * EPUB Parser Service
 * Parses EPUB files and extracts chapter information
 */

import JSZip from 'jszip'
import { parseString } from 'xml2js'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import { createLogger } from '../utils/logger'
import {
  stripHtmlTags,
  estimateWordCount,
  extractChapterNumber,
  normalizeChapterTitle,
  isValidEpubFile,
} from '../utils/epub-utils'
import type { EpubChapter, EpubMetadata } from '../types'

const logger = createLogger('epub-service')
const parseXml = promisify(parseString)

/**
 * Parse EPUB file and extract all chapters
 */
export async function parseEpubFile(filePath: string): Promise<EpubMetadata> {
  logger.info(`📖 Parsing EPUB file: ${filePath}`)

  try {
    // Read file
    const fileBuffer = await fs.readFile(filePath)

    // Validate EPUB format
    if (!(await isValidEpubFile(fileBuffer))) {
      throw new Error('Invalid EPUB file format: Not a valid ZIP archive')
    }

    // Parse ZIP archive
    const zip = new JSZip()
    await zip.loadAsync(fileBuffer)

    logger.debug('✅ EPUB ZIP loaded successfully')

    // Extract metadata from container.xml to find content.opf path
    const containerXml = await zip.file('META-INF/container.xml')?.async('string')
    if (!containerXml) {
      throw new Error('Invalid EPUB: Missing META-INF/container.xml')
    }

    const containerData = (await parseXml(containerXml)) as any
    const contentOpfPath = containerData?.container?.rootfiles?.[0]?.rootfile?.[0]?.$?.['full-path']

    if (!contentOpfPath) {
      throw new Error('Invalid EPUB: Cannot find content.opf path in container.xml')
    }

    logger.debug(`📄 Content OPF path: ${contentOpfPath}`)

    // Parse OPF (content.opf) to get metadata and reading order
    const opfXml = await zip.file(contentOpfPath)?.async('string')
    if (!opfXml) {
      throw new Error(`Invalid EPUB: Missing ${contentOpfPath}`)
    }

    const opfData = (await parseXml(opfXml)) as any
    const metadata = extractMetadata(opfData)
    const spine = extractSpine(opfData)
    const manifest = extractManifest(opfData)

    logger.info(`📚 Book: "${metadata.title}" by ${metadata.author || 'Unknown'} (${spine.length} items)`)

    // Extract chapters from spine
    const opfDir = path.dirname(contentOpfPath)
    const chapters: EpubChapter[] = []
    let chapterNumber = 1

    for (let i = 0; i < spine.length; i++) {
      const itemId = spine[i]
      const manifestItem = manifest[itemId]

      if (!manifestItem || !manifestItem.href) {
        logger.warn(`⚠️ Manifest item not found for ID: ${itemId}`)
        continue
      }

      try {
        const chapterPath = path.join(opfDir, manifestItem.href).replace(/\\/g, '/')
        const chapterContent = await zip.file(chapterPath)?.async('string')

        if (!chapterContent) {
          logger.warn(`⚠️ Could not read chapter: ${chapterPath}`)
          continue
        }

        // Parse chapter HTML/XHTML
        const chapter = await parseChapter(chapterContent, chapterNumber, itemId, zip, opfDir)
        if (chapter) {
          chapters.push(chapter)
          chapterNumber++
        }
      } catch (error) {
        logger.warn(`⚠️ Error parsing chapter ${itemId}: ${error}`)
        continue
      }
    }

    if (chapters.length === 0) {
      throw new Error('No chapters found in EPUB file')
    }

    logger.info(`✅ Extracted ${chapters.length} chapters from EPUB`)

    return {
      title: metadata.title,
      author: metadata.author,
      chapters,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`❌ Failed to parse EPUB: ${errorMsg}`)
    throw new Error(`EPUB parsing failed: ${errorMsg}`)
  }
}

/**
 * Extract metadata from OPF data
 */
function extractMetadata(opfData: any): { title: string; author?: string } {
  try {
    const metadata = opfData?.package?.metadata?.[0]

    let title = 'Unknown'
    let author = undefined

    // Extract title
    if (metadata?.['dc:title']) {
      const titleArray = Array.isArray(metadata['dc:title']) ? metadata['dc:title'] : [metadata['dc:title']]
      title = titleArray[0]?._ || titleArray[0] || 'Unknown'
    }

    // Extract author
    if (metadata?.['dc:creator']) {
      const creatorArray = Array.isArray(metadata['dc:creator']) ? metadata['dc:creator'] : [metadata['dc:creator']]
      author = creatorArray[0]?._ || creatorArray[0] || undefined
    }

    return { title, author }
  } catch (error) {
    logger.warn(`Could not extract metadata: ${error}`)
    return { title: 'Unknown' }
  }
}

/**
 * Extract spine (reading order) from OPF data
 */
function extractSpine(opfData: any): string[] {
  try {
    const spine = opfData?.package?.spine?.[0]
    if (!spine || !spine.itemref) {
      return []
    }

    const itemrefArray = Array.isArray(spine.itemref) ? spine.itemref : [spine.itemref]
    return itemrefArray.map((item: any) => item?.$?.idref).filter((id: string) => id)
  } catch (error) {
    logger.warn(`Could not extract spine: ${error}`)
    return []
  }
}

/**
 * Extract manifest (file list) from OPF data
 */
function extractManifest(opfData: any): Record<string, { href: string; mediaType: string }> {
  try {
    const manifest = opfData?.package?.manifest?.[0]
    if (!manifest || !manifest.item) {
      return {}
    }

    const itemArray = Array.isArray(manifest.item) ? manifest.item : [manifest.item]
    const result: Record<string, { href: string; mediaType: string }> = {}

    itemArray.forEach((item: any) => {
      const id = item?.$?.id
      const href = item?.$?.href
      const mediaType = item?.$?.['media-type']

      if (id && href) {
        result[id] = { href, mediaType: mediaType || '' }
      }
    })

    return result
  } catch (error) {
    logger.warn(`Could not extract manifest: ${error}`)
    return {}
  }
}

/**
 * Parse individual chapter content
 */
async function parseChapter(
  htmlContent: string,
  suggestedNumber: number,
  itemId: string,
  _zip: JSZip,
  _opfDir: string
): Promise<EpubChapter | null> {
  try {
    // Strip HTML tags to get plain text
    const plainText = stripHtmlTags(htmlContent)

    // Skip empty chapters
    if (plainText.trim().length === 0) {
      return null
    }

    // Try to extract chapter number from content
    const firstLine = plainText.split('\n')[0] || ''
    const extractedNumber = extractChapterNumber(firstLine)
    const chapterNumber = extractedNumber !== null ? extractedNumber : suggestedNumber

    // Get chapter title from first line or generate from item ID
    let chapterTitle = normalizeChapterTitle(firstLine)
    if (!chapterTitle) {
      chapterTitle = `Chương ${chapterNumber}`
    }

    // Calculate word count
    const wordCount = estimateWordCount(plainText)

    const chapter: EpubChapter = {
      id: itemId,
      number: chapterNumber,
      title: chapterTitle,
      content: plainText,
      originalContent: htmlContent,
      wordCount,
    }

    logger.debug(`✅ Chapter ${chapterNumber}: "${chapterTitle}" (${wordCount} words)`)

    return chapter
  } catch (error) {
    logger.warn(`Could not parse chapter ${itemId}: ${error}`)
    return null
  }
}
