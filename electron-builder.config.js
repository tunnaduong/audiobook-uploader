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
    'dist/**/*',  // Include all compiled files
    'package.json',
    'node_modules/**/*',
  ],

  directories: {
    buildResources: 'public',
    output: 'dist',
  },

  // Disable ASAR packaging to avoid validation issues
  // Files will be included directly in the app bundle without archiving
  asar: false,

  // Ensure electron-builder doesn't create ASAR despite config
  // Some versions ignore asar: false, so we need extraMetadata
  extraMetadata: {
    main: 'dist/electron/main.js'
  },

  // ============================================
  // Windows build configuration (builds first)
  // ============================================
  win: {
    target: [
      'portable',  // Portable EXE (no installation) - no code signing needed
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
      'zip',    // ZIP archive (works without ASAR validation issues)
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
