<template>
  <div v-if="isConnected" class="mini-player" :class="{ 'has-track': currentTrack }">
    <!-- Album Art -->
    <div class="album-art">
      <img v-if="currentTrack?.albumArt" :src="currentTrack.albumArt" :alt="currentTrack.album" />
      <div v-else class="placeholder">♫</div>
    </div>

    <!-- Track Info -->
    <div class="track-info">
      <div v-if="currentTrack" class="track-details">
        <div class="track-name">{{ currentTrack.name }}</div>
        <div class="track-artist">{{ currentTrack.artists }}</div>
      </div>
      <div v-else class="no-track">
        <span>Not playing</span>
      </div>
    </div>

    <!-- Playback Controls -->
    <div class="controls">
      <button 
        @click="previous" 
        class="control-btn"
        :disabled="!isReady || !currentTrack"
        title="Previous"
      >
        ⏮
      </button>
      <button 
        @click="togglePlayPause" 
        class="control-btn play-btn"
        :disabled="!isReady"
        title="Play/Pause"
      >
        {{ isPlaying ? '⏸' : '▶' }}
      </button>
      <button 
        @click="next" 
        class="control-btn"
        :disabled="!isReady || !currentTrack"
        title="Next"
      >
        ⏭
      </button>
    </div>

    <!-- Progress Bar -->
    <div v-if="currentTrack" class="progress-section">
      <span class="time">{{ formatTime(position) }}</span>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <span class="time">{{ formatTime(duration) }}</span>
    </div>

    <!-- Volume Control -->
    <div class="volume-section">
      <span class="volume-icon">🔊</span>
      <input 
        type="range" 
        min="0" 
        max="100" 
        :value="volume * 100" 
        @input="handleVolumeChange"
        class="volume-slider"
        title="Volume"
      />
    </div>

    <!-- Open Modal Button -->
    <button @click="$emit('open-modal')" class="open-modal-btn" title="Open Spotify">
      <span>♫</span>
    </button>
  </div>
</template>

<script>
import { computed, watch, onMounted } from 'vue'
import { useSpotifyAuth } from '../composables/useSpotifyAuth'
import { useSpotifyPlayer } from '../composables/useSpotifyPlayer'

export default {
  name: 'SpotifyMiniPlayer',
  emits: ['open-modal'],
  setup() {
    const { isConnected, startListening } = useSpotifyAuth()
    const {
      isReady,
      isPlaying,
      currentTrack,
      position,
      duration,
      volume,
      initializePlayer,
      togglePlayPause,
      next,
      previous,
      setVolume,
    } = useSpotifyPlayer()

    // Start listening to auth state
    onMounted(() => {
      startListening()
    })

    // Auto-initialize player when connected
    watch(isConnected, async (connected) => {
      if (connected && !isReady.value) {
        try {
          await initializePlayer()
        } catch (err) {
          console.error('Failed to initialize Spotify player:', err)
        }
      }
    }, { immediate: true })

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

    return {
      isConnected,
      isReady,
      isPlaying,
      currentTrack,
      position,
      duration,
      volume,
      progressPercent,
      togglePlayPause,
      next,
      previous,
      formatTime,
      handleVolumeChange,
    }
  }
}
</script>

<style scoped>
.mini-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 300px; /* Account for properties panel */
  height: 80px;
  background: #c0c0c0;
  border-top: 2px solid #ffffff;
  border-left: 2px solid #ffffff;
  border-right: 2px solid #808080;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  z-index: 99; /* Above canvas, below toolbar */
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.2);
}

.album-art {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border: 2px solid #808080;
  background: #000;
  overflow: hidden;
}

.album-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #808080;
}

.track-info {
  flex: 1;
  min-width: 0; /* Allow text truncation */
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.track-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.track-name {
  font-size: 13px;
  font-weight: bold;
  color: #000;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-artist {
  font-size: 11px;
  color: #000;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-track {
  font-size: 11px;
  color: #808080;
}

.controls {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.control-btn {
  width: 32px;
  height: 32px;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.control-btn:active:not(:disabled) {
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.play-btn {
  width: 40px;
  height: 40px;
  font-size: 16px;
  background: #000080;
  color: #ffffff;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 300px;
}

.time {
  font-size: 10px;
  color: #000;
  min-width: 35px;
  text-align: center;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #ffffff;
  border: 1px solid #808080;
  position: relative;
  cursor: pointer;
}

.progress-fill {
  height: 100%;
  background: #000080;
  transition: width 0.1s linear;
}

.volume-section {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.volume-icon {
  font-size: 14px;
}

.volume-slider {
  width: 80px;
  height: 4px;
  cursor: pointer;
}

.open-modal-btn {
  width: 40px;
  height: 40px;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.open-modal-btn:hover {
  background: #d0d0d0;
}

.open-modal-btn:active {
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .mini-player {
    right: 250px;
  }
  
  .progress-section {
    max-width: 200px;
  }
}

@media (max-width: 768px) {
  .mini-player {
    right: 0;
  }
  
  .volume-section {
    display: none;
  }
  
  .progress-section {
    display: none;
  }
}
</style>

