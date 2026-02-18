#!/usr/bin/env node

/**
 * Quick test to verify FFmpeg setup works
 * Run with: node test-ffmpeg.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 FFmpeg Setup Test\n');

// Test 1: Check if ffmpeg command exists
console.log('Test 1: Checking if ffmpeg is in PATH...');
try {
  const version = execSync('ffmpeg -version', { encoding: 'utf8', stdio: 'pipe' });
  const match = version.match(/ffmpeg version ([\d.]+)/);
  const ver = match ? match[1] : 'unknown';
  console.log(`✅ FFmpeg FOUND - Version: ${ver}\n`);
} catch (error) {
  console.log(`❌ FFmpeg NOT IN PATH\n`);
  console.log('Error:', error.message);
  console.log('\nYou need to:');
  console.log('1. Install FFmpeg from https://ffmpeg.org/download.html');
  console.log('2. Add to PATH: C:\\ffmpeg\\bin (or wherever you installed it)');
  console.log('3. Restart all command prompts and terminal windows');
  console.log('4. Verify with: ffmpeg -version\n');
  process.exit(1);
}

// Test 2: Check current PATH
console.log('Test 2: Current PATH environment variable:');
const pathVar = process.env.PATH || '';
const pathDirs = pathVar.split(path.delimiter);
console.log(`Found ${pathDirs.length} directories in PATH:`);
pathDirs.forEach((dir, i) => {
  console.log(`  ${i + 1}. ${dir}`);
});
console.log('');

// Test 3: Check common installation locations
console.log('Test 3: Checking common FFmpeg installation locations...');
const commonPaths = [
  'C:\\ffmpeg\\bin',
  'C:\\Program Files\\ffmpeg\\bin',
  'C:\\Program Files (x86)\\ffmpeg\\bin',
];

commonPaths.forEach(dir => {
  try {
    const fs = require('fs');
    const ffmpegExe = path.join(dir, 'ffmpeg.exe');
    if (fs.existsSync(ffmpegExe)) {
      console.log(`✅ Found: ${ffmpegExe}`);
    }
  } catch (e) {
    // Ignore
  }
});

console.log('\n✅ All tests passed! FFmpeg is properly installed and in PATH.');
console.log('You can now run the audiobook pipeline.');
