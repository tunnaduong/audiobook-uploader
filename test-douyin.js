#!/usr/bin/env node

/**
 * Quick test script to verify douyin-downloader integration
 * Run: node test-douyin.js
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('\n🔍 Testing douyin-downloader integration...\n')

// Test 1: Check Python
console.log('1️⃣  Checking Python installation...')
try {
  const pythonVersion = execSync('python --version', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  }).trim()
  console.log(`   ✅ ${pythonVersion}`)
} catch (error) {
  console.log('   ❌ Python not found!')
  console.log('   📥 Install from: https://www.python.org/')
  process.exit(1)
}

// Test 2: Check douyin-downloader directory
console.log('\n2️⃣  Checking douyin-downloader directory...')
const downloaderPath = path.join(__dirname, 'bin', 'douyin-downloader')
if (fs.existsSync(downloaderPath)) {
  console.log(`   ✅ Found at: ${downloaderPath}`)
} else {
  console.log(`   ❌ Not found at: ${downloaderPath}`)
  process.exit(1)
}

// Test 3: Check DouYinCommand.py
console.log('\n3️⃣  Checking DouYinCommand.py...')
const scriptPath = path.join(downloaderPath, 'DouYinCommand.py')
if (fs.existsSync(scriptPath)) {
  console.log(`   ✅ Found at: ${scriptPath}`)
} else {
  console.log(`   ❌ Not found at: ${scriptPath}`)
  process.exit(1)
}

// Test 4: Check requirements installed
console.log('\n4️⃣  Checking Python dependencies...')
try {
  execSync('python -c "import requests, yaml, rich"', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  console.log('   ✅ All dependencies installed')
} catch (error) {
  console.log('   ❌ Missing dependencies!')
  console.log('   📥 Install with:')
  console.log(`      cd "${downloaderPath}"`)
  console.log('      pip install -r requirements.txt')
  process.exit(1)
}

// Test 5: Check cookies file (optional)
console.log('\n5️⃣  Checking cookies file (optional)...')
const cookiesPath = path.join(__dirname, 'cookies.txt')
if (fs.existsSync(cookiesPath)) {
  console.log(`   ✅ Found at: ${cookiesPath}`)
  const size = fs.statSync(cookiesPath).size
  console.log(`   📊 Size: ${size} bytes`)
} else {
  console.log(`   ⚠️  No cookies file found (optional - will use Chrome auto-extract)`)
}

// Test 6: Check .env configuration
console.log('\n6️⃣  Checking .env configuration...')
const envPath = path.join(__dirname, '.env')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  if (envContent.includes('DOUYIN_COOKIES_FILE')) {
    if (envContent.includes('# DOUYIN_COOKIES_FILE')) {
      console.log('   ⚠️  DOUYIN_COOKIES_FILE is commented (will use Chrome auto-extract)')
    } else {
      console.log('   ✅ DOUYIN_COOKIES_FILE is configured')
    }
  } else {
    console.log('   ⚠️  DOUYIN_COOKIES_FILE not in .env (will use Chrome auto-extract)')
  }
} else {
  console.log('   ⚠️  .env file not found')
}

console.log('\n' + '='.repeat(60))
console.log('✅ All checks passed! Ready to download from Douyin')
console.log('='.repeat(60))

console.log('\n📖 Next steps:')
console.log('  1. Open the app: npm run dev')
console.log('  2. Paste a Douyin URL (e.g., https://v.douyin.com/XXXXX/)')
console.log('  3. Click "Tạo Audiobook"')
console.log('\n📚 Setup guide: See DOUYIN_SETUP.md')
console.log('\n')
