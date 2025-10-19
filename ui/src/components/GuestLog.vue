<template>
  <div 
    v-if="isVisible"
    class="guest-log-overlay"
  >
    <div
      ref="modalRef"
      class="guest-log-modal window theme-win98"
      :style="modalStyle"
      @mousedown.stop="bringToFront"
    >
      <div class="inner">
        <!-- Title Bar -->
        <div 
          class="header"
          @mousedown="startDrag"
        >
          <span class="title">📖 Guest Log</span>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        
        <!-- Content -->
        <div class="content guest-log-content">
          <!-- Rate Limit Info -->
          <div v-if="remainingCooldown > 0" class="rate-limit-notice">
            <span>⏳ Next entry available in {{ remainingCooldown }}s ({{ entriesThisMinute }}/2 used)</span>
          </div>
          
          <!-- Message Input -->
          <div class="message-input-section">
            <textarea
              v-model="newMessage"
              :disabled="remainingCooldown > 0"
              :maxlength="280"
              placeholder="Leave a message in the guest log..."
              class="message-input"
              @keydown.ctrl.enter="submitEntry"
              @keydown.meta.enter="submitEntry"
            ></textarea>
            <div class="input-footer">
              <span class="char-count">{{ newMessage.length }}/280</span>
              <button
                class="btn-submit"
                :disabled="!canSubmit"
                @click="submitEntry"
              >
                Post Entry
              </button>
            </div>
          </div>
          
          <!-- Messages List -->
          <div class="messages-container" ref="messagesRef">
            <div v-if="isLoading" class="loading-state">
              <div class="loading-spinner">
                <div class="spinner-box"></div>
              </div>
              <div class="loading-text">Loading guest log...</div>
            </div>
            
            <div v-else-if="entries.length === 0" class="empty-state">
              No entries yet. Be the first to sign the guest log!
            </div>
            
            <div v-else class="messages-list">
              <div
                v-for="entry in entries"
                :key="entry.id"
                class="message-entry"
                :class="{ 'own-message': entry.userId === user?.uid }"
              >
                <div class="message-header">
                  <span class="username">{{ entry.userName || 'Anonymous' }}</span>
                  <span class="timestamp">{{ formatTimestamp(entry.createdAt) }}</span>
                </div>
                <div class="message-body">
                  {{ entry.message }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useAuth } from '../composables/useAuth'
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

export default {
  name: 'GuestLog',
  props: {
    isVisible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    const { user } = useAuth()
    
    // Modal dragging
    const modalRef = ref(null)
    const modalStyle = ref({
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 1000
    })
    const isDragging = ref(false)
    const dragStartX = ref(0)
    const dragStartY = ref(0)
    const modalStartX = ref(0)
    const modalStartY = ref(0)
    
    // Messages
    const messagesRef = ref(null)
    const entries = ref([])
    const isLoading = ref(true)
    const newMessage = ref('')
    
    // Rate limiting
    const entriesThisMinute = ref(0)
    const lastEntryTimestamps = ref([])
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
    
    const closeModal = () => {
      emit('close')
    }
    
    const bringToFront = () => {
      modalStyle.value.zIndex = 1000
    }
    
    // Dragging functionality
    const startDrag = (e) => {
      if (e.target.classList.contains('close-btn')) return
      
      isDragging.value = true
      dragStartX.value = e.clientX
      dragStartY.value = e.clientY
      
      // Get current modal position
      const rect = modalRef.value.getBoundingClientRect()
      modalStartX.value = rect.left
      modalStartY.value = rect.top
      
      // Remove transform for absolute positioning
      modalStyle.value.transform = 'none'
      modalStyle.value.left = `${modalStartX.value}px`
      modalStyle.value.top = `${modalStartY.value}px`
      
      document.addEventListener('mousemove', onDrag)
      document.addEventListener('mouseup', stopDrag)
    }
    
    const onDrag = (e) => {
      if (!isDragging.value) return
      
      const deltaX = e.clientX - dragStartX.value
      const deltaY = e.clientY - dragStartY.value
      
      const newLeft = modalStartX.value + deltaX
      const newTop = modalStartY.value + deltaY
      
      modalStyle.value.left = `${newLeft}px`
      modalStyle.value.top = `${newTop}px`
    }
    
    const stopDrag = () => {
      isDragging.value = false
      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', stopDrag)
    }
    
    // Rate limiting
    const updateRateLimitStatus = () => {
      const now = Date.now()
      const oneMinuteAgo = now - 60000
      
      // Filter out entries older than 1 minute
      lastEntryTimestamps.value = lastEntryTimestamps.value.filter(ts => ts > oneMinuteAgo)
      entriesThisMinute.value = lastEntryTimestamps.value.length
      
      if (entriesThisMinute.value >= 2) {
        // Calculate cooldown based on oldest entry
        const oldestEntry = Math.min(...lastEntryTimestamps.value)
        const cooldownEnd = oldestEntry + 60000
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
    
    // Submit entry
    const submitEntry = async () => {
      if (!canSubmit.value) return
      
      const messageToPost = newMessage.value.trim()
      
      // Clear input immediately for better UX (optimistic update)
      newMessage.value = ''
      
      try {
        const guestLogRef = collection(db, 'guestLog')
        
        await addDoc(guestLogRef, {
          message: messageToPost,
          userId: user.value.uid,
          userName: user.value.displayName || user.value.email?.split('@')[0] || 'Anonymous',
          createdAt: serverTimestamp(),
          timestamp: Date.now() // For client-side sorting before server timestamp arrives
        })
        
        // Update rate limiting
        lastEntryTimestamps.value.push(Date.now())
        updateRateLimitStatus()
        startCooldownTimer()
        
        // Scroll to bottom
        await nextTick()
        scrollToBottom()
        
      } catch (error) {
        console.error('Error posting guest log entry:', error)
        
        // Restore message on failure
        newMessage.value = messageToPost
        
        // Provide better error messages
        if (error.code === 'permission-denied') {
          alert('Permission denied. You may be rate-limited. Please wait and try again.')
        } else if (error.code === 'unavailable') {
          alert('Network error. Please check your connection and try again.')
        } else {
          alert('Failed to post entry. Please try again.')
        }
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
    
    const scrollToBottom = () => {
      if (messagesRef.value) {
        messagesRef.value.scrollTop = messagesRef.value.scrollHeight
      }
    }
    
    // Load entries from Firestore
    const loadEntries = () => {
      const guestLogRef = collection(db, 'guestLog')
      const q = query(guestLogRef, orderBy('createdAt', 'desc'), limit(100))
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        try {
          entries.value = snapshot.docs.map(doc => {
            const data = doc.data()
            // Defensive: Ensure all required fields exist
            return {
              id: doc.id,
              message: data.message || '',
              userId: data.userId || '',
              userName: data.userName || 'Anonymous',
              createdAt: data.createdAt || data.timestamp || Date.now(),
              timestamp: data.timestamp || Date.now()
            }
          }).reverse() // Reverse to show oldest first
          
          isLoading.value = false
          
          // Auto-scroll to bottom on new entries
          nextTick(() => {
            scrollToBottom()
          })
        } catch (err) {
          console.error('Error processing guest log snapshot:', err)
          // Don't crash - keep showing existing entries
        }
      }, (error) => {
        console.error('Error loading guest log:', error)
        isLoading.value = false
        
        // Attempt to reconnect after a delay if listener fails
        setTimeout(() => {
          if (props.isVisible && !unsubscribe) {
            console.log('Attempting to reconnect guest log listener...')
            loadEntries()
          }
        }, 5000)
      })
    }
    
    // Lifecycle
    onMounted(() => {
      if (props.isVisible) {
        loadEntries()
        updateRateLimitStatus()
      }
    })
    
    watch(() => props.isVisible, (newVal) => {
      if (newVal) {
        loadEntries()
        updateRateLimitStatus()
        // Reset position when reopened
        modalStyle.value = {
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000
        }
      } else {
        if (unsubscribe) {
          unsubscribe()
          unsubscribe = null
        }
        if (cooldownInterval) {
          clearInterval(cooldownInterval)
          cooldownInterval = null
        }
      }
    })
    
    onUnmounted(() => {
      if (unsubscribe) {
        unsubscribe()
      }
      if (cooldownInterval) {
        clearInterval(cooldownInterval)
      }
      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', stopDrag)
    })
    
    return {
      user,
      modalRef,
      modalStyle,
      messagesRef,
      entries,
      isLoading,
      newMessage,
      entriesThisMinute,
      remainingCooldown,
      canSubmit,
      closeModal,
      bringToFront,
      startDrag,
      submitEntry,
      formatTimestamp
    }
  }
}
</script>

<style lang="scss" scoped>
.guest-log-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.guest-log-modal {
  position: fixed;
  width: 500px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.5);
  
  .inner {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .header {
    cursor: move;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-right: 4px;
    
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
  }
}

.guest-log-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 600px;
  max-height: 70vh;
  overflow: hidden;
}

.rate-limit-notice {
  background: #ffffe0;
  border: 1px solid #808080;
  padding: 8px;
  font-size: 12px;
  text-align: center;
  color: #333;
}

.message-input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  .message-input {
    width: 100%;
    min-height: 80px;
    padding: 8px;
    border: 2px inset #808080;
    background: #ffffff;
    font-family: Arial, sans-serif;
    font-size: 14px;
    resize: vertical;
    
    &:disabled {
      background: #e0e0e0;
      color: #808080;
    }
    
    &:focus {
      outline: 1px dotted #000;
    }
  }
  
  .input-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    
    .char-count {
      font-size: 12px;
      color: #666;
    }
    
    .btn-submit {
      padding: 6px 16px;
      background: #c0c0c0;
      border: 2px outset #ffffff;
      cursor: pointer;
      font-weight: bold;
      
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

.messages-container {
  flex: 1;
  overflow-y: auto;
  border: 2px inset #808080;
  background: #ffffff;
  padding: 12px;
  
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
  color: #000;
  padding: 40px 20px;
  font-size: 11px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-entry {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
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
    font-size: 14px;
    color: #000;
    line-height: 1.4;
    word-wrap: break-word;
    white-space: pre-wrap;
  }
}
</style>

