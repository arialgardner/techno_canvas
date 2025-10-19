/**
 * Spotify Authentication Composable
 * Handles OAuth flow with PKCE and token management
 */

import { ref, computed, onUnmounted } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getFirestore, doc, onSnapshot } from 'firebase/firestore'
import { useAuth } from './useAuth'

const functions = getFunctions()
const db = getFirestore()

// Shared state
const isConnected = ref(false)
const isLoading = ref(false)
const error = ref(null)
const tokens = ref(null)

// Firestore listener unsubscribe function
let unsubscribeTokens = null
let unsubscribeConnection = null

export function useSpotifyAuth() {
  const { user } = useAuth()

  // Start listening to connection status when user is available
  const startListening = () => {
    if (!user.value) return

    const userId = user.value.uid

    // Listen to connection status
    const connectionRef = doc(db, 'users', userId, 'spotify', 'connection')
    unsubscribeConnection = onSnapshot(connectionRef, (snapshot) => {
      if (snapshot.exists()) {
        isConnected.value = snapshot.data().connected || false
      } else {
        isConnected.value = false
      }
    })

    // Listen to tokens
    const tokensRef = doc(db, 'users', userId, 'spotify', 'tokens')
    unsubscribeTokens = onSnapshot(tokensRef, (snapshot) => {
      if (snapshot.exists()) {
        tokens.value = snapshot.data()
      } else {
        tokens.value = null
      }
    })
  }

  // Stop listening
  const stopListening = () => {
    if (unsubscribeConnection) {
      unsubscribeConnection()
      unsubscribeConnection = null
    }
    if (unsubscribeTokens) {
      unsubscribeTokens()
      unsubscribeTokens = null
    }
  }

  /**
   * Generate PKCE code verifier (random string)
   */
  const generateCodeVerifier = () => {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return base64URLEncode(array)
  }

  /**
   * Generate PKCE code challenge from verifier
   */
  const generateCodeChallenge = async (verifier) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return base64URLEncode(new Uint8Array(hash))
  }

  /**
   * Base64 URL encode (RFC 4648)
   */
  const base64URLEncode = (buffer) => {
    const base64 = btoa(String.fromCharCode(...buffer))
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * Connect to Spotify - Initiate OAuth flow
   */
  const connectSpotify = async () => {
    try {
      isLoading.value = true
      error.value = null

      // Save current path to return after OAuth
      sessionStorage.setItem('spotify_return_path', window.location.pathname)

      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)

      // Save code verifier to session storage
      sessionStorage.setItem('spotify_code_verifier', codeVerifier)

      // Call backend to get authorization URL
      const spotifyAuthFn = httpsCallable(functions, 'spotifyAuth')
      const result = await spotifyAuthFn({ codeChallenge })

      // Save state for verification
      sessionStorage.setItem('spotify_state', result.data.state)

      // Redirect to Spotify authorization
      window.location.href = result.data.authUrl
    } catch (err) {
      console.error('Error connecting to Spotify:', err)
      error.value = err.message
      isLoading.value = false
    }
  }

  /**
   * Handle OAuth callback
   */
  const handleCallback = async (code, state) => {
    try {
      isLoading.value = true
      error.value = null

      // Verify state
      const savedState = sessionStorage.getItem('spotify_state')
      if (state !== savedState) {
        throw new Error('State mismatch - possible CSRF attack')
      }

      // Get code verifier from session storage
      const codeVerifier = sessionStorage.getItem('spotify_code_verifier')
      if (!codeVerifier) {
        throw new Error('Code verifier not found')
      }

      // Exchange code for tokens
      const spotifyCallbackFn = httpsCallable(functions, 'spotifyCallback')
      await spotifyCallbackFn({ code, codeVerifier })

      // Clean up session storage
      sessionStorage.removeItem('spotify_code_verifier')
      sessionStorage.removeItem('spotify_state')

      isLoading.value = false
      return true
    } catch (err) {
      console.error('Error in OAuth callback:', err)
      error.value = err.message
      isLoading.value = false
      return false
    }
  }

  /**
   * Disconnect from Spotify
   */
  const disconnectSpotify = async () => {
    try {
      isLoading.value = true
      error.value = null

      const spotifyRevokeFn = httpsCallable(functions, 'spotifyRevoke')
      await spotifyRevokeFn()

      isLoading.value = false
    } catch (err) {
      console.error('Error disconnecting Spotify:', err)
      error.value = err.message
      isLoading.value = false
    }
  }

  /**
   * Get valid access token (refresh if expired)
   */
  const getAccessToken = async () => {
    if (!tokens.value) {
      throw new Error('No tokens available. Please connect your Spotify account.')
    }

    // Check if token is expired or will expire in next minute
    const expiresAt = tokens.value.expires_at
    const now = Date.now()
    const bufferTime = 60 * 1000 // 1 minute buffer

    if (expiresAt < now + bufferTime) {
      // Token expired or expiring soon, refresh it
      try {
        const spotifyRefreshFn = httpsCallable(functions, 'spotifyRefresh')
        const result = await spotifyRefreshFn()
        return result.data.access_token
      } catch (err) {
        console.error('Error refreshing token:', err)
        throw new Error('Failed to refresh access token')
      }
    }

    return tokens.value.access_token
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stopListening()
  })

  // Auto-start listening if user is already available
  if (user.value) {
    startListening()
  }

  return {
    isConnected,
    isLoading,
    error,
    tokens: computed(() => tokens.value),
    connectSpotify,
    disconnectSpotify,
    handleCallback,
    getAccessToken,
    startListening,
    stopListening,
  }
}

