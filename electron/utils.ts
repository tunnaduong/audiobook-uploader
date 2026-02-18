/**
 * Electron utility functions
 */

// Development mode is detected by:
// 1. NODE_ENV environment variable
// 2. VITE_DEV_SERVER_URL environment variable
// 3. Or if running from source (not packaged app)
export const isDev =
  process.env.NODE_ENV === 'development' ||
  process.env.VITE_DEV_SERVER_URL ||
  !process.resourcesPath.includes('app.asar') // Not in packaged Electron app

export function getAssetPath(asset: string): string {
  return isDev ? asset : `file://${__dirname}/../renderer/${asset}`
}

export function getPath(pathSegments: string[]): string {
  return pathSegments.join('/')
}
