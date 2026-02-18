/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  appId: 'com.audiobook.uploader',
  productName: 'Audiobook Uploader',
  files: [
    'dist/electron/**/*',
    'dist/renderer/**/*',
    'package.json',
    'node_modules/**/*',
  ],
  directories: {
    buildResources: 'public',
    output: 'release',
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'ia32'],
      },
      {
        target: 'portable',
        arch: ['x64', 'ia32'],
      },
    ],
    certificateFile: process.env.WIN_CSC_LINK,
    certificatePassword: process.env.WIN_CSC_KEY_PASSWORD,
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.productivity',
  },
  dmg: {
    sign: false,
  },
};

module.exports = config;
