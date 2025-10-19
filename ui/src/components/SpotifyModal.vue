<template>
  <div v-if="isVisible" class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-window" @click.stop>
      <!-- Title bar -->
      <div class="title-bar">
        <div class="title-bar-text">♫ Spotify Player</div>
        <div class="title-bar-controls">
          <button @click="$emit('close')" class="close-button">×</button>
        </div>
      </div>

      <!-- Modal content -->
      <div class="modal-content">
        <SpotifyEmbed />
      </div>
    </div>
  </div>
</template>

<script>
import SpotifyEmbed from './SpotifyEmbed.vue'

export default {
  name: 'SpotifyModal',
  components: {
    SpotifyEmbed
  },
  props: {
    isVisible: {
      type: Boolean,
      default: false
    },
    canvasId: {
      type: String,
      required: true
    }
  },
  emits: ['close'],
  methods: {
    handleOverlayClick() {
      this.$emit('close')
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
}

.modal-window {
  width: 90%;
  max-width: 800px;
  height: 80vh;
  background: #c0c0c0;
  border: 2px solid #fff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.5);
}

.title-bar {
  background: linear-gradient(90deg, #000080, #1084d0);
  color: #fff;
  padding: 4px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-bar-text {
  font-weight: bold;
  font-size: 12px;
}

.close-button {
  width: 20px;
  height: 20px;
  background: #c0c0c0;
  border: 1px solid #fff;
  border-right-color: #000;
  border-bottom-color: #000;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  color: #000;
}

.close-button:active {
  border: 1px solid #000;
  border-right-color: #fff;
  border-bottom-color: #fff;
}

.modal-content {
  flex: 1;
  overflow: hidden;
  background: #c0c0c0;
}
</style>

