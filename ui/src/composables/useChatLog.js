import { ref } from 'vue'
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase/config'

export function useChatLog() {
  const messages = ref([])
  const isLoading = ref(true)
  const error = ref(null)

  /**
   * Subscribe to chat messages for a specific canvas/room
   * @param {string} canvasId - The canvas ID to scope messages to
   * @param {Function} callback - Optional callback to run when messages update
   * @returns {Function} Unsubscribe function
   */
  const subscribeToMessages = (canvasId, callback) => {
    if (!canvasId) {
      console.error('Cannot subscribe to chat: canvasId is required')
      isLoading.value = false
      return () => {}
    }

    try {
      isLoading.value = true
      error.value = null

      // Reference to chat subcollection for this canvas
      const chatRef = collection(db, 'canvases', canvasId, 'chat')
      
      // Query messages ordered by creation time (oldest first)
      // Load ALL messages (no limit)
      const q = query(chatRef, orderBy('createdAt', 'asc'))

      // Set up real-time listener
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          try {
            messages.value = snapshot.docs.map(doc => {
              const data = doc.data()
              return {
                id: doc.id,
                message: data.message || '',
                userId: data.userId || '',
                userName: data.userName || 'Anonymous',
                createdAt: data.createdAt || data.timestamp || Date.now(),
                timestamp: data.timestamp || Date.now()
              }
            })

            isLoading.value = false

            // Call optional callback
            if (callback && typeof callback === 'function') {
              callback(messages.value)
            }
          } catch (err) {
            console.error('Error processing chat snapshot:', err)
            // Don't crash - keep showing existing messages
          }
        },
        (err) => {
          console.error('Error subscribing to chat messages:', err)
          error.value = err.message || 'Failed to load messages'
          isLoading.value = false

          // Attempt to reconnect after a delay if listener fails
          setTimeout(() => {
            console.log('Attempting to reconnect chat listener...')
            subscribeToMessages(canvasId, callback)
          }, 5000)
        }
      )

      return unsubscribe
    } catch (err) {
      console.error('Error setting up chat subscription:', err)
      error.value = err.message || 'Failed to set up message listener'
      isLoading.value = false
      return () => {}
    }
  }

  /**
   * Send a new chat message
   * @param {string} canvasId - The canvas ID to send message to
   * @param {string} message - The message text
   * @param {string} userId - The user's ID
   * @param {string} userName - The user's display name
   * @returns {Promise<Object>} The created message document reference
   */
  const sendMessage = async (canvasId, message, userId, userName) => {
    // Validation
    if (!canvasId) {
      throw new Error('Canvas ID is required')
    }

    if (!message || typeof message !== 'string') {
      throw new Error('Message is required and must be a string')
    }

    const trimmedMessage = message.trim()
    
    if (trimmedMessage.length === 0) {
      throw new Error('Message cannot be empty')
    }

    if (trimmedMessage.length > 280) {
      throw new Error('Message cannot exceed 280 characters')
    }

    if (!userId) {
      throw new Error('User ID is required')
    }

    if (!userName) {
      throw new Error('User name is required')
    }

    try {
      error.value = null

      // Reference to chat subcollection for this canvas
      const chatRef = collection(db, 'canvases', canvasId, 'chat')

      // Create message document
      const messageData = {
        message: trimmedMessage,
        userId,
        userName,
        createdAt: serverTimestamp(),
        timestamp: Date.now() // For client-side sorting before server timestamp arrives
      }

      const docRef = await addDoc(chatRef, messageData)

      return {
        id: docRef.id,
        ...messageData
      }
    } catch (err) {
      console.error('Error sending chat message:', err)
      error.value = err.message || 'Failed to send message'

      // Provide more specific error messages
      if (err.code === 'permission-denied') {
        throw new Error('Permission denied. You may not have access to this room.')
      } else if (err.code === 'unavailable') {
        throw new Error('Network error. Please check your connection and try again.')
      } else {
        throw new Error('Failed to send message. Please try again.')
      }
    }
  }

  return {
    messages,
    isLoading,
    error,
    subscribeToMessages,
    sendMessage
  }
}

