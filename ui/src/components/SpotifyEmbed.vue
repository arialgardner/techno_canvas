<template>
  <div class="spotify-embed-container">
    <!-- Search/Browse Section -->
    <div class="search-section">
      <div class="search-bar">
        <input 
          v-model="searchQuery" 
          @keyup.enter="handleSearch"
          placeholder="Enter music genre (e.g. techno, industrial techno, happy house music)"
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

    <!-- Currently Playing Embed -->
    <div v-if="currentEmbed" class="embed-player">
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

      <!-- Playlists Grid -->
      <div v-else class="playlist-grid">
        <div 
          v-for="playlist in popularPlaylists" 
          :key="playlist.uri"
          @click="playEmbed(playlist.uri, playlist.name)"
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
import { ref, onMounted, watch } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'
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
    // LocalStorage keys
    const STORAGE_KEY_SEARCH = 'spotify-last-search'
    const STORAGE_KEY_SUGGESTIONS = 'spotify-genre-suggestions'
    const STORAGE_KEY_PLAYLISTS = 'spotify-playlists'
    const STORAGE_KEY_CURRENT_EMBED = 'spotify-current-embed'
    const STORAGE_KEY_CURRENT_NAME = 'spotify-current-name'

    // Load saved state from localStorage
    const savedSearch = localStorage.getItem(STORAGE_KEY_SEARCH)
    const savedSuggestions = localStorage.getItem(STORAGE_KEY_SUGGESTIONS)
    const savedPlaylists = localStorage.getItem(STORAGE_KEY_PLAYLISTS)
    const savedEmbed = localStorage.getItem(STORAGE_KEY_CURRENT_EMBED)
    const savedName = localStorage.getItem(STORAGE_KEY_CURRENT_NAME)

    const searchQuery = ref(savedSearch || '')
    const currentEmbed = ref(savedEmbed || null)
    const currentEmbedName = ref(savedName || '')
    const isLoadingPlaylists = ref(false)
    const playlistError = ref(null)
    const openai = ref(null)

    // Restore playlists from localStorage
    const popularPlaylists = ref(
      savedPlaylists ? JSON.parse(savedPlaylists) : []
    )

    // Quick picks for instant playback - Restore from localStorage or use defaults
    const quickPicks = ref(
      savedSuggestions ? JSON.parse(savedSuggestions) : [
        { name: 'Techno', query: 'techno' },
        { name: 'Industrial Techno', query: 'industrial techno' },
        { name: 'Minimal Techno', query: 'minimal techno' },
        { name: 'Acid Techno', query: 'acid techno' },
      ]
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
        { name: 'Techno', query: 'techno' },
        { name: 'House', query: 'house music' },
        { name: 'Trance', query: 'trance music' },
        { name: 'Electronic', query: 'electronic music' },
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

    // Handle quick pick clicks - search for that genre and update suggestions
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

    // Load playlists when component mounts (only if no saved data)
    onMounted(() => {
      if (!savedPlaylists) {
        loadDefaultPlaylists()
      }
    })

    // Watch for state changes and persist to localStorage
    watch(searchQuery, (newValue) => {
      if (newValue) {
        localStorage.setItem(STORAGE_KEY_SEARCH, newValue)
      } else {
        localStorage.removeItem(STORAGE_KEY_SEARCH)
      }
    })

    watch(quickPicks, (newValue) => {
      localStorage.setItem(STORAGE_KEY_SUGGESTIONS, JSON.stringify(newValue))
    }, { deep: true })

    watch(popularPlaylists, (newValue) => {
      localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(newValue))
    }, { deep: true })

    const playEmbed = (uri, name) => {
      // Convert Spotify URI to embed URL
      const [type, id] = uri.split(':')
      currentEmbed.value = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`
      currentEmbedName.value = name
      
      // Save to localStorage
      localStorage.setItem(STORAGE_KEY_CURRENT_EMBED, currentEmbed.value)
      localStorage.setItem(STORAGE_KEY_CURRENT_NAME, currentEmbedName.value)
    }

    const closeEmbed = () => {
      currentEmbed.value = null
      currentEmbedName.value = ''
      
      // Clear from localStorage
      localStorage.removeItem(STORAGE_KEY_CURRENT_EMBED)
      localStorage.removeItem(STORAGE_KEY_CURRENT_NAME)
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

    return {
      searchQuery,
      currentEmbed,
      currentEmbedName,
      quickPicks,
      popularPlaylists,
      isLoadingPlaylists,
      playlistError,
      playEmbed,
      closeEmbed,
      handleSearch,
      handleQuickPick,
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
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 12px;
  color: #ffffff;
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
</style>

