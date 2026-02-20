module.exports = {
  appId: 'com.audiobook-uploader.app',
  productName: 'Audiobook Uploader',
  version: '0.1.0',

  // Main entry point for Electron
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

  // Disable ASAR to avoid file locking issues on Windows
  asar: false,
  asarUnpack: [],

  // Windows build configuration
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
  },

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

  // macOS build configuration
  mac: {
    target: [
      {
        target: 'dmg',    // DMG installer
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',    // ZIP archive
        arch: ['x64', 'arm64'],
      },
    ],
    category: 'public.app-category.utilities',
    icon: 'public/icon.png',
    signingIdentity: null,
  },

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
