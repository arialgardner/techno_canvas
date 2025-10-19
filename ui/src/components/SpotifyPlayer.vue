<template>
  <div class="spotify-player">
    <!-- Not ready / Error state -->
    <div v-if="!isReady || error" class="player-status">
      <div v-if="error" class="error-message">
        <p>{{ error }}</p>
        <button v-if="!isPremium" @click="openPremiumLink" class="premium-button">
          Get Spotify Premium
        </button>
      </div>
      <div v-else class="loading">
        <div class="spinner"></div>
        <p>Initializing player...</p>
      </div>
    </div>

    <!-- Player ready -->
    <div v-else class="player-content">
      <!-- Current track display -->
      <div v-if="currentTrack" class="current-track">
        <div class="album-art">
          <img v-if="currentTrack.albumArt" :src="currentTrack.albumArt" :alt="currentTrack.album" />
          <div v-else class="placeholder-art">♫</div>
        </div>
        <div class="track-info">
          <div class="track-name">{{ currentTrack.name }}</div>
          <div class="track-artist">{{ currentTrack.artists }}</div>
          <div class="track-album">{{ currentTrack.album }}</div>
        </div>
      </div>

      <div v-else class="no-track">
        <p>No track playing</p>
        <p class="hint">Select a playlist to start listening</p>
      </div>

      <!-- Playback controls -->
      <div class="controls">
        <button @click="previous" class="control-button" title="Previous">
          ⏮
        </button>
        <button @click="togglePlayPause" class="control-button play-button" title="Play/Pause">
          {{ isPlaying ? '⏸' : '▶' }}
        </button>
        <button @click="next" class="control-button" title="Next">
          ⏭
        </button>
      </div>

      <!-- Progress bar -->
      <div v-if="currentTrack" class="progress-container">
        <span class="time">{{ formatTime(position) }}</span>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <span class="time">{{ formatTime(duration) }}</span>
      </div>

      <!-- Volume control -->
      <div class="volume-container">
        <span class="volume-icon">🔊</span>
        <input 
          type="range" 
          min="0" 
          max="100" 
          :value="volume * 100" 
          @input="handleVolumeChange"
          class="volume-slider"
        />
        <span class="volume-label">{{ Math.round(volume * 100) }}%</span>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useSpotifyPlayer } from '../composables/useSpotifyPlayer'

export default {
  name: 'SpotifyPlayer',
  setup() {
    const {
      isReady,
      isPlaying,
      currentTrack,
      position,
      duration,
      volume,
      error,
      isPremium,
      togglePlayPause,
      next,
      previous,
      setVolume,
    } = useSpotifyPlayer()

    const progressPercent = computed(() => {
      if (!duration.value) return 0
      return (position.value / duration.value) * 100
    })

    const formatTime = (ms) => {
      const seconds = Math.floor(ms / 1000)
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const handleVolumeChange = (event) => {
      const value = event.target.value / 100
      setVolume(value)
    }

    const openPremiumLink = () => {
      window.open('https://www.spotify.com/premium/', '_blank')
    }

    return {
      isReady,
      isPlaying,
      currentTrack,
      position,
      duration,
      volume,
      error,
      isPremium,
      progressPercent,
      togglePlayPause,
      next,
      previous,
      formatTime,
      handleVolumeChange,
      openPremiumLink,
    }
  }
}
</script>

<style scoped>
.spotify-player {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #c0c0c0;
}

.player-status {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.error-message {
  text-align: center;
  color: #c00;
}

.premium-button {
  margin-top: 12px;
  padding: 8px 16px;
  background: #1db954;
  color: #fff;
  border: 2px solid #fff;
  border-right-color: #000;
  border-bottom-color: #000;
  cursor: pointer;
  font-weight: bold;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #c0c0c0;
  border-top: 3px solid #000080;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.player-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.current-track {
  display: flex;
  gap: 16px;
  padding: 12px;
  background: #fff;
  border: 2px solid #808080;
  border-right-color: #fff;
  border-bottom-color: #fff;
}

.album-art {
  width: 120px;
  height: 120px;
  flex-shrink: 0;
  border: 1px solid #000;
  background: #000;
}

.album-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-art {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: #808080;
}

.track-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.track-name {
  font-size: 16px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-artist {
  font-size: 14px;
  color: #000;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-album {
  font-size: 12px;
  color: #808080;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-track {
  text-align: center;
  padding: 32px;
  color: #808080;
}

.hint {
  font-size: 11px;
  margin-top: 8px;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.control-button {
  width: 48px;
  height: 48px;
  background: #c0c0c0;
  border: 2px solid #fff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-button:active {
  border: 2px solid #808080;
  border-right-color: #fff;
  border-bottom-color: #fff;
}

.play-button {
  width: 64px;
  height: 64px;
  font-size: 24px;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time {
  font-size: 11px;
  color: #000;
  min-width: 40px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #fff;
  border: 1px solid #808080;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: #000080;
  transition: width 0.1s;
}

.volume-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid #808080;
}

.volume-icon {
  font-size: 16px;
}

.volume-slider {
  flex: 1;
  height: 4px;
}

.volume-label {
  font-size: 11px;
  min-width: 40px;
  text-align: right;
}
</style>

