import path from 'path'
import fs from 'fs'
import os from 'os'
import { execSync } from 'child_process'
import { createLogger } from './logger'

const logger = createLogger('douyin-downloader-setup')

const DOWNLOADER_PATH = path.join(
  __dirname,
  '..',
  '..',
  'bin',
  'douyin-downloader'
)

export async function getDouyinDownloaderPath(): Promise<string> {
  try {
    const downloaderPath = DOWNLOADER_PATH

    // Check if directory exists
    if (!fs.existsSync(downloaderPath)) {
      logger.error(`❌ douyin-downloader not found at: ${downloaderPath}`)
      throw new Error(
        `douyin-downloader not installed at ${downloaderPath}\n\n` +
        `Installation:\n` +
        `1. cd "${DOWNLOADER_PATH}"\n` +
        `2. pip install -r requirements.txt`
      )
    }

    // Check if DouYinCommand.py exists
    const scriptPath = path.join(downloaderPath, 'DouYinCommand.py')
    if (!fs.existsSync(scriptPath)) {
      throw new Error(
        `DouYinCommand.py not found at ${scriptPath}\n` +
        `Please ensure douyin-downloader is properly installed.`
      )
    }

    logger.info(`✅ douyin-downloader found at: ${downloaderPath}`)
    return downloaderPath
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Failed to locate douyin-downloader: ${errorMsg}`)
    throw error
  }
}

/**
 * Create a temporary config.yml file for douyin-downloader
 */
export function createDouyinConfig(
  videoUrl: string,
  outputPath: string,
  cookiesFile?: string
): string {
  try {
    // Create config object
    const config = {
      link: [videoUrl],
      path: outputPath,
      cookies: {
        msToken: '',
        ttwid: '',
        odin_tt: '',
        passport_csrf_token: '',
        sid_guard: ''
      },
      music: false,
      cover: false,
      avatar: false,
      json: false,
      mode: ['post'],
      number: {
        post: 1,
        like: 0,
        allmix: 0,
        mix: 0
      },
      thread: 1,
      database: false
    }

    // If cookies file provided, extract cookies from it
    if (cookiesFile && fs.existsSync(cookiesFile)) {
      logger.info(`📝 Reading cookies from: ${cookiesFile}`)
      const cookiesContent = fs.readFileSync(cookiesFile, 'utf-8')

      // Parse Netscape format cookies
      const cookieMap = parseNetscapeCookies(cookiesContent)

      // Extract specific cookies needed for Douyin
      config.cookies.msToken = cookieMap.get('msToken') || ''
      config.cookies.ttwid = cookieMap.get('ttwid') || ''
      config.cookies.odin_tt = cookieMap.get('odin_tt') || ''
      config.cookies.passport_csrf_token = cookieMap.get('passport_csrf_token') || ''
      config.cookies.sid_guard = cookieMap.get('sid_guard') || ''

      logger.debug(`📊 Extracted cookies:`)
      logger.debug(`   - msToken: ${config.cookies.msToken ? '✓' : '✗'}`)
      logger.debug(`   - ttwid: ${config.cookies.ttwid ? '✓' : '✗'}`)
      logger.debug(`   - odin_tt: ${config.cookies.odin_tt ? '✓' : '✗'}`)
      logger.debug(`   - passport_csrf_token: ${config.cookies.passport_csrf_token ? '✓' : '✗'}`)
      logger.debug(`   - sid_guard: ${config.cookies.sid_guard ? '✓' : '✗'}`)
    }

    // Create temp config file
    const tempConfigPath = path.join(os.tmpdir(), `douyin-config-${Date.now()}.yml`)

    // Convert to YAML format
    const yamlContent = generateYaml(config)
    fs.writeFileSync(tempConfigPath, yamlContent, 'utf-8')

    logger.info(`✅ Created config file: ${tempConfigPath}`)
    return tempConfigPath
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Failed to create Douyin config: ${errorMsg}`)
    throw error
  }
}

/**
 * Parse Netscape format cookies file
 */
function parseNetscapeCookies(content: string): Map<string, string> {
  const cookies = new Map<string, string>()

  const lines = content.split('\n')
  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith('#') || !line.trim()) {
      continue
    }

    const parts = line.split('\t')
    if (parts.length >= 7) {
      const cookieName = parts[5]
      const cookieValue = parts[6]
      if (cookieName && cookieValue) {
        cookies.set(cookieName, cookieValue)
      }
    }
  }

  return cookies
}

/**
 * Convert config object to YAML format
 */
function generateYaml(config: any): string {
  const lines: string[] = []

  lines.push('# Douyin Downloader Config (Auto-generated)')
  lines.push('link:')
  for (const link of config.link) {
    lines.push(`  - ${link}`)
  }

  lines.push(`path: ${config.path}`)

  lines.push('cookies:')
  for (const [key, value] of Object.entries(config.cookies)) {
    lines.push(`  ${key}: "${value}"`)
  }

  lines.push(`music: ${config.music}`)
  lines.push(`cover: ${config.cover}`)
  lines.push(`avatar: ${config.avatar}`)
  lines.push(`json: ${config.json}`)

  lines.push('mode:')
  for (const mode of config.mode) {
    lines.push(`  - ${mode}`)
  }

  lines.push('number:')
  lines.push(`  post: ${config.number.post}`)
  lines.push(`  like: ${config.number.like}`)
  lines.push(`  allmix: ${config.number.allmix}`)
  lines.push(`  mix: ${config.number.mix}`)

  lines.push(`thread: ${config.thread}`)
  lines.push(`database: ${config.database}`)

  return lines.join('\n')
}

/**
 * Check Python installation
 */
export function checkPythonInstallation(): boolean {
  try {
    const pythonVersion = execSync('python --version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    logger.info(`✅ Python found: ${pythonVersion.trim()}`)
    return true
  } catch (error) {
    logger.error(`❌ Python not found. Please install Python 3.9+`)
    return false
  }
}
