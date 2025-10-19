/**
 * Spotify Player Composable
 * Wraps Spotify Web Playback SDK for in-app playback
 */

import { ref, computed, onUnmounted } from 'vue'
import { useSpotifyAuth } from './useSpotifyAuth'

// Player state
const player = ref(null)
const deviceId = ref(null)
const isReady = ref(false)
const isPlaying = ref(false)
const currentTrack = ref(null)
const position = ref(0)
const duration = ref(0)
const volume = ref(0.5)
const error = ref(null)
const isPremium = ref(true) // Assume premium until proven otherwise

// SDK load promise (singleton)
let sdkLoadPromise = null

export function useSpotifyPlayer() {
  const { getAccessToken, isConnected } = useSpotifyAuth()

  /**
   * Load Spotify Web Playback SDK
   */
  const loadSDK = () => {
    if (sdkLoadPromise) return sdkLoadPromise

    sdkLoadPromise = new Promise((resolve, reject) => {
      if (window.Spotify) {
        resolve(window.Spotify)
        return
      }

      // SDK script should be loaded in index.html
      // Wait for it to be available
      window.onSpotifyWebPlaybackSDKReady = () => {
        resolve(window.Spotify)
      }

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Spotify SDK failed to load'))
      }, 10000)
    })

    return sdkLoadPromise
  }

  /**
   * Initialize Spotify Player
   */
  const initializePlayer = async () => {
    try {
      error.value = null

      if (!isConnected.value) {
        throw new Error('Not connected to Spotify. Please connect first.')
      }

      // Load SDK
      const Spotify = await loadSDK()

      // Get access token
      const token = await getAccessToken()

      // Create player instance
      player.value = new Spotify.Player({
        name: 'Techno Canvas Player',
        getOAuthToken: async (cb) => {
          const token = await getAccessToken()
          cb(token)
        },
        volume: volume.value,
      })

      // Error handling
      player.value.addListener('initialization_error', ({ message }) => {
        console.error('Initialization error:', message)
        error.value = 'Failed to initialize player: ' + message
      })

      player.value.addListener('authentication_error', ({ message }) => {
        console.error('Authentication error:', message)
        error.value = 'Authentication failed: ' + message
      })

      player.value.addListener('account_error', ({ message }) => {
        console.error('Account error:', message)
        error.value = 'Spotify Premium required for playback'
        isPremium.value = false
      })

      player.value.addListener('playback_error', ({ message }) => {
        console.error('Playback error:', message)
        error.value = 'Playback error: ' + message
      })

      // Ready
      player.value.addListener('ready', ({ device_id }) => {
        console.log('Spotify player ready with device ID:', device_id)
        deviceId.value = device_id
        isReady.value = true
      })

      // Not Ready
      player.value.addListener('not_ready', ({ device_id }) => {
        console.log('Spotify player not ready:', device_id)
        isReady.value = false
      })

      // Player state changed
      player.value.addListener('player_state_changed', (state) => {
        if (!state) {
          currentTrack.value = null
          isPlaying.value = false
          return
        }

        // Update current track
        currentTrack.value = {
          name: state.track_window.current_track.name,
          artists: state.track_window.current_track.artists.map(a => a.name).join(', '),
          album: state.track_window.current_track.album.name,
          albumArt: state.track_window.current_track.album.images[0]?.url,
          uri: state.track_window.current_track.uri,
        }

        // Update playback state
        isPlaying.value = !state.paused
        position.value = state.position
        duration.value = state.duration
      })

      // Connect player
      const connected = await player.value.connect()
      if (!connected) {
        throw new Error('Failed to connect player')
      }

      console.log('Spotify player initialized successfully')
    } catch (err) {
      console.error('Error initializing player:', err)
      error.value = err.message
      throw err
    }
  }

  /**
   * Play a track or playlist
   */
  const play = async (uri) => {
    if (!player.value || !deviceId.value) {
      throw new Error('Player not initialized')
    }

    try {
      const token = await getAccessToken()

      // Use Spotify Web API to start playback on our device
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId.value}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: uri ? [uri] : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to start playback')
      }
    } catch (err) {
      console.error('Error playing track:', err)
      error.value = err.message
      throw err
    }
  }

  /**
   * Pause playback
   */
  const pause = async () => {
    if (player.value) {
      await player.value.pause()
    }
  }

  /**
   * Resume playback
   */
  const resume = async () => {
    if (player.value) {
      await player.value.resume()
    }
  }

  /**
   * Toggle play/pause
   */
  const togglePlayPause = async () => {
    if (player.value) {
      await player.value.togglePlay()
    }
  }

  /**
   * Next track
   */
  const next = async () => {
    if (player.value) {
      await player.value.nextTrack()
    }
  }

  /**
   * Previous track
   */
  const previous = async () => {
    if (player.value) {
      await player.value.previousTrack()
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  const setVolume = async (value) => {
    if (player.value) {
      await player.value.setVolume(value)
      volume.value = value
    }
  }

  /**
   * Get current player state
   */
  const getPlayerState = async () => {
    if (player.value) {
      return await player.value.getCurrentState()
    }
    return null
  }

  /**
   * Cleanup player
   */
  const cleanup = () => {
    if (player.value) {
      player.value.disconnect()
      player.value = null
    }
    deviceId.value = null
    isReady.value = false
    isPlaying.value = false
    currentTrack.value = null
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup()
  })

  return {
    player: computed(() => player.value),
    deviceId: computed(() => deviceId.value),
    isReady,
    isPlaying,
    currentTrack: computed(() => currentTrack.value),
    position,
    duration,
    volume,
    error,
    isPremium,
    initializePlayer,
    play,
    pause,
    resume,
    togglePlayPause,
    next,
    previous,
    setVolume,
    getPlayerState,
    cleanup,
  }
}

