<template>
  <div 
    class="chat-overlay" 
    :class="{ collapsed: isCollapsed }"
    :style="overlayStyle"
  >
    <!-- Collapsed State - Just Icon -->
    <button 
      v-if="isCollapsed" 
      @click="handleExpandClick" 
      @mousedown="startDrag"
      class="expand-btn" 
      title="Open Chat (drag to move)"
    >
      💬
    </button>

    <!-- Expanded State - Full Chat Window -->
    <div v-else class="chat-window">
      <!-- Title Bar -->
      <div 
        class="header"
        @mousedown="startDrag"
      >
        <span class="title">💬 Room Chat</span>
        <button 
          class="close-btn" 
          @click="isCollapsed = true"
          @mousedown.stop
          title="Minimize"
        >
          _
        </button>
      </div>
      
      <!-- Content -->
      <div class="content chat-content">
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
        
        <!-- Rate Limit Info -->
        <div v-if="remainingCooldown > 0" class="rate-limit-notice">
          <span>⏳ Next message in {{ remainingCooldown }}s ({{ messagesThisMinute }}/5 used)</span>
        </div>
        
        <!-- Message Input -->
        <div class="message-input-section">
          <textarea
            v-model="newMessage"
            :disabled="remainingCooldown > 0 || !user"
            :maxlength="280"
            :placeholder="user ? 'Type a message...' : 'Sign in to chat'"
            class="message-input"
            @keydown.ctrl.enter="submitMessage"
            @keydown.meta.enter="submitMessage"
          ></textarea>
          <div class="input-footer">
            <span class="char-count">{{ newMessage.length }}/280</span>
            <button
              class="btn-submit"
              :disabled="!canSubmit"
              @click="submitMessage"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, defineExpose } from 'vue'
import { useAuth } from '../composables/useAuth'
import { collection, addDoc, query, limit, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

const props = defineProps({
  canvasId: {
    type: String,
    required: true
  }
})

const { user } = useAuth()

// Load persisted state from localStorage
const loadPersistedState = () => {
      try {
        const savedState = localStorage.getItem('chatBox')
        if (savedState) {
          return JSON.parse(savedState)
        }
      } catch (err) {
        console.error('Failed to load chat box state:', err)
      }
      return null
    }

    // Save state to localStorage
    const saveState = (collapsed, pos) => {
      try {
        localStorage.setItem('chatBox', JSON.stringify({
          isCollapsed: collapsed,
          position: pos
        }))
      } catch (err) {
        console.error('Failed to save chat box state:', err)
      }
    }

    const persistedState = loadPersistedState()
    const isCollapsed = ref(persistedState?.isCollapsed ?? true) // Collapsed by default
    const position = ref(persistedState?.position ?? { x: 80, y: 220 }) // Below Spotify widget by default
    const isDragging = ref(false)
    const dragOffset = ref({ x: 0, y: 0 })
    const hasMoved = ref(false)
    const startPosition = ref({ x: 0, y: 0 })
    
    // Messages
    const messagesRef = ref(null)
    const messages = ref([])
    const isLoading = ref(true)
    const newMessage = ref('')
    
    // Rate limiting - 5 messages per minute
    const messagesThisMinute = ref(0)
    const lastMessageTimestamps = ref([])
    const remainingCooldown = ref(0)
    let cooldownInterval = null
    
    // Firestore listener
    let unsubscribe = null
    
    const canSubmit = computed(() => {
      return newMessage.value.trim().length > 0 && 
             newMessage.value.length <= 280 && 
             remainingCooldown.value === 0 &&
             user.value
    })

    // Computed style for positioning
    const overlayStyle = computed(() => ({
      left: `${position.value.x}px`,
      top: `${position.value.y}px`,
    }))
    
    // Dragging functionality
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
      const elementWidth = isCollapsed.value ? 48 : 300
      const elementHeight = isCollapsed.value ? 48 : 400

      // Constrain to viewport bounds
      newX = Math.max(0, Math.min(newX, viewportWidth - elementWidth))
      newY = Math.max(70, Math.min(newY, viewportHeight - elementHeight)) // Min 70px for navbar

      position.value = { x: newX, y: newY }
    }

    // Stop dragging
    const onMouseUp = () => {
      isDragging.value = false
      // Save position after dragging ends
      if (hasMoved.value) {
        saveState(isCollapsed.value, position.value)
      }
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
      
      // Load messages when expanding if not already loaded
      if (props.canvasId && !unsubscribe) {
        loadMessages()
      }
    }

    // Watch for collapsed state changes and persist
    watch(isCollapsed, (newValue) => {
      saveState(newValue, position.value)
      if (!newValue) {
        nextTick(() => {
          scrollToBottom()
        })
      }
    })
    
    // Rate limiting
    const updateRateLimitStatus = () => {
      const now = Date.now()
      const oneMinuteAgo = now - 60000
      
      // Filter out messages older than 1 minute
      lastMessageTimestamps.value = lastMessageTimestamps.value.filter(ts => ts > oneMinuteAgo)
      messagesThisMinute.value = lastMessageTimestamps.value.length
      
      if (messagesThisMinute.value >= 5) {
        // Calculate cooldown based on oldest message
        const oldestMessage = Math.min(...lastMessageTimestamps.value)
        const cooldownEnd = oldestMessage + 60000
        remainingCooldown.value = Math.max(0, Math.ceil((cooldownEnd - now) / 1000))
      } else {
        remainingCooldown.value = 0
      }
    }
    
    const startCooldownTimer = () => {
      if (cooldownInterval) clearInterval(cooldownInterval)
      
      cooldownInterval = setInterval(() => {
        updateRateLimitStatus()
        if (remainingCooldown.value === 0 && cooldownInterval) {
          clearInterval(cooldownInterval)
          cooldownInterval = null
        }
      }, 1000)
    }
    
    // Submit message
    const submitMessage = async () => {
      if (!canSubmit.value) return
      
      const messageToPost = newMessage.value.trim()
      
      // Clear input immediately for better UX (optimistic update)
      newMessage.value = ''
      
      try {
        const chatRef = collection(db, 'canvases', props.canvasId, 'chat')
        
        await addDoc(chatRef, {
          message: messageToPost,
          userId: user.value.uid,
          userName: user.value.displayName || user.value.email?.split('@')[0] || 'Anonymous',
          createdAt: serverTimestamp(),
          timestamp: Date.now() // For client-side sorting before server timestamp arrives
        })
        
        // Update rate limiting
        lastMessageTimestamps.value.push(Date.now())
        updateRateLimitStatus()
        
        if (remainingCooldown.value > 0) {
          startCooldownTimer()
        }
        
        // Auto-scroll to bottom after sending
        await nextTick()
        scrollToBottom()
      } catch (error) {
        console.error('Error sending message:', error)
        // Restore message on error
        newMessage.value = messageToPost
      }
    }
    
    // Format timestamp
    const formatTimestamp = (timestamp) => {
      if (!timestamp) return ''
      
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)
      
      if (diffMins < 1) return 'just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`
      
      return date.toLocaleDateString()
    }
    
    // Auto-scroll to bottom
    const scrollToBottom = () => {
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      }
    }
    
    // Load messages from Firestore
    const loadMessages = () => {
      if (!props.canvasId) {
        isLoading.value = false
        return
      }
      
      isLoading.value = true
      
      try {
        const chatRef = collection(db, 'canvases', props.canvasId, 'chat')
        const q = query(chatRef, limit(100))
        
        unsubscribe = onSnapshot(q, 
          (snapshot) => {
            // Sort by timestamp on client side (oldest first)
            messages.value = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
              .sort((a, b) => {
                const aTime = a.timestamp || 0
                const bTime = b.timestamp || 0
                return aTime - bTime // Ascending order (oldest first)
              })
            
            isLoading.value = false
            
            // Scroll to bottom when messages load or update
            nextTick(() => {
              scrollToBottom()
            })
          }, 
          (error) => {
            console.error('Error loading chat messages:', error)
            isLoading.value = false
          }
        )
      } catch (error) {
        console.error('Error setting up chat listener:', error)
        isLoading.value = false
      }
    }
    
    // Watch for canvas ID changes
    watch(() => props.canvasId, (newId) => {
      if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
      }
      messages.value = []
      if (newId && !isCollapsed.value) {
        loadMessages()
      }
    })
    
    onMounted(() => {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      
      if (props.canvasId && !isCollapsed.value) {
        loadMessages()
      }
      updateRateLimitStatus()
    })
    
    onUnmounted(() => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      
      if (unsubscribe) {
        unsubscribe()
      }
      if (cooldownInterval) {
        clearInterval(cooldownInterval)
      }
    })
    
// Expose method to open chat from parent (not used, but kept for potential future use)
const openChat = () => {
  isCollapsed.value = false
  if (props.canvasId && !unsubscribe) {
    loadMessages()
  }
}

// Expose the openChat method to parent components
defineExpose({
  openChat
})
</script>

<style scoped>
.chat-overlay {
  position: fixed;
  z-index: 101;
  user-select: none;
}

/* Collapsed State - Small Icon Button */
.expand-btn {
  width: 48px;
  height: 48px;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  cursor: move;
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
.chat-window {
  width: 300px;
  height: 400px;
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.4);
}

.header {
  background: linear-gradient(90deg, #000080, #1084d0);
  color: #ffffff;
  padding: 4px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
  user-select: none;
}

.title {
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

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.chat-content {
  padding: 8px;
  gap: 8px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  background: #ffffff;
  border: 2px inset #808080;
  padding: 8px;
  margin-bottom: 8px;
  min-height: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 12px;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-box {
  width: 30px;
  height: 30px;
  border: 3px solid #c0c0c0;
  border-top-color: #000080;
  border-radius: 0;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: #808080;
  font-size: 11px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #808080;
  font-size: 11px;
  text-align: center;
  padding: 20px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-entry {
  background: #e0e0e0;
  border: 1px solid #808080;
  padding: 6px 8px;
  border-radius: 0;
}

.message-entry.own-message {
  background: #d0e0ff;
  border-color: #4080ff;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  gap: 8px;
}

.username {
  font-weight: bold;
  font-size: 11px;
  color: #000080;
}

.timestamp {
  font-size: 10px;
  color: #808080;
}

.message-body {
  font-size: 11px;
  color: #000;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.rate-limit-notice {
  background: #ffff00;
  border: 1px solid #000;
  padding: 6px 8px;
  font-size: 11px;
  font-weight: bold;
  text-align: center;
  margin-bottom: 8px;
}

.message-input-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.message-input {
  width: 100%;
  min-height: 50px;
  max-height: 80px;
  padding: 4px;
  border: 2px inset #808080;
  font-size: 11px;
  font-family: 'Tahoma', sans-serif;
  resize: vertical;
  background: #ffffff;
}

.message-input:disabled {
  background: #c0c0c0;
  color: #808080;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.char-count {
  font-size: 10px;
  color: #808080;
}

.btn-submit {
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: bold;
  cursor: pointer;
}

.btn-submit:active:not(:disabled) {
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.btn-submit:disabled {
  color: #808080;
  cursor: not-allowed;
}

/* Scrollbar styling */
.messages-container::-webkit-scrollbar {
  width: 16px;
}

.messages-container::-webkit-scrollbar-track {
  background: #c0c0c0;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #808080;
  border: 1px solid #ffffff;
}

/* Responsive */
@media (max-width: 1024px) {
  .chat-window {
    width: 280px;
    height: 380px;
  }
}

@media (max-width: 768px) {
  .chat-overlay {
    display: none;
  }
}
</style>
