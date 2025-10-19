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

    <!-- Loading Playback State -->
    <div v-if="isLoadingPlayback" class="loading-playback">
      <div class="loading-window">
        <div class="loading-title-bar">
          <span class="loading-title">♫ Loading...</span>
        </div>
        <div class="loading-content">
          <div class="hourglass-container">
            <div class="hourglass">⌛</div>
          </div>
          <p class="loading-text">{{ currentEmbedName }}</p>
          <div class="progress-bar-container">
            <div class="progress-bar-win95">
              <div class="progress-bar-fill"></div>
            </div>
          </div>
          <p class="loading-hint">Please wait...</p>
        </div>
      </div>
    </div>

    <!-- Currently Playing Embed -->
    <div v-else-if="currentEmbed" class="embed-player">
      <div class="embed-header">
        <span 
          class="now-playing" 
          @contextmenu="handleEmbedTitleRightClick"
          :title="currentEmbedName"
        >
          ♫ {{ currentEmbedName }}
        </span>
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
      <h3 v-if="!isLoadingPlaylists">Playlists</h3>
      
      <!-- Loading State - Windows 95 Style -->
      <div v-if="isLoadingPlaylists" class="playlists-loading">
        <div class="loading-window-playlists">
          <div class="loading-title-bar">
            <span class="loading-title">♫ Loading Playlists...</span>
          </div>
          <div class="loading-content-playlists">
            <div class="hourglass-container">
              <div class="hourglass">⌛</div>
            </div>
            <p class="loading-text">Searching for music...</p>
            <div class="progress-bar-container">
              <div class="progress-bar-win95">
                <div class="progress-bar-fill"></div>
              </div>
            </div>
            <p class="loading-hint">Please wait...</p>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="playlistError" class="error-state">
        <p>{{ playlistError }}</p>
        <button @click="loadDefaultPlaylists" class="retry-btn">Retry</button>
      </div>

      <!-- Empty State -->
      <div v-else-if="popularPlaylists.length === 0" class="empty-state">
        <div class="empty-icon">♫</div>
        <p class="empty-message">Click a genre button above to discover playlists</p>
      </div>

      <!-- Playlists Grid -->
      <div v-else class="playlist-grid">
        <div 
          v-for="playlist in popularPlaylists" 
          :key="playlist.uri"
          @click="handlePlaylistClick(playlist)"
          @contextmenu="(e) => handlePlaylistRightClick(e, playlist)"
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

    <!-- Context Menu for Playlists -->
    <div 
      v-if="contextMenu.visible"
      class="playlist-context-menu"
      :style="{
        top: `${contextMenu.y}px`,
        left: `${contextMenu.x}px`
      }"
      @click.stop="handleCopyLink"
    >
      <div class="menu-item">
        <span class="menu-icon">🔗</span>
        <span class="menu-label">Copy Link</span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed, inject, onMounted, onUnmounted } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useRoute } from 'vue-router'
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
    
    // Inject expand function from SpotifySidebar
    const expandSpotifyPlayer = inject('expandSpotifyPlayer', null)
    
    // Context menu state
    const contextMenu = ref({
      visible: false,
      x: 0,
      y: 0,
      playlist: null
    })
    
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
    
    // Loading state for playlist/track
    const isLoadingPlayback = ref(false)

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
      
      isLoadingPlaylists.value = false
      playlistError.value = null
    })

    const handlePlaylistClick = (playlist) => {
      // Play embed preview directly
      playEmbed(playlist.uri, playlist.name)
    }

    const playEmbed = (uri, name) => {
      // Convert Spotify URI to embed URL
      // Supports both formats:
      // - spotify:type:id (e.g., spotify:playlist:37i9dQZF1DXcBWIGoYBM5M) - from chat links
      // - type:id (e.g., playlist:37i9dQZF1DXcBWIGoYBM5M) - from playlist browser
      
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
      
      // Show loading state
      isLoadingPlayback.value = true
      
      currentEmbed.value = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`
      currentEmbedName.value = name
      
      // Save to localStorage for this canvas
      localStorage.setItem(STORAGE_KEY_CURRENT_EMBED.value, currentEmbed.value)
      localStorage.setItem(STORAGE_KEY_CURRENT_NAME.value, currentEmbedName.value)
      
      // Hide loading after a short delay (iframe load simulation)
      setTimeout(() => {
        isLoadingPlayback.value = false
      }, 1500)
    }

    const closeEmbed = () => {
      currentEmbed.value = null
      currentEmbedName.value = ''
      isLoadingPlayback.value = false
      
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
        
        // Show loading immediately with generic name
        const genericName = `${type.charAt(0).toUpperCase() + type.slice(1)}`
        currentEmbedName.value = genericName
        isLoadingPlayback.value = true
        
        // Expand the Spotify player first (so loading screen is visible)
        if (expandSpotifyPlayer) {
          expandSpotifyPlayer()
        }
        
        // Convert to Spotify URI format
        const uri = `spotify:${type}:${id}`
        
        // Fetch the actual name from Spotify's oEmbed API (public, no auth required)
        let name = genericName
        try {
          const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/${type}/${id}`
          const response = await fetch(oembedUrl)
          if (response.ok) {
            const data = await response.json()
            name = data.title || name
            // Update the name while loading
            currentEmbedName.value = name
          }
        } catch (error) {
          console.warn('[SpotifyEmbed] Could not fetch name from oEmbed:', error)
          // Fall back to generic name
          name = `${type.charAt(0).toUpperCase() + type.slice(1)} (${id.substring(0, 8)}...)`
          currentEmbedName.value = name
        }
        
        // Play the embed
        playEmbed(uri, name)
        
        return true
      } catch (error) {
        console.error('Error loading playlist from URL:', error)
        isLoadingPlayback.value = false
        return false
      }
    }
    
    // Note: loadPlaylistFromUrl is exposed in return statement below
    // and re-provided by SpotifySidebar for sibling components (ChatLog)
    
    // Handle right-click on playlist
    const handlePlaylistRightClick = (event, playlist) => {
      event.preventDefault()
      event.stopPropagation()
      
      // Set context menu position and playlist
      contextMenu.value = {
        visible: true,
        x: event.clientX,
        y: event.clientY,
        playlist
      }
    }
    
    // Handle right-click on embed title (currently playing)
    const handleEmbedTitleRightClick = (event) => {
      event.preventDefault()
      event.stopPropagation()
      
      if (!currentEmbed.value) return
      
      // Extract type and id from embed URL
      // Format: https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator&theme=0
      const embedUrl = currentEmbed.value
      const match = embedUrl.match(/\/embed\/([^/]+)\/([^?]+)/)
      
      if (match) {
        const type = match[1]
        const id = match[2]
        
        // Create a fake playlist object for the context menu
        contextMenu.value = {
          visible: true,
          x: event.clientX,
          y: event.clientY,
          playlist: {
            uri: `${type}:${id}`,
            name: currentEmbedName.value
          }
        }
      }
    }
    
    // Handle copy link
    const handleCopyLink = async () => {
      if (!contextMenu.value.playlist) return
      
      const playlist = contextMenu.value.playlist
      
      // Convert URI to Spotify URL
      // playlist.uri format: "playlist:id" or "spotify:playlist:id"
      const parts = playlist.uri.split(':')
      let type, id
      
      if (parts.length === 3) {
        // Format: spotify:type:id
        type = parts[1]
        id = parts[2]
      } else if (parts.length === 2) {
        // Format: type:id
        type = parts[0]
        id = parts[1]
      }
      
      const url = `https://open.spotify.com/${type}/${id}`
      
      try {
        await navigator.clipboard.writeText(url)
        console.log('Playlist link copied:', url)
      } catch (err) {
        console.error('Failed to copy link:', err)
      }
      
      // Close context menu
      contextMenu.value.visible = false
    }
    
    // Close context menu when clicking elsewhere
    const handleGlobalClick = () => {
      if (contextMenu.value.visible) {
        contextMenu.value.visible = false
      }
    }
    
    // Add/remove global click listener
    onMounted(() => {
      document.addEventListener('click', handleGlobalClick)
    })
    
    onUnmounted(() => {
      document.removeEventListener('click', handleGlobalClick)
    })

    return {
      searchQuery,
      currentEmbed,
      currentEmbedName,
      quickPicks,
      popularPlaylists,
      isLoadingPlaylists,
      playlistError,
      isLoadingPlayback,
      handlePlaylistClick,
      playEmbed,
      closeEmbed,
      handleSearch,
      handleQuickPick,
      loadDefaultPlaylists,
      loadPlaylistFromUrl,
      contextMenu,
      handlePlaylistRightClick,
      handleEmbedTitleRightClick,
      handleCopyLink,
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
  cursor: context-menu;
  user-select: none;
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

.empty-message {
  text-align: center;
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

/* Loading Playback State - Windows 95 Style */
.loading-playback {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000000;
  padding: 40px;
}

.loading-window {
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.4);
  min-width: 320px;
  max-width: 400px;
}

.loading-title-bar {
  background: linear-gradient(90deg, #000080, #1084d0);
  color: #ffffff;
  padding: 4px 8px;
  font-weight: bold;
  font-size: 11px;
  display: flex;
  align-items: center;
  user-select: none;
}

.loading-title {
  flex: 1;
}

.loading-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.hourglass-container {
  width: 64px;
  height: 64px;
  background: #ffffff;
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 1px 1px 0px 0px rgba(0,0,0,0.1);
}

.hourglass {
  font-size: 32px;
  animation: rotate-hourglass 2s ease-in-out infinite;
}

@keyframes rotate-hourglass {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(180deg); }
}

.loading-text {
  color: #000000;
  font-size: 12px;
  font-weight: bold;
  margin: 0;
  font-family: 'Tahoma', 'MS Sans Serif', sans-serif;
  word-break: break-word;
  max-width: 100%;
}

.progress-bar-container {
  width: 100%;
  padding: 0 8px;
}

.progress-bar-win95 {
  height: 20px;
  background: #ffffff;
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
  box-shadow: inset 1px 1px 0px 0px rgba(0,0,0,0.2);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    #000080,
    #000080 10px,
    #0000a0 10px,
    #0000a0 20px
  );
  animation: progress-slide 1s linear infinite;
  width: 100%;
}

@keyframes progress-slide {
  0% { transform: translateX(-20px); }
  100% { transform: translateX(0); }
}

.loading-hint {
  color: #000000;
  font-size: 11px;
  margin: 0;
  font-family: 'Tahoma', 'MS Sans Serif', sans-serif;
}

/* Loading Playlists State - Windows 95 Style */
.playlists-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.loading-window-playlists {
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.4);
  min-width: 280px;
  max-width: 350px;
  width: 100%;
}

.loading-content-playlists {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
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

/* Playlist Context Menu */
.playlist-context-menu {
  position: fixed;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.4);
  min-width: 160px;
  padding: 2px;
  z-index: 10001; /* Above everything else */
  font-family: 'Tahoma', 'MS Sans Serif', sans-serif;
  font-size: 11px;
  user-select: none;
}

.playlist-context-menu .menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: pointer;
  color: #000000;
}

.playlist-context-menu .menu-item:hover {
  background: #000080;
  color: #ffffff;
}

.playlist-context-menu .menu-icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.playlist-context-menu .menu-label {
  flex: 1;
  font-weight: normal;
}
</style>

