<template>
  <div 
    class="spotify-overlay" 
    :class="{ collapsed: isCollapsed }"
    :style="overlayStyle"
  >
    <!-- Collapsed State - Just Icon -->
    <button 
      v-if="isCollapsed" 
      @click="handleExpandClick" 
      @mousedown="startDrag"
      class="expand-btn" 
      title="Open Music Player (drag to move)"
    >
      ♫
    </button>

    <!-- Expanded State - Full Player -->
    <div v-else class="player-window">
      <!-- Title Bar (Draggable) -->
      <div 
        class="title-bar"
        @mousedown="startDrag"
      >
        <span class="title-text">♫ Music Player</span>
        <button 
          @click="isCollapsed = true" 
          @mousedown.stop
          class="close-btn" 
          title="Minimize"
        >
          _
        </button>
      </div>

      <!-- Player Content -->
      <div class="player-content">
        <SpotifyEmbed />
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import SpotifyEmbed from './SpotifyEmbed.vue'

export default {
  name: 'SpotifySidebar',
  components: {
    SpotifyEmbed
  },
  setup() {
    // Get canvasId from route to make storage per-canvas
    const route = useRoute()
    const canvasId = computed(() => route.params.canvasId || 'default')
    
    // Use canvas-specific storage keys
    const STORAGE_KEY_COLLAPSED = computed(() => `spotify-panel-collapsed-${canvasId.value}`)
    const STORAGE_KEY_POSITION = computed(() => `spotify-panel-position-${canvasId.value}`)
    
    // Load saved state from localStorage, default to false if not found
    const savedCollapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED.value)
    const isCollapsed = ref(savedCollapsed !== null ? savedCollapsed === 'true' : false)
    
    // Load saved position from localStorage, default to top left if not found
    const savedPosition = localStorage.getItem(STORAGE_KEY_POSITION.value)
    const position = ref(savedPosition ? JSON.parse(savedPosition) : { x: 20, y: 160 })
    
    const isDragging = ref(false)
    const dragOffset = ref({ x: 0, y: 0 })
    const hasMoved = ref(false)
    const startPosition = ref({ x: 0, y: 0 })

    // Computed style for positioning
    const overlayStyle = computed(() => ({
      left: `${position.value.x}px`,
      top: `${position.value.y}px`,
    }))

    // Start dragging
    const startDrag = (event) => {
      isDragging.value = true
      hasMoved.value = false
      startPosition.value = { x: event.clientX, y: event.clientY }
      
      // Calculate offset from mouse to element top-left
      const rect = event.currentTarget.getBoundingClientRect()
      dragOffset.value = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }

      // Prevent text selection while dragging
      event.preventDefault()
    }

    // Handle mouse move
    const onMouseMove = (event) => {
      if (!isDragging.value) return

      // Check if mouse has moved more than a few pixels (drag threshold)
      const deltaX = Math.abs(event.clientX - startPosition.value.x)
      const deltaY = Math.abs(event.clientY - startPosition.value.y)
      if (deltaX > 3 || deltaY > 3) {
        hasMoved.value = true
      }

      // Calculate new position
      let newX = event.clientX - dragOffset.value.x
      let newY = event.clientY - dragOffset.value.y

      // Get viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Get element dimensions
      const elementWidth = isCollapsed.value ? 48 : 380
      const elementHeight = isCollapsed.value ? 48 : 600

      // Constrain to viewport bounds
      newX = Math.max(0, Math.min(newX, viewportWidth - elementWidth))
      newY = Math.max(70, Math.min(newY, viewportHeight - elementHeight)) // Min 70px for navbar

      position.value = { x: newX, y: newY }
    }

    // Stop dragging
    const onMouseUp = () => {
      isDragging.value = false
    }

    // Handle expand click (only if not dragged)
    const handleExpandClick = (event) => {
      if (hasMoved.value) {
        // Was dragged, don't expand
        event.preventDefault()
        return
      }
      // Was clicked without dragging, expand
      isCollapsed.value = false
    }

    // Add/remove event listeners
    onMounted(() => {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    })

    onUnmounted(() => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    })

    // Watch for changes to collapsed state and save to localStorage (canvas-specific)
    watch(isCollapsed, (newValue) => {
      localStorage.setItem(STORAGE_KEY_COLLAPSED.value, String(newValue))
    })

    // Watch for changes to position and save to localStorage (canvas-specific)
    watch(position, (newValue) => {
      localStorage.setItem(STORAGE_KEY_POSITION.value, JSON.stringify(newValue))
    }, { deep: true })
    
    // Watch for canvas changes and reload settings for the new canvas
    watch(canvasId, (newCanvasId) => {
      const newCollapsedKey = `spotify-panel-collapsed-${newCanvasId}`
      const newPositionKey = `spotify-panel-position-${newCanvasId}`
      
      const savedCollapsed = localStorage.getItem(newCollapsedKey)
      isCollapsed.value = savedCollapsed !== null ? savedCollapsed === 'true' : false
      
      const savedPosition = localStorage.getItem(newPositionKey)
      position.value = savedPosition ? JSON.parse(savedPosition) : { x: 20, y: 160 }
    })

    return {
      isCollapsed,
      overlayStyle,
      startDrag,
      handleExpandClick,
    }
  }
}
</script>

<style scoped>
.spotify-overlay {
  position: fixed;
  /* Position controlled by inline style (draggable) */
  z-index: 101; /* Above canvas, same level as zoom controls */
  user-select: none; /* Prevent text selection while dragging */
}

/* Collapsed State - Small Icon Button */
.expand-btn {
  width: 48px;
  height: 48px;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  cursor: move; /* Draggable */
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s;
  user-select: none;
}

.expand-btn:hover {
  transform: scale(1.05);
}

.expand-btn:active {
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
  transform: scale(0.98);
}

/* Expanded State - Full Window */
.player-window {
  width: 380px;
  height: 600px;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.4);
}

.title-bar {
  background: linear-gradient(90deg, #000080, #1084d0);
  color: #ffffff;
  padding: 4px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move; /* Draggable */
  user-select: none; /* Prevent text selection */
}

.title-text {
  font-weight: bold;
  font-size: 12px;
}

.close-btn {
  width: 18px;
  height: 18px;
  background: #c0c0c0;
  color: #000;
  border: 1px solid #ffffff;
  border-right-color: #000000;
  border-bottom-color: #000000;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:active {
  border: 1px solid #000000;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.player-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Allow flex children to shrink */
}

/* Responsive - smaller on tablets */
@media (max-width: 1024px) {
  .player-window {
    width: 320px;
    height: 500px;
  }
}

/* Responsive - hide on mobile */
@media (max-width: 768px) {
  .spotify-overlay {
    display: none;
  }
}
</style>

