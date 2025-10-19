<template>
  <!-- Floating Toggle Button -->
  <button 
    v-if="!isOpen"
    class="chat-toggle-button"
    :style="modalStyle"
    @mousedown="startDrag"
    @click="handleExpandClick"
    title="Open Chat (drag to move)"
  >
    💬
  </button>

  <!-- Chat Modal -->
  <div
    v-if="isOpen"
    ref="modalRef"
    class="chat-modal window theme-win98"
    :class="{ 'minimized': isMinimized }"
    :style="modalStyle"
    @mousedown.stop="bringToFront"
  >
    <div class="inner">
      <!-- Title Bar -->
      <div 
        class="header"
        @mousedown="startDrag"
      >
        <span class="title">💬 Room Chat</span>
        <div class="header-controls">
          <button class="minimize-btn" @click="toggleMinimize" title="Minimize">_</button>
        </div>
      </div>
      
      <!-- Content (hidden when minimized) -->
      <div v-show="!isMinimized" class="content chat-content">
        <!-- Messages List -->
        <div class="messages-container" ref="messagesRef">
          <div v-if="isLoading" class="loading-state">
            <div class="loading-spinner">
              <div class="spinner-box"></div>
            </div>
            <div class="loading-text">Loading chat...</div>
          </div>
          
          <div v-else-if="messages.length === 0" class="empty-state">
            No messages yet. Start the conversation!
          </div>
          
          <div v-else class="messages-list">
            <div
              v-for="message in messages"
              :key="message.id"
              class="message-entry"
              :class="{ 'own-message': message.userId === user?.uid }"
            >
              <div class="message-header">
                <span class="username">{{ message.userName || 'Anonymous' }}</span>
                <span class="timestamp">{{ formatTimestamp(message.createdAt) }}</span>
              </div>
              <div class="message-body" v-html="linkifySpotifyUrls(message.message)"></div>
            </div>
          </div>
        </div>
        
        <!-- Message Input -->
        <div class="message-input-section">
          <textarea
            v-model="newMessage"
            :maxlength="280"
            placeholder="Type a message..."
            class="message-input"
            @keydown.enter.prevent="sendChatMessage"
          ></textarea>
          <div class="input-footer">
            <span class="char-count">{{ newMessage.length }}/280</span>
            <button
              class="btn-submit"
              :disabled="!canSubmit"
              @click="sendChatMessage"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, inject } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useChatLog } from '../composables/useChatLog'

export default {
  name: 'ChatLog',
  props: {
    canvasId: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const { user } = useAuth()
    const { messages, isLoading, subscribeToMessages, sendMessage } = useChatLog()
    
    // Inject Spotify playlist loader from SpotifyEmbed
    const loadSpotifyPlaylist = inject('loadSpotifyPlaylist', null)
    
    // Modal state
    const modalRef = ref(null)
    const messagesRef = ref(null)
    const isOpen = ref(false)
    const isMinimized = ref(false)
    
    // Calculate initial position (right side of canvas, overlaying canvas not sidebar)
    const initialX = window.innerWidth - 720 // Position more to the left to overlay canvas
    const initialY = 160 // Position below navbar and toolbar
    
    const modalStyle = ref({
      left: `${Math.max(20, initialX)}px`,
      top: `${Math.max(70, initialY)}px`,
      zIndex: 900
    })
    
    // Dragging state
    const isDragging = ref(false)
    const dragOffset = ref({ x: 0, y: 0 })
    const hasMoved = ref(false)
    const startPosition = ref({ x: 0, y: 0 })
    
    // Message input
    const newMessage = ref('')
    
    // Firestore listener
    let unsubscribe = null
    
    // Computed
    const canSubmit = computed(() => {
      return newMessage.value.trim().length > 0 && 
             newMessage.value.length <= 280 && 
             user.value
    })
    
    // LocalStorage key for this canvas
    const storageKey = computed(() => `chatLog_${props.canvasId}_collapsed`)
    
    // Load state from localStorage
    const loadState = () => {
      try {
        const savedState = localStorage.getItem(storageKey.value)
        if (savedState !== null) {
          const state = JSON.parse(savedState)
          isOpen.value = state.isOpen !== undefined ? state.isOpen : true
          isMinimized.value = state.isMinimized || false
        } else {
          // Default: open on first visit
          isOpen.value = true
          isMinimized.value = false
        }
      } catch (err) {
        console.error('Error loading chat state:', err)
        // Default state on error
        isOpen.value = true
        isMinimized.value = false
      }
    }
    
    // Save state to localStorage
    const saveState = () => {
      try {
        const state = {
          isOpen: isOpen.value,
          isMinimized: isMinimized.value
        }
        localStorage.setItem(storageKey.value, JSON.stringify(state))
      } catch (err) {
        console.error('Error saving chat state:', err)
      }
    }
    
    // Adjust position to ensure window stays within viewport
    const adjustPositionToFitViewport = () => {
      nextTick(() => {
        if (!modalRef.value) return
        
        const modalWidth = 400 // Fixed width from CSS
        const modalHeight = isMinimized.value ? 40 : 500 // Approximate heights
        
        const currentLeft = parseInt(modalStyle.value.left) || 20
        const currentTop = parseInt(modalStyle.value.top) || 70
        
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        
        // Constrain to viewport bounds
        let newLeft = Math.max(0, Math.min(currentLeft, viewportWidth - modalWidth))
        let newTop = Math.max(70, Math.min(currentTop, viewportHeight - modalHeight)) // Min 70px for navbar
        
        // Update position if adjustments were made
        if (newLeft !== currentLeft || newTop !== currentTop) {
          modalStyle.value.left = `${newLeft}px`
          modalStyle.value.top = `${newTop}px`
        }
      })
    }
    
    // Toggle chat open/close
    const toggleChat = () => {
      isOpen.value = !isOpen.value
      saveState()
      
      if (isOpen.value) {
        adjustPositionToFitViewport()
        if (!unsubscribe) {
          loadMessages()
        }
      }
    }
    
    // Close chat
    const closeChat = () => {
      isOpen.value = false
      saveState()
    }
    
    // Toggle minimize
    const toggleMinimize = () => {
      isMinimized.value = !isMinimized.value
      saveState()
      
      // Adjust position when expanding (unminimizing)
      if (!isMinimized.value) {
        adjustPositionToFitViewport()
      }
    }
    
    // Bring to front
    const bringToFront = () => {
      modalStyle.value.zIndex = 900
    }
    
    // Dragging functionality (matching SpotifySidebar pattern)
    const startDrag = (e) => {
      // Don't drag if clicking buttons in the modal header
      if (e.target.classList.contains('close-btn') || 
          e.target.classList.contains('minimize-btn')) {
        return
      }
      
      isDragging.value = true
      hasMoved.value = false
      startPosition.value = { x: e.clientX, y: e.clientY }
      
      // Calculate offset from mouse to element top-left
      let rect
      if (isOpen.value && modalRef.value) {
        rect = modalRef.value.getBoundingClientRect()
      } else {
        // For toggle button
        rect = e.currentTarget.getBoundingClientRect()
      }
      
      dragOffset.value = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
      
      // Prevent text selection while dragging
      e.preventDefault()
      
      document.addEventListener('mousemove', onDrag)
      document.addEventListener('mouseup', stopDrag)
    }
    
    const onDrag = (e) => {
      if (!isDragging.value) return
      
      // Check if mouse has moved more than a few pixels (drag threshold)
      const deltaX = Math.abs(e.clientX - startPosition.value.x)
      const deltaY = Math.abs(e.clientY - startPosition.value.y)
      
      if (deltaX > 3 || deltaY > 3) {
        hasMoved.value = true
      }
      
      // Calculate new position
      let newX = e.clientX - dragOffset.value.x
      let newY = e.clientY - dragOffset.value.y
      
      // Get viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Get element dimensions
      const buttonWidth = 50 // Toggle button width
      const elementWidth = isOpen.value ? 400 : buttonWidth
      const elementHeight = isOpen.value ? (isMinimized.value ? 40 : 500) : 50
      
      // Constrain to viewport bounds (same as SpotifySidebar)
      newX = Math.max(0, Math.min(newX, viewportWidth - elementWidth))
      newY = Math.max(70, Math.min(newY, viewportHeight - elementHeight)) // Min 70px for navbar
      
      modalStyle.value.left = `${newX}px`
      modalStyle.value.top = `${newY}px`
    }
    
    const stopDrag = () => {
      isDragging.value = false
      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', stopDrag)
    }
    
    // Handle expand click (only if not dragged) - matches SpotifySidebar pattern
    const handleExpandClick = (event) => {
      if (hasMoved.value) {
        // Was dragged, don't expand
        event.preventDefault()
        hasMoved.value = false
        return
      }
      // Was clicked without dragging, open chat
      toggleChat()
      hasMoved.value = false
    }
    
    // Load messages
    const loadMessages = () => {
      if (!props.canvasId) {
        console.error('Cannot load chat: canvasId is required')
        return
      }

      unsubscribe = subscribeToMessages(props.canvasId, () => {
        // Auto-scroll to bottom on new messages
        nextTick(() => {
          scrollToBottom()
        })
      })
    }
    
    // Send message
    const sendChatMessage = async () => {
      if (!canSubmit.value) return
      
      const messageToSend = newMessage.value.trim()
      
      // Clear input immediately (optimistic update)
      newMessage.value = ''
      
      try {
        await sendMessage(
          props.canvasId,
          messageToSend,
          user.value.uid,
          user.value.displayName || user.value.email?.split('@')[0] || 'Anonymous'
        )
        
        // Scroll to bottom after sending
        await nextTick()
        scrollToBottom()
      } catch (error) {
        console.error('Error sending message:', error)
        
        // Restore message on failure
        newMessage.value = messageToSend
        
        // Show user-friendly error
        alert(error.message || 'Failed to send message. Please try again.')
      }
    }
    
    // Format timestamp
    const formatTimestamp = (timestamp) => {
      if (!timestamp) return ''
      
      try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
        if (isNaN(date.getTime())) return ''
        
        const now = new Date()
        const diff = now - date
      
        // Less than 1 minute
        if (diff < 60000) {
          return 'Just now'
        }
        
        // Less than 1 hour
        if (diff < 3600000) {
          const minutes = Math.floor(diff / 60000)
          return `${minutes}m ago`
        }
        
        // Less than 24 hours
        if (diff < 86400000) {
          const hours = Math.floor(diff / 3600000)
          return `${hours}h ago`
        }
        
        // Less than 7 days
        if (diff < 604800000) {
          const days = Math.floor(diff / 86400000)
          return `${days}d ago`
        }
        
        // Format as date
        return date.toLocaleDateString()
      } catch (err) {
        console.error('Error formatting timestamp:', err)
        return ''
      }
    }
    
    // Scroll to bottom
    const scrollToBottom = () => {
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      }
    }
    
    // Linkify Spotify URLs in messages
    const linkifySpotifyUrls = (text) => {
      if (!text) return ''
      
      // Escape HTML to prevent XSS
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
      
      // Regex to match Spotify URLs
      // Matches: https://open.spotify.com/playlist/ID or spotify:playlist:ID
      const spotifyUrlRegex = /(https?:\/\/open\.spotify\.com\/(?:playlist|track|album|artist)\/[a-zA-Z0-9]+(?:\?[^\s]*)?|spotify:(?:playlist|track|album|artist):[a-zA-Z0-9]+)/g
      
      // Replace Spotify URLs with clickable links
      const linkified = escaped.replace(spotifyUrlRegex, (url) => {
        // Extract display text (shorten long URLs)
        let displayText = url
        if (url.startsWith('https://')) {
          const urlParts = url.split('/')
          const type = urlParts[3]
          const id = urlParts[4]?.split('?')[0]
          displayText = `🎵 ${type.charAt(0).toUpperCase() + type.slice(1)}: ${id?.substring(0, 10)}...`
        }
        
        return `<a href="#" class="spotify-link" data-spotify-url="${url}">${displayText}</a>`
      })
      
      return linkified
    }
    
    // Handle Spotify link clicks
    const handleSpotifyLinkClick = async (event) => {
      const target = event.target
      if (target.classList.contains('spotify-link')) {
        event.preventDefault()
        const spotifyUrl = target.getAttribute('data-spotify-url')
        
        if (spotifyUrl && loadSpotifyPlaylist) {
          const success = await loadSpotifyPlaylist(spotifyUrl)
          if (!success) {
            alert('Failed to load Spotify content. Please check the URL.')
          }
        } else {
          alert('Spotify player not available')
        }
      }
    }
    
    // Handle window resize to keep chat within viewport
    const handleResize = () => {
      if (isOpen.value && !isMinimized.value) {
        adjustPositionToFitViewport()
      }
    }
    
    // Lifecycle
    onMounted(() => {
      loadState()
      
      // Listen for window resize
      window.addEventListener('resize', handleResize)
    })
    
    // Watch for chat opening/closing to attach/detach Spotify link listener
    watch(isOpen, async (newValue) => {
      if (newValue) {
        adjustPositionToFitViewport()
        loadMessages()
        
        // Wait for DOM to update before attaching event listener
        await nextTick()
        if (messagesRef.value) {
          messagesRef.value.addEventListener('click', handleSpotifyLinkClick)
        }
      } else {
        // Clean up listener when chat closes
        if (messagesRef.value) {
          messagesRef.value.removeEventListener('click', handleSpotifyLinkClick)
        }
      }
    }, { immediate: true })
    
    watch(() => props.canvasId, (newCanvasId, oldCanvasId) => {
      if (newCanvasId !== oldCanvasId) {
        // Unsubscribe from old canvas
        if (unsubscribe) {
          unsubscribe()
          unsubscribe = null
        }
        
        // Load state for new canvas
        loadState()
        
        // Subscribe to new canvas if open
        if (isOpen.value) {
          loadMessages()
        }
      }
    })
    
    onUnmounted(() => {
      if (unsubscribe) {
        unsubscribe()
      }
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', stopDrag)
      
      // Remove Spotify link click listener
      if (messagesRef.value) {
        messagesRef.value.removeEventListener('click', handleSpotifyLinkClick)
      }
    })
    
    return {
      user,
      modalRef,
      messagesRef,
      modalStyle,
      isOpen,
      isMinimized,
      messages,
      isLoading,
      newMessage,
      canSubmit,
      toggleChat,
      closeChat,
      toggleMinimize,
      bringToFront,
      startDrag,
      handleExpandClick,
      sendChatMessage,
      formatTimestamp,
      linkifySpotifyUrls
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-toggle-button {
  position: fixed;
  /* Position controlled by inline style (draggable) */
  width: 48px;
  height: 48px;
  font-size: 24px;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  cursor: move;
  z-index: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
  user-select: none;
  transition: transform 0.1s;
  
  &:hover {
    transform: scale(1.05);
  }
  
  &:active {
    border: 2px solid #808080;
    border-right-color: #ffffff;
    border-bottom-color: #ffffff;
    transform: scale(0.98);
  }
}

.chat-modal {
  position: fixed;
  width: 400px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.4);
  
  &.minimized {
    height: auto;
    
    .inner {
      height: auto;
    }
  }
  
  .inner {
    display: flex;
    flex-direction: column;
    height: 500px;
    max-height: 80vh;
  }
  
  .header {
    background: linear-gradient(90deg, #000080, #1084d0);
    color: #ffffff;
    padding: 4px 8px;
    cursor: move;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    .title {
      font-weight: bold;
      font-size: 12px;
    }
    
    .header-controls {
      display: flex;
      gap: 4px;
    }
    
    .minimize-btn,
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
      
      &:active {
        border: 1px solid #000000;
        border-right-color: #ffffff;
        border-bottom-color: #ffffff;
      }
    }
    
    .minimize-btn {
      font-size: 14px;
      padding-bottom: 2px;
    }
  }
}

.chat-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow: hidden;
  padding: 12px;
  background: #c0c0c0;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  border: 2px inset #808080;
  background: #ffffff;
  padding: 12px;
  min-height: 300px;
  
  &::-webkit-scrollbar {
    width: 16px;
  }
  
  &::-webkit-scrollbar-track {
    background: #c0c0c0;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #808080;
    border: 2px outset #ffffff;
  }
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  display: inline-block;
  position: relative;
}

.spinner-box {
  width: 48px;
  height: 48px;
  border: 4px solid #000080;
  border-radius: 0;
  border-top: 4px solid #808080;
  animation: spin 1.2s linear infinite;
  box-shadow: 2px 2px 0 0 #808080;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  font-size: 11px;
  font-weight: bold;
  color: #000;
}

.empty-state {
  text-align: center;
  color: #808080;
  padding: 40px 20px;
  font-size: 12px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-entry {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  border: 1px solid #c0c0c0;
  background: #f5f5f5;
  
  &.own-message {
    background: #e0e0ff;
    border-color: #a0a0d0;
  }
  
  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    color: #666;
    
    .username {
      font-weight: bold;
      color: #000;
    }
    
    .timestamp {
      font-style: italic;
    }
  }
  
  .message-body {
    font-size: 13px;
    color: #000;
    line-height: 1.4;
    word-wrap: break-word;
    white-space: pre-wrap;
    
    // Spotify link styling
    :deep(.spotify-link) {
      color: #1DB954; // Spotify green
      text-decoration: underline;
      cursor: pointer;
      font-weight: bold;
      
      &:hover {
        color: #1ed760;
        background: rgba(29, 185, 84, 0.1);
      }
      
      &:active {
        color: #169c46;
      }
    }
  }
}

.message-input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  .message-input {
    width: 100%;
    min-height: 60px;
    padding: 6px;
    border: 2px inset #808080;
    background: #ffffff;
    font-family: Arial, sans-serif;
    font-size: 13px;
    resize: vertical;
    
    &:focus {
      outline: 1px dotted #000;
    }
  }
  
  .input-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .char-count {
      font-size: 11px;
      color: #666;
    }
    
    .btn-submit {
      padding: 4px 12px;
      background: #c0c0c0;
      border: 2px outset #ffffff;
      cursor: pointer;
      font-weight: bold;
      font-size: 12px;
      
      &:hover:not(:disabled) {
        background: #d0d0d0;
      }
      
      &:active:not(:disabled) {
        border-style: inset;
      }
      
      &:disabled {
        color: #808080;
        cursor: not-allowed;
      }
    }
  }
}
</style>

