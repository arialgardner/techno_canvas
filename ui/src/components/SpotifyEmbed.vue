<template>
  <div class="spotify-embed-container">
    <!-- Search/Browse Section -->
    <div class="search-section">
      <div class="search-bar">
        <input 
          v-model="searchQuery" 
          @keyup.enter="handleSearch"
          placeholder="Search for music genres..."
          class="search-input"
        />
        <button @click="handleSearch" class="search-button">Search</button>
      </div>
      
      <!-- Quick Picks -->
      <div class="quick-picks">
        <button 
          v-for="pick in quickPicks" 
          :key="pick.query"
          @click="handleQuickPick(pick)"
          class="quick-pick-btn"
          :disabled="isLoadingPlaylists"
        >
          {{ pick.name }}
        </button>
      </div>
    </div>

    <!-- Login Prompt Modal -->
    <div v-if="showLoginPrompt" class="login-prompt-overlay">
      <div class="login-prompt-modal">
        <div class="modal-header">
          <span class="modal-title">♫ {{ selectedPlaylist?.name }}</span>
          <button @click="closeLoginPrompt" class="close-btn">×</button>
        </div>
        
        <div class="modal-content">
          <div v-if="selectedPlaylist?.images?.[0]?.url" class="playlist-preview">
            <img :src="selectedPlaylist.images[0].url" :alt="selectedPlaylist.name" />
          </div>
          
          <p class="prompt-message">
            Connect your Spotify account to listen to full songs and control playback!
          </p>
          
          <div class="prompt-actions">
            <button @click="handleConnectSpotify" class="connect-btn" :disabled="isConnecting">
              <span v-if="isConnecting">Connecting...</span>
              <span v-else>Connect to Spotify</span>
            </button>
            <button @click="playEmbedPreview" class="preview-btn">
              Continue with Preview
            </button>
          </div>
          
          <p class="small-text">
            Preview mode lets you listen to 30-second clips. Connect for full songs.
          </p>
        </div>
      </div>
    </div>

    <!-- Currently Playing Embed -->
    <div v-else-if="currentEmbed" class="embed-player">
      <div class="embed-header">
        <span class="now-playing">♫ {{ currentEmbedName }}</span>
        <button @click="closeEmbed" class="close-btn">×</button>
      </div>
      <iframe
        :src="currentEmbed"
        class="embed-iframe"
        frameborder="0"
        allowfullscreen
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      ></iframe>
    </div>

    <!-- Popular Playlists -->
    <div v-else class="playlists-section">
      <h3>Playlists</h3>
      
      <!-- Loading State -->
      <div v-if="isLoadingPlaylists" class="loading-state">
        <div class="spinner"></div>
        <p>Loading playlists...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="playlistError" class="error-state">
        <p>{{ playlistError }}</p>
        <button @click="loadDefaultPlaylists" class="retry-btn">Retry</button>
      </div>

      <!-- Empty State -->
      <div v-else-if="popularPlaylists.length === 0" class="empty-state">
        <div class="empty-icon">♫</div>
        <p>Click a genre button above to discover playlists</p>
      </div>

      <!-- Playlists Grid -->
      <div v-else class="playlist-grid">
        <div 
          v-for="playlist in popularPlaylists" 
          :key="playlist.uri"
          @click="handlePlaylistClick(playlist)"
          class="playlist-card"
        >
          <div class="playlist-image">
            <img 
              v-if="playlist.images && playlist.images.length > 0"
              :src="playlist.images[0].url" 
              :alt="playlist.name"
            />
            <div v-else class="playlist-icon">♫</div>
          </div>
          <div class="playlist-name">{{ playlist.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, computed, provide, inject } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useRoute } from 'vue-router'
import { useSpotifyAuth } from '../composables/useSpotifyAuth'
import OpenAI from 'openai'

const functions = getFunctions()

// OpenAI configuration
const OPENAI_CONFIG = {
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
}

export default {
  name: 'SpotifyEmbed',
  setup() {
    // Get canvasId from route to make storage per-canvas
    const route = useRoute()
    const canvasId = computed(() => route.params.canvasId || 'default')
    
    // Use Spotify Auth composable
    const { isConnected, connectSpotify, startListening } = useSpotifyAuth()
    
    // Start listening for Spotify auth status
    startListening()
    
    // Inject expand function from SpotifySidebar
    const expandSpotifyPlayer = inject('expandSpotifyPlayer', null)
    
    // Canvas-specific localStorage keys
    const STORAGE_KEY_SEARCH = computed(() => `spotify-search-${canvasId.value}`)
    const STORAGE_KEY_PLAYLISTS = computed(() => `spotify-playlists-${canvasId.value}`)
    const STORAGE_KEY_QUICK_PICKS = computed(() => `spotify-buttons-${canvasId.value}`)
    const STORAGE_KEY_CURRENT_EMBED = computed(() => `spotify-embed-${canvasId.value}`)
    const STORAGE_KEY_CURRENT_NAME = computed(() => `spotify-name-${canvasId.value}`)

    // Load saved state from localStorage for this canvas
    const savedSearch = localStorage.getItem(STORAGE_KEY_SEARCH.value)
    const savedPlaylists = localStorage.getItem(STORAGE_KEY_PLAYLISTS.value)
    const savedQuickPicks = localStorage.getItem(STORAGE_KEY_QUICK_PICKS.value)
    const savedEmbed = localStorage.getItem(STORAGE_KEY_CURRENT_EMBED.value)
    const savedName = localStorage.getItem(STORAGE_KEY_CURRENT_NAME.value)

    const searchQuery = ref(savedSearch || '')
    const currentEmbed = ref(savedEmbed || null)
    const currentEmbedName = ref(savedName || '')
    const isLoadingPlaylists = ref(false)
    const playlistError = ref(null)
    const openai = ref(null)
    
    // Login prompt state
    const showLoginPrompt = ref(false)
    const selectedPlaylist = ref(null)
    const isConnecting = ref(false)

    // Restore playlists from localStorage for this canvas
    const popularPlaylists = ref(
      savedPlaylists ? JSON.parse(savedPlaylists) : []
    )

    // Default quick picks
    const defaultQuickPicks = [
      { name: 'Breakcore', query: 'breakcore' },
      { name: 'Cyberpunk', query: 'cyberpunk' },
      { name: 'Dreamcore', query: 'dreamcore' },
      { name: 'Vaporwave', query: 'vaporwave' },
    ]

    // Quick picks - restore from localStorage or use defaults
    const quickPicks = ref(
      savedQuickPicks ? JSON.parse(savedQuickPicks) : defaultQuickPicks
    )

    // Initialize OpenAI client
    const initOpenAI = () => {
      if (!openai.value && OPENAI_CONFIG.apiKey) {
        openai.value = new OpenAI(OPENAI_CONFIG)
      }
    }

    // Generate genre suggestions using OpenAI
    const getGenreSuggestions = async (query) => {
      try {
        initOpenAI()
        
        if (!openai.value) {
          console.warn('OpenAI not configured, using default suggestions')
          return getDefaultSuggestions()
        }

        const prompt = `Given the music genre or search term "${query}", suggest 4 related or similar music genres that someone might enjoy.

Return ONLY a JSON array of objects with this exact format:
[
  {"name": "Genre Name", "query": "search query for spotify"},
  {"name": "Genre Name", "query": "search query for spotify"},
  {"name": "Genre Name", "query": "search query for spotify"},
  {"name": "Genre Name", "query": "search query for spotify"}
]

Rules:
- Keep genre names short (1-3 words)
- Make search queries specific enough for Spotify
- Include a mix of closely related and somewhat different genres
- Consider subgenres, related styles, and crossover genres
- For electronic music, suggest other electronic subgenres
- For rock, suggest other rock subgenres, etc.

Return ONLY the JSON array, no other text.`

        const response = await openai.value.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 300,
        })

        const content = response.choices[0]?.message?.content?.trim()
        
        if (!content) {
          return getDefaultSuggestions()
        }

        // Parse JSON from response
        let parsed
        try {
          // Handle markdown code blocks if present
          let jsonStr = content
          if (content.includes('```json')) {
            const match = content.match(/```json\n([\s\S]*?)\n```/)
            jsonStr = match ? match[1] : content
          } else if (content.includes('```')) {
            const match = content.match(/```\n([\s\S]*?)\n```/)
            jsonStr = match ? match[1] : content
          }
          
          parsed = JSON.parse(jsonStr)
          
          // Validate format
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].name && parsed[0].query) {
            return parsed.slice(0, 4) // Ensure max 4 suggestions
          }
        } catch (e) {
          console.error('Failed to parse AI suggestions:', e)
        }

        return getDefaultSuggestions()
      } catch (error) {
        console.error('Error getting AI genre suggestions:', error)
        return getDefaultSuggestions()
      }
    }

    // Fallback default suggestions
    const getDefaultSuggestions = () => {
      return [
        { name: 'Breakcore', query: 'breakcore' },
        { name: 'Cyberpunk', query: 'cyberpunk' },
        { name: 'Dreamcore', query: 'dreamcore' },
        { name: 'Vaporwave', query: 'vaporwave' },
      ]
    }

    // Search Spotify for playlists
    const searchSpotify = async (query, limit = 12) => {
      try {
        const spotifySearchFn = httpsCallable(functions, 'spotifySearch')
        const result = await spotifySearchFn({ query, limit })
        return result.data.playlists
      } catch (error) {
        console.error('Error searching Spotify:', error)
        throw error
      }
    }

    // Load default techno playlists on mount
    const loadDefaultPlaylists = async () => {
      isLoadingPlaylists.value = true
      playlistError.value = null

      try {
        // Search for general techno playlists
        const playlists = await searchSpotify('techno', 12)
        popularPlaylists.value = playlists
      } catch (error) {
        console.error('Failed to load playlists:', error)
        playlistError.value = 'Failed to load playlists. Please try again.'
      } finally {
        isLoadingPlaylists.value = false
      }
    }

    // Handle quick pick clicks - search for that genre and update buttons with AI suggestions
    const handleQuickPick = async (pick) => {
      // Close current player if open
      currentEmbed.value = null
      currentEmbedName.value = ''
      
      isLoadingPlaylists.value = true
      playlistError.value = null

      try {
        // Search for playlists and get AI suggestions in parallel
        const [playlists, suggestions] = await Promise.all([
          searchSpotify(pick.query, 12),
          getGenreSuggestions(pick.query)
        ])
        
        popularPlaylists.value = playlists
        quickPicks.value = suggestions
      } catch (error) {
        console.error('Failed to search genre:', error)
        playlistError.value = `Failed to load ${pick.name} playlists`
      } finally {
        isLoadingPlaylists.value = false
      }
    }

    // Watch for state changes and persist to localStorage (per canvas)
    watch(searchQuery, (newValue) => {
      if (newValue) {
        localStorage.setItem(STORAGE_KEY_SEARCH.value, newValue)
      } else {
        localStorage.removeItem(STORAGE_KEY_SEARCH.value)
      }
    })

    watch(popularPlaylists, (newValue) => {
      if (newValue.length > 0) {
        localStorage.setItem(STORAGE_KEY_PLAYLISTS.value, JSON.stringify(newValue))
      } else {
        localStorage.removeItem(STORAGE_KEY_PLAYLISTS.value)
      }
    }, { deep: true })

    watch(quickPicks, (newValue) => {
      localStorage.setItem(STORAGE_KEY_QUICK_PICKS.value, JSON.stringify(newValue))
    }, { deep: true })

    // Watch for canvas changes and reload state
    watch(() => route.params.canvasId, (newCanvasId) => {
      // Load state for new canvas
      const newSearch = localStorage.getItem(`spotify-search-${newCanvasId}`)
      const newPlaylists = localStorage.getItem(`spotify-playlists-${newCanvasId}`)
      const newQuickPicks = localStorage.getItem(`spotify-buttons-${newCanvasId}`)
      const newEmbed = localStorage.getItem(`spotify-embed-${newCanvasId}`)
      const newName = localStorage.getItem(`spotify-name-${newCanvasId}`)
      
      searchQuery.value = newSearch || ''
      popularPlaylists.value = newPlaylists ? JSON.parse(newPlaylists) : []
      quickPicks.value = newQuickPicks ? JSON.parse(newQuickPicks) : defaultQuickPicks
      currentEmbed.value = newEmbed || null
      currentEmbedName.value = newName || ''
      
      // Close login prompt if open
      showLoginPrompt.value = false
      selectedPlaylist.value = null
      isLoadingPlaylists.value = false
      playlistError.value = null
    })

    const handlePlaylistClick = (playlist) => {
      // If already connected to Spotify, play directly
      if (isConnected.value) {
        playEmbed(playlist.uri, playlist.name)
      } else {
        // Show login prompt
        selectedPlaylist.value = playlist
        showLoginPrompt.value = true
      }
    }

    const handleConnectSpotify = async () => {
      isConnecting.value = true
      try {
        await connectSpotify()
        // After successful connection, user will be redirected
        // They can resume listening when they return
      } catch (error) {
        console.error('Failed to connect to Spotify:', error)
        alert('Failed to connect to Spotify. Please try again.')
      } finally {
        isConnecting.value = false
      }
    }

    const playEmbedPreview = () => {
      if (selectedPlaylist.value) {
        playEmbed(selectedPlaylist.value.uri, selectedPlaylist.value.name)
        showLoginPrompt.value = false
        selectedPlaylist.value = null
      }
    }

    const closeLoginPrompt = () => {
      showLoginPrompt.value = false
      selectedPlaylist.value = null
    }

    const playEmbed = (uri, name) => {
      // Convert Spotify URI to embed URL
      // Supports both formats:
      // - spotify:type:id (e.g., spotify:playlist:37i9dQZF1DXcBWIGoYBM5M) - from chat links
      // - type:id (e.g., playlist:37i9dQZF1DXcBWIGoYBM5M) - from music player
      
      const parts = uri.split(':')
      let type, id
      
      if (parts.length === 3) {
        // Format: spotify:type:id
        type = parts[1]
        id = parts[2]
      } else if (parts.length === 2) {
        // Format: type:id
        type = parts[0]
        id = parts[1]
      } else {
        console.error('[SpotifyEmbed] Invalid URI format:', uri)
        return
      }
      
      // Remove any query parameters from the ID (e.g., ?si=...)
      if (id && id.includes('?')) {
        id = id.split('?')[0]
      }
      
      currentEmbed.value = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`
      currentEmbedName.value = name
      
      // Save to localStorage for this canvas
      localStorage.setItem(STORAGE_KEY_CURRENT_EMBED.value, currentEmbed.value)
      localStorage.setItem(STORAGE_KEY_CURRENT_NAME.value, currentEmbedName.value)
    }

    const closeEmbed = () => {
      currentEmbed.value = null
      currentEmbedName.value = ''
      
      // Clear from localStorage for this canvas
      localStorage.removeItem(STORAGE_KEY_CURRENT_EMBED.value)
      localStorage.removeItem(STORAGE_KEY_CURRENT_NAME.value)
    }

    const handleSearch = async () => {
      if (!searchQuery.value.trim()) return
      
      // Close current player if open
      currentEmbed.value = null
      currentEmbedName.value = ''
      
      isLoadingPlaylists.value = true
      playlistError.value = null

      try {
        // Search for playlists and get AI suggestions in parallel
        const [playlists, suggestions] = await Promise.all([
          searchSpotify(searchQuery.value, 12),
          getGenreSuggestions(searchQuery.value)
        ])
        
        popularPlaylists.value = playlists
        quickPicks.value = suggestions
      } catch (error) {
        console.error('Failed to search:', error)
        playlistError.value = 'Search failed. Please try again.'
      } finally {
        isLoadingPlaylists.value = false
      }
    }

    // Function to load playlist from URL (for chat links)
    const loadPlaylistFromUrl = async (url) => {
      try {
        // Parse Spotify URL to extract type and ID
        // Supports formats:
        // - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
        // - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
        // - spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
        
        let type, id
        
        if (url.startsWith('spotify:')) {
          // Handle spotify: URI format
          const parts = url.split(':')
          type = parts[1]
          id = parts[2]
        } else {
          // Handle https://open.spotify.com URL format
          const urlObj = new URL(url)
          const pathParts = urlObj.pathname.split('/').filter(Boolean)
          type = pathParts[0] // playlist, track, album, etc.
          id = pathParts[1]
        }
        
        if (!type || !id) {
          console.error('[SpotifyEmbed] Invalid Spotify URL:', url)
          return false
        }
        
        // Convert to Spotify URI format
        const uri = `spotify:${type}:${id}`
        
        // Fetch the actual name from Spotify's oEmbed API (public, no auth required)
        let name = `${type.charAt(0).toUpperCase() + type.slice(1)}`
        try {
          const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/${type}/${id}`
          const response = await fetch(oembedUrl)
          if (response.ok) {
            const data = await response.json()
            name = data.title || name
          }
        } catch (error) {
          console.warn('[SpotifyEmbed] Could not fetch name from oEmbed:', error)
          // Fall back to generic name
          name = `${type.charAt(0).toUpperCase() + type.slice(1)} (${id.substring(0, 8)}...)`
        }
        
        // Expand the Spotify player first
        if (expandSpotifyPlayer) {
          expandSpotifyPlayer()
        }
        
        // Play the embed
        playEmbed(uri, name)
        
        return true
      } catch (error) {
        console.error('Error loading playlist from URL:', error)
        return false
      }
    }
    
    // Note: loadPlaylistFromUrl is exposed in return statement below
    // and re-provided by SpotifySidebar for sibling components (ChatLog)

    return {
      searchQuery,
      currentEmbed,
      currentEmbedName,
      quickPicks,
      popularPlaylists,
      isLoadingPlaylists,
      playlistError,
      showLoginPrompt,
      selectedPlaylist,
      isConnecting,
      isConnected,
      handlePlaylistClick,
      handleConnectSpotify,
      playEmbedPreview,
      closeLoginPrompt,
      playEmbed,
      closeEmbed,
      handleSearch,
      handleQuickPick,
      loadDefaultPlaylists,
      loadPlaylistFromUrl,
    }
  }
}
</script>

<style scoped>
.spotify-embed-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #000000;
  overflow: hidden;
  min-height: 0; /* Allow flex to shrink properly at smaller sizes */
}

.search-section {
  padding: 12px;
  border-bottom: 2px solid #808080;
  background: #000000;
  flex-shrink: 0; /* Prevent search section from shrinking */
}

.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.search-input {
  flex: 1;
  padding: 6px 8px;
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
  font-size: 11px;
  font-family: 'Tahoma', 'MS Sans Serif', sans-serif;
  background: #ffffff;
  color: #000000;
}

.search-input:focus {
  outline: none;
  border: 2px solid #000080;
}

.search-input::placeholder {
  color: #808080;
}

.search-button {
  padding: 6px 16px;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
}

.search-button:active {
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.quick-picks {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-pick-btn {
  padding: 4px 12px;
  background: #000080;
  color: #ffffff;
  border: 2px solid #ffffff;
  border-right-color: #000000;
  border-bottom-color: #000000;
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
}

.quick-pick-btn:hover {
  background: #0000a0;
}

.quick-pick-btn:active:not(:disabled) {
  border: 2px solid #000000;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.quick-pick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.embed-player {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #000000;
  padding: 8px;
  min-height: 0; /* Allow flex to shrink properly at smaller sizes */
}

.embed-iframe {
  flex: 1;
  width: 100%;
  height: 0; /* Force iframe to use flex sizing */
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
  box-shadow: inset 1px 1px 0px 0px rgba(0,0,0,0.2);
}

.embed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: #000000;
  color: #ffffff;
  font-weight: bold;
  font-size: 11px;
  font-family: 'Tahoma', 'MS Sans Serif', sans-serif;
  margin-bottom: 8px;
  border: 1px solid #808080;
  flex-shrink: 0; /* Prevent header from shrinking */
}

.now-playing {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  width: 20px;
  height: 20px;
  background: #c0c0c0;
  color: #000;
  border: 1px solid #ffffff;
  border-right-color: #000000;
  border-bottom-color: #000000;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
}

.close-btn:active {
  border: 1px solid #000000;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.playlists-section {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  background: #000000;
}

.playlists-section h3 {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: #ffffff;
  font-family: 'Tahoma', 'MS Sans Serif', sans-serif;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 12px;
  color: #ffffff;
}

.empty-icon {
  font-size: 64px;
  opacity: 0.3;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #333333;
  border-top: 3px solid #1084d0;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  padding: 6px 16px;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  cursor: pointer;
  font-size: 11px;
}

.retry-btn:active {
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.playlist-card {
  background: #ffffff;
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
  padding: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: transform 0.1s;
}

.playlist-card:hover {
  transform: translateY(-2px);
  border-color: #000080;
}

.playlist-card:active {
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  transform: translateY(0);
}

.playlist-image {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #f0f0f0;
  border: 1px solid #808080;
}

.playlist-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-icon {
  font-size: 48px;
  color: #000080;
}

.playlist-name {
  font-size: 11px;
  text-align: center;
  font-weight: bold;
  line-height: 1.3;
  width: 100%;
  color: #000000;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Scrollbar styling */
.playlists-section::-webkit-scrollbar {
  width: 14px;
}

.playlists-section::-webkit-scrollbar-track {
  background: #1a1a1a;
  border-left: 1px solid #333333;
}

.playlists-section::-webkit-scrollbar-thumb {
  background: #333333;
  border: 1px solid #555555;
}

.playlists-section::-webkit-scrollbar-thumb:hover {
  background: #444444;
}

/* Optimize spacing for constrained heights based on actual component size */
.compact-height .spotify-embed-container .embed-player {
  padding: 4px; /* Reduce from 8px → saves 8px vertical space */
}

.compact-height .spotify-embed-container .embed-header {
  margin-bottom: 4px; /* Reduce from 8px → saves 4px */
  padding: 4px 8px; /* Reduce vertical padding → saves 4px */
}

.compact-height .spotify-embed-container .search-section {
  padding: 8px; /* Reduce from 12px → saves 8px vertical space */
}

.compact-height .spotify-embed-container .search-bar {
  margin-bottom: 8px; /* Reduce from 12px → saves 4px */
}

/* Login Prompt Modal */
.login-prompt-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.login-prompt-modal {
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.4);
  max-width: 400px;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.modal-header {
  background: linear-gradient(90deg, #000080, #1084d0);
  color: #ffffff;
  padding: 6px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  font-size: 11px;
}

.modal-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.modal-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  text-align: center;
}

.playlist-preview {
  width: 150px;
  height: 150px;
  border: 2px solid #808080;
  overflow: hidden;
}

.playlist-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.prompt-message {
  font-size: 13px;
  color: #000000;
  margin: 0;
  line-height: 1.5;
}

.prompt-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.connect-btn,
.preview-btn {
  padding: 10px 20px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  width: 100%;
}

.connect-btn {
  background: #000080;
  color: #ffffff;
}

.connect-btn:hover:not(:disabled) {
  background: #0000a0;
}

.connect-btn:active:not(:disabled) {
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.connect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.preview-btn {
  background: #c0c0c0;
  color: #000000;
}

.preview-btn:hover {
  background: #d0d0d0;
}

.preview-btn:active {
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.small-text {
  font-size: 10px;
  color: #808080;
  margin: 0;
  line-height: 1.4;
}
</style>

