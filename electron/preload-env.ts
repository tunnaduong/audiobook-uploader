/**
 * Load environment variables BEFORE any other imports
 * This file must be imported FIRST in main.ts
 */

import * as dotenv from 'dotenv'
import * as fs from 'fs'
import path from 'path'

// Try multiple possible paths for .env file
const possiblePaths = [
  path.join(__dirname, '../.env'),           // When running from dist/electron
  path.join(__dirname, '../../.env'),        // Fallback path
  path.join(process.cwd(), '.env'),          // Current working directory
]

let envLoaded = false
for (const envPath of possiblePaths) {
  if (fs.existsSync(envPath)) {
    console.log(`✅ Loading .env from: ${envPath}`)
    dotenv.config({ path: envPath })
    envLoaded = true
    break
  }
}

if (!envLoaded) {
  console.warn('⚠️  .env file not found - environment variables may not be loaded')
}

// Verify env vars are loaded
console.log('📝 Environment variables loaded:')
console.log(`   VBEE_API_KEY: ${process.env.VBEE_API_KEY ? '✅ set' : '❌ not set'}`)
console.log(`   VBEE_APP_ID: ${process.env.VBEE_APP_ID ? '✅ set' : '❌ not set'}`)
console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ set' : '❌ not set'}`)
console.log(`   COMET_API_KEY: ${process.env.COMET_API_KEY ? '✅ set' : '❌ not set'}`)

export {}
