<template>
  <!-- Floating Toggle Button -->
  <button 
    v-if="!isOpen"
    class="chat-toggle-button"
    @click="toggleChat"
    title="Open Chat"
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
          <button class="close-btn" @click="closeChat" title="Close">×</button>
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
              <div class="message-body">
                {{ message.message }}
              </div>
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
            @keydown.ctrl.enter="sendChatMessage"
            @keydown.meta.enter="sendChatMessage"
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
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
    
    // Modal state
    const modalRef = ref(null)
    const messagesRef = ref(null)
    const isOpen = ref(false)
    const isMinimized = ref(false)
    const modalStyle = ref({
      right: '20px',
      bottom: '20px',
      zIndex: 900
    })
    
    // Dragging state
    const isDragging = ref(false)
    const dragStartX = ref(0)
    const dragStartY = ref(0)
    const modalStartX = ref(0)
    const modalStartY = ref(0)
    
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
    
    // Toggle chat open/close
    const toggleChat = () => {
      isOpen.value = !isOpen.value
      saveState()
      
      if (isOpen.value && !unsubscribe) {
        loadMessages()
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
    }
    
    // Bring to front
    const bringToFront = () => {
      modalStyle.value.zIndex = 900
    }
    
    // Dragging functionality
    const startDrag = (e) => {
      // Don't drag if clicking buttons
      if (e.target.classList.contains('close-btn') || 
          e.target.classList.contains('minimize-btn')) {
        return
      }
      
      isDragging.value = true
      dragStartX.value = e.clientX
      dragStartY.value = e.clientY
      
      // Get current modal position
      const rect = modalRef.value.getBoundingClientRect()
      modalStartX.value = window.innerWidth - rect.right
      modalStartY.value = window.innerHeight - rect.bottom
      
      document.addEventListener('mousemove', onDrag)
      document.addEventListener('mouseup', stopDrag)
    }
    
    const onDrag = (e) => {
      if (!isDragging.value) return
      
      const deltaX = dragStartX.value - e.clientX
      const deltaY = dragStartY.value - e.clientY
      
      const newRight = modalStartX.value + deltaX
      const newBottom = modalStartY.value + deltaY
      
      // Keep within bounds
      const clampedRight = Math.max(0, Math.min(newRight, window.innerWidth - 300))
      const clampedBottom = Math.max(0, Math.min(newBottom, window.innerHeight - 100))
      
      modalStyle.value.right = `${clampedRight}px`
      modalStyle.value.bottom = `${clampedBottom}px`
    }
    
    const stopDrag = () => {
      isDragging.value = false
      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', stopDrag)
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
    
    // Lifecycle
    onMounted(() => {
      loadState()
      
      if (isOpen.value) {
        loadMessages()
      }
    })
    
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
      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', stopDrag)
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
      sendChatMessage,
      formatTimestamp
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-toggle-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  font-size: 28px;
  background: #c0c0c0;
  border: none;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
  cursor: pointer;
  z-index: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: none;
  
  &:hover {
    background: #d0d0d0;
  }
  
  &:active {
    box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
  }
}

.chat-modal {
  position: fixed;
  width: 400px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.5);
  
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
    cursor: move;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-right: 4px;
    
    .header-controls {
      display: flex;
      gap: 4px;
    }
    
    .minimize-btn,
    .close-btn {
      background: #c0c0c0;
      border: 2px outset #ffffff;
      width: 24px;
      height: 24px;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      
      &:hover {
        background: #d0d0d0;
      }
      
      &:active {
        border-style: inset;
      }
    }
    
    .minimize-btn {
      font-size: 16px;
      padding-bottom: 4px;
    }
  }
}

.chat-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow: hidden;
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

