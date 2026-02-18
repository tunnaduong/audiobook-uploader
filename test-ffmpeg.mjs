import { execSync } from 'child_process';
import path from 'path';

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
  console.log('2. Add to PATH: C:\ffmpeg\bin (or wherever you installed it)');
  console.log('3. Restart all command prompts and terminal windows');
  console.log('4. Verify with: ffmpeg -version\n');
  process.exit(1);
}

console.log('✅ All tests passed! FFmpeg is properly installed and in PATH.');
console.log('You can now run the audiobook pipeline.');
