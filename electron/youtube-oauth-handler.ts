/**
 * YouTube OAuth 2.0 Callback Handler for Electron
 * Manages local HTTP server to receive OAuth authorization code
 */

import http from 'http'
import { shell } from 'electron'
import { YouTubeOAuthManager, type YouTubeTokens, saveYouTubeTokens, YouTubeOAuthConfig } from '../src/services/youtube-auth'
import { createLogger } from '../src/utils/logger'

const logger = createLogger('youtube-oauth-handler')

export class YouTubeOAuthHandler {
  private oauthManager: YouTubeOAuthManager
  private callbackServer: http.Server | null = null
  private callbackPort: number

  constructor(oauthConfig: YouTubeOAuthConfig, port: number = 3000) {
    this.oauthManager = new YouTubeOAuthManager(oauthConfig)
    this.callbackPort = port
  }

  /**
   * Initiate YouTube OAuth 2.0 login flow
   * Opens browser for user to authenticate, waits for callback
   */
  async initiateLogin(): Promise<YouTubeTokens> {
    logger.info('🔐 Starting YouTube OAuth 2.0 login flow...')

    // Generate authorization URL with PKCE
    const { url, codeVerifier } = this.oauthManager.generateAuthorizationUrl()

    // Start local HTTP server to receive callback
    return new Promise((resolve, reject) => {
      this.callbackServer = http.createServer((req, res) => {
        try {
          // Parse callback URL
          const callbackUrl = new URL(req.url || '', `http://localhost:${this.callbackPort}`)
          const code = callbackUrl.searchParams.get('code')
          const error = callbackUrl.searchParams.get('error')
          const errorDescription = callbackUrl.searchParams.get('error_description')

          // Check for errors from Google
          if (error) {
            logger.error(`❌ OAuth error from Google: ${error} - ${errorDescription}`)
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <head><title>Authorization Error</title></head>
                <body style="font-family: Arial, sans-serif; padding: 40px;">
                  <h1>❌ Authorization Failed</h1>
                  <p><strong>Error:</strong> ${error}</p>
                  <p><strong>Description:</strong> ${errorDescription || 'No additional details'}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `)
            reject(new Error(`OAuth error: ${error} - ${errorDescription}`))
            return
          }

          // Check if we have authorization code
          if (!code) {
            logger.error('❌ No authorization code received')
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <head><title>Missing Authorization Code</title></head>
                <body style="font-family: Arial, sans-serif; padding: 40px;">
                  <h1>❌ Missing Authorization Code</h1>
                  <p>No authorization code was received from Google.</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `)
            reject(new Error('No authorization code received'))
            return
          }

          logger.info('✅ Received authorization code from Google')

          // Exchange code for tokens
          this.oauthManager
            .exchangeCodeForTokens(code, codeVerifier)
            .then(async (tokens) => {
              // Save tokens to secure storage
              await saveYouTubeTokens(tokens)

              // Send success page to browser
              res.writeHead(200, { 'Content-Type': 'text/html' })
              res.end(`
                <html>
                  <head><title>Authorization Successful</title></head>
                  <body style="font-family: Arial, sans-serif; padding: 40px;">
                    <h1>✅ YouTube Connected!</h1>
                    <p style="font-size: 16px;">
                      Your YouTube account has been successfully connected to Audiobook Uploader.
                    </p>
                    <p style="color: #666; margin-top: 20px;">
                      You can close this window and return to the application.
                    </p>
                  </body>
                </html>
              `)

              logger.info('✅ Tokens saved to secure storage')
              resolve(tokens)
            })
            .catch((error) => {
              logger.error(`❌ Failed to exchange code for tokens: ${error}`)
              res.writeHead(500, { 'Content-Type': 'text/html' })
              res.end(`
                <html>
                  <head><title>Token Exchange Error</title></head>
                  <body style="font-family: Arial, sans-serif; padding: 40px;">
                    <h1>❌ Token Exchange Failed</h1>
                    <p>Failed to exchange authorization code for access token.</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p>You can close this window.</p>
                  </body>
                </html>
              `)
              reject(error)
            })
        } catch (error) {
          logger.error(`❌ Error handling OAuth callback: ${error}`)
          res.writeHead(500, { 'Content-Type': 'text/html' })
          res.end('<h1>❌ Error</h1><p>An error occurred while processing the authorization callback.</p>')
          reject(error)
        } finally {
          // Close server after handling callback
          if (this.callbackServer) {
            this.callbackServer.close()
          }
        }
      })

      // Start listening for callback
      this.callbackServer.listen(this.callbackPort, '127.0.0.1', () => {
        logger.info(`📡 OAuth callback server listening on port ${this.callbackPort}`)

        // Open browser for user to authenticate
        logger.info('🌐 Opening browser for user authentication...')
        shell.openExternal(url)
      })

      // Handle server errors
      this.callbackServer.on('error', (error) => {
        logger.error(`❌ OAuth callback server error: ${error}`)
        reject(error)
      })
    })
  }

  /**
   * Close the callback server
   */
  closeCallbackServer(): void {
    if (this.callbackServer) {
      this.callbackServer.close()
      logger.info('📡 OAuth callback server closed')
    }
  }
}

/**
 * Global instance of YouTube OAuth handler
 * This is created once when the Electron app starts
 */
let youtubeOAuthHandler: YouTubeOAuthHandler | null = null

export function initializeYouTubeOAuthHandler(oauthConfig: YouTubeOAuthConfig): YouTubeOAuthHandler {
  youtubeOAuthHandler = new YouTubeOAuthHandler(oauthConfig)
  return youtubeOAuthHandler
}

export function getYouTubeOAuthHandler(): YouTubeOAuthHandler | null {
  return youtubeOAuthHandler
}
