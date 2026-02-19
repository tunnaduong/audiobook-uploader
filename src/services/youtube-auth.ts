/**
 * YouTube OAuth 2.0 Authentication Manager
 * Handles OAuth 2.0 authorization code flow with PKCE for security
 */

import { createHash } from 'crypto'
import axios, { AxiosError } from 'axios'
import keytar from 'keytar'
import { YouTubeTokens as YouTubeTokensType } from '../types'
import { createLogger } from '../utils/logger'

const logger = createLogger('youtube-auth')

// Re-export the type
export type YouTubeTokens = YouTubeTokensType

export interface YouTubeOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUrl: string
  scopes: string[]
}

export class YouTubeOAuthManager {
  private config: YouTubeOAuthConfig
  private tokenEndpoint = 'https://oauth2.googleapis.com/token'
  private authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth'

  constructor(config: YouTubeOAuthConfig) {
    this.config = config
  }

  /**
   * Generate a random code verifier for PKCE
   * RFC 7636: code_verifier is 43-128 characters from [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
   */
  private generateCodeVerifier(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    let verifier = ''
    for (let i = 0; i < 128; i++) {
      verifier += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return verifier
  }

  /**
   * Generate code challenge from code verifier using SHA256
   * code_challenge = BASE64URL(SHA256(code_verifier))
   */
  private generateCodeChallenge(verifier: string): string {
    const hash = createHash('sha256').update(verifier).digest()
    return Buffer.from(hash)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Generate authorization URL with PKCE
   * User will be directed to Google login page
   */
  generateAuthorizationUrl(): { url: string; codeVerifier: string } {
    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = this.generateCodeChallenge(codeVerifier)

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUrl,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256', // SHA256 method for PKCE
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent screen even if user already approved
    })

    const url = `${this.authorizationEndpoint}?${params.toString()}`

    logger.info('✅ Generated authorization URL with PKCE')
    return { url, codeVerifier }
  }

  /**
   * Exchange authorization code for access token and refresh token
   */
  async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<YouTubeTokensType> {
    try {
      const response = await axios.post(this.tokenEndpoint, {
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUrl,
        code_verifier: codeVerifier, // PKCE verification
      })

      const tokens: YouTubeTokensType = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in || 3600,
        expiresAt: Date.now() + ((response.data.expires_in || 3600) * 1000),
        tokenType: response.data.token_type || 'Bearer',
      }

      logger.info('✅ Successfully exchanged code for tokens')
      return tokens
    } catch (error) {
      const axiosError = error as AxiosError
      logger.error(`❌ Failed to exchange code for tokens: ${axiosError.message}`)
      logger.error(`Response data: ${JSON.stringify(axiosError.response?.data)}`)
      throw new Error(`Token exchange failed: ${axiosError.message}`)
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<YouTubeTokensType> {
    try {
      const response = await axios.post(this.tokenEndpoint, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      })

      const tokens: YouTubeTokensType = {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || refreshToken, // Use old refresh token if new one not provided
        expiresIn: response.data.expires_in || 3600,
        expiresAt: Date.now() + ((response.data.expires_in || 3600) * 1000),
        tokenType: response.data.token_type || 'Bearer',
      }

      logger.info('✅ Successfully refreshed access token')
      return tokens
    } catch (error) {
      const axiosError = error as AxiosError
      logger.error(`❌ Failed to refresh access token: ${axiosError.message}`)
      throw new Error(`Token refresh failed: ${axiosError.message}`)
    }
  }

  /**
   * Ensure valid access token, refresh if expired
   */
  async ensureValidToken(tokens: YouTubeTokensType): Promise<YouTubeTokensType> {
    const now = Date.now()
    const buffer = 5 * 60 * 1000 // 5 minute buffer

    if (tokens.expiresAt - now > buffer) {
      // Token still valid
      return tokens
    }

    // Token expired or expiring soon, refresh it
    logger.info('⚠️ Access token expired or expiring, refreshing...')
    return this.refreshAccessToken(tokens.refreshToken)
  }
}

/**
 * Save YouTube tokens to secure OS credential storage
 */
export async function saveYouTubeTokens(tokens: YouTubeTokensType): Promise<void> {
  try {
    await keytar.setPassword('audiobook-uploader', 'youtube-access-token', tokens.accessToken)
    await keytar.setPassword('audiobook-uploader', 'youtube-refresh-token', tokens.refreshToken)
    // Note: expiresAt is not sensitive so we don't store it in keytar
    logger.info('✅ YouTube tokens saved to secure storage')
  } catch (error) {
    logger.error(`❌ Failed to save YouTube tokens: ${error}`)
    throw error
  }
}

/**
 * Retrieve YouTube tokens from secure OS credential storage
 */
export async function getYouTubeTokens(): Promise<YouTubeTokensType | null> {
  try {
    const accessToken = await keytar.getPassword('audiobook-uploader', 'youtube-access-token')
    const refreshToken = await keytar.getPassword('audiobook-uploader', 'youtube-refresh-token')

    if (!accessToken || !refreshToken) {
      return null
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: 0, // Will be refreshed on next use
      expiresIn: 3600,
      tokenType: 'Bearer',
    }
  } catch (error) {
    logger.error(`❌ Failed to retrieve YouTube tokens: ${error}`)
    return null
  }
}

/**
 * Delete YouTube tokens from secure storage
 */
export async function deleteYouTubeTokens(): Promise<void> {
  try {
    await keytar.deletePassword('audiobook-uploader', 'youtube-access-token')
    await keytar.deletePassword('audiobook-uploader', 'youtube-refresh-token')
    logger.info('✅ YouTube tokens deleted from secure storage')
  } catch (error) {
    logger.error(`❌ Failed to delete YouTube tokens: ${error}`)
    // Don't throw - token may not exist
  }
}

/**
 * Check if valid YouTube tokens exist
 */
export async function hasValidYouTubeTokens(): Promise<boolean> {
  const tokens = await getYouTubeTokens()
  return tokens !== null
}
