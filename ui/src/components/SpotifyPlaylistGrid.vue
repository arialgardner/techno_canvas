<template>
  <div class="playlist-grid-container">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading playlists...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state">
      <p>❌ {{ error }}</p>
      <button @click="$emit('retry')" class="retry-button">Retry</button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!playlists || playlists.length === 0" class="empty-state">
      <p>No playlists found</p>
      <p class="empty-hint">Create playlists in Spotify and they'll appear here</p>
    </div>

    <!-- Playlist grid -->
    <div v-else class="playlist-grid">
      <SpotifyPlaylistCard 
        v-for="playlist in playlists" 
        :key="playlist.id" 
        :playlist="playlist"
      />
    </div>
  </div>
</template>

<script>
import SpotifyPlaylistCard from './SpotifyPlaylistCard.vue'

export default {
  name: 'SpotifyPlaylistGrid',
  components: {
    SpotifyPlaylistCard
  },
  props: {
    playlists: {
      type: Array,
      default: () => []
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: null
    }
  },
  emits: ['retry']
}
</script>

<style scoped>
.playlist-grid-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 12px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
  color: #000;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #c0c0c0;
  border-top: 3px solid #000080;
  border-radius: 0;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-hint {
  font-size: 11px;
  color: #808080;
  margin-top: 4px;
}

.retry-button {
  padding: 6px 16px;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  cursor: pointer;
  font-size: 11px;
}

.retry-button:active {
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding-bottom: 20px;
}

/* Scrollbar styling */
.playlist-grid-container::-webkit-scrollbar {
  width: 16px;
}

.playlist-grid-container::-webkit-scrollbar-track {
  background: #c0c0c0;
  border: 2px solid #808080;
}

.playlist-grid-container::-webkit-scrollbar-thumb {
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
}
</style>

