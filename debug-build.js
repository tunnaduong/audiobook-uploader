#!/usr/bin/env node

const { build } = require('electron-builder');
const path = require('path');

async function runBuild() {
  try {
    // Skip code signing for local builds
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

    console.log('Starting build...');
    console.log('CWD:', process.cwd());

    const result = await build({
      config: {
        appId: 'com.audiobook-uploader.app',
        productName: 'Audiobook Uploader',
        files: [
          'dist/**/*',
          'package.json',
          'node_modules/**/*',
        ],
        directories: {
          buildResources: 'public',
          output: 'dist',
        },
        asar: false,
        extraMetadata: {
          main: 'dist/electron/main.js'
        },
        win: {
          target: [
            'portable',
          ],
          certificateFile: null,
          certificatePassword: null,
          asar: false,
          forceCodeSigning: false,
        },
      },
      publish: 'never',
    });

    console.log('✅ Build successful!');
    console.log('Artifacts:', result);
  } catch (error) {
    console.error('❌ Build failed!');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runBuild();
