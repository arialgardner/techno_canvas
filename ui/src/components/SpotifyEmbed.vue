<template>
  <div class="spotify-embed-container">
    <!-- Search/Browse Section -->
    <div class="search-section">
      <div class="search-bar">
        <input 
          v-model="searchQuery" 
          @keyup.enter="handleSearch"
          placeholder="Search for songs, artists, playlists..."
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
import { ref, onMounted } from 'vue'
import { getFunctions, httpsCallable } from 'firebase/functions'

const functions = getFunctions()

export default {
  name: 'SpotifyEmbed',
  setup() {
    const searchQuery = ref('')
    const currentEmbed = ref(null)
    const currentEmbedName = ref('')
    const popularPlaylists = ref([])
    const isLoadingPlaylists = ref(false)
    const playlistError = ref(null)

    // Quick picks for instant playback - Techno focused
    const quickPicks = [
      { name: 'Schranz', query: 'schranz techno' },
      { name: 'Dub / Minimal', query: 'dub minimal techno' },
      { name: 'Industrial Techno', query: 'industrial techno' },
      { name: 'Acid', query: 'acid techno' },
    ]

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

    // Handle quick pick clicks - search for that genre
    const handleQuickPick = async (pick) => {
      // Close current player if open
      currentEmbed.value = null
      currentEmbedName.value = ''
      
      isLoadingPlaylists.value = true
      playlistError.value = null

      try {
        const playlists = await searchSpotify(pick.query, 12)
        popularPlaylists.value = playlists
      } catch (error) {
        console.error('Failed to search genre:', error)
        playlistError.value = `Failed to load ${pick.name} playlists`
      } finally {
        isLoadingPlaylists.value = false
      }
    }

    // Load playlists when component mounts
    onMounted(() => {
      loadDefaultPlaylists()
    })

    const playEmbed = (uri, name) => {
      // Convert Spotify URI to embed URL
      const [type, id] = uri.split(':')
      currentEmbed.value = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`
      currentEmbedName.value = name
    }

    const closeEmbed = () => {
      currentEmbed.value = null
      currentEmbedName.value = ''
    }

    const handleSearch = async () => {
      if (!searchQuery.value.trim()) return
      
      // Close current player if open
      currentEmbed.value = null
      currentEmbedName.value = ''
      
      isLoadingPlaylists.value = true
      playlistError.value = null

      try {
        const playlists = await searchSpotify(searchQuery.value, 12)
        popularPlaylists.value = playlists
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
}

.search-section {
  padding: 12px;
  border-bottom: 2px solid #808080;
  background: #000000;
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
}

.embed-iframe {
  flex: 1;
  width: 100%;
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
</style>

