/**
 * Spotify Playlists Composable
 * Fetches and caches user playlists
 */

import { ref, computed } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'

const functions = getFunctions()

// Shared state
const playlists = ref([])
const isLoading = ref(false)
const error = ref(null)
const lastFetch = ref(null)

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000

export function useSpotifyPlaylists() {
  /**
   * Fetch playlists from backend
   */
  const fetchPlaylists = async (forceRefresh = false) => {
    // Check cache
    if (!forceRefresh && lastFetch.value && Date.now() - lastFetch.value < CACHE_TTL) {
      console.log('Using cached playlists')
      return playlists.value
    }

    try {
      isLoading.value = true
      error.value = null

      const spotifyGetPlaylistsFn = httpsCallable(functions, 'spotifyGetPlaylists')
      const result = await spotifyGetPlaylistsFn()

      playlists.value = result.data.playlists
      lastFetch.value = Date.now()

      return playlists.value
    } catch (err) {
      console.error('Error fetching playlists:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Refresh playlists (force refresh cache)
   */
  const refreshPlaylists = async () => {
    return await fetchPlaylists(true)
  }

  /**
   * Clear cache
   */
  const clearCache = () => {
    playlists.value = []
    lastFetch.value = null
  }

  return {
    playlists: computed(() => playlists.value),
    isLoading,
    error,
    fetchPlaylists,
    refreshPlaylists,
    clearCache,
  }
}

