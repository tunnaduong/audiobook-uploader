module.exports = {
  appId: 'com.audiobook-uploader.app',
  productName: 'Audiobook Uploader',
  version: '0.1.0',

  // Main entry point for Electron
  // Note: When using asar: false with extraMetadata, electron-builder shouldn't validate ASAR
  main: 'dist/electron/main.js',
  preload: 'dist/electron/preload.js',

  // Files to include in the build
  files: [
    'dist/electron/**/*.js',
    'dist/electron/**/*.d.ts',
    'dist/renderer/**/*',
    'package.json',
    'node_modules/**/*',
  ],

  directories: {
    buildResources: 'public',
    output: 'dist/release',
  },

  // Disable ASAR packaging to avoid validation issues
  // Files will be included directly in the app bundle without archiving
  asar: false,

  // ============================================
  // Windows build configuration (builds first)
  // ============================================
  win: {
    target: [
      {
        target: 'nsis',      // NSIS installer
        arch: ['x64'],
      },
      {
        target: 'portable',  // Portable EXE (no installation)
        arch: ['x64'],
      },
    ],
    certificateFile: null,
    certificatePassword: null,
    asar: false,  // Disable ASAR for Windows
  },

  // Windows NSIS installer settings
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Audiobook Uploader',
    installerIcon: 'public/icon.png',
    uninstallerIcon: 'public/icon.png',
    installerHeaderIcon: 'public/icon.png',
  },

  // ============================================
  // macOS build configuration (builds second)
  // ============================================
  mac: {
    target: [
      // Temporarily disabling DMG due to electron-builder v24.13.3 ASAR validation bug
      // {
      //   target: 'dmg',    // DMG installer
      //   arch: ['x64', 'arm64'],
      // },
      {
        target: 'zip',    // ZIP archive (works without ASAR validation issues)
        arch: ['x64', 'arm64'],
      },
    ],
    category: 'public.app-category.utilities',
    icon: 'public/icon.png',
    signingIdentity: null,
    asar: false,  // Disable ASAR for macOS
    // Force disable file validation that fails with ASAR
    cscLink: null,
    cscKeyPassword: null,
  },

  // macOS DMG installer settings
  dmg: {
    contents: [
      {
        x: 110,
        y: 150,
        type: 'file',
      },
      {
        x: 240,
        y: 150,
        type: 'link',
        path: '/Applications',
      },
    ],
    window: {
      width: 400,
      height: 300,
    },
  },

  // Common build options
  artifactName: '${productName}-${version}-${arch}.${ext}',
  generateUpdatesFilesForAllChannels: false,
  publish: null,
};
