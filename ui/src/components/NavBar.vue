<template>
  <nav class="navbar">
    <div class="nav-content">
      <!-- Logo/Title -->
      <div class="nav-brand">
        <button class="back-button" @click="handleBackToDashboard" title="Back to Dashboard">
          ← Back
        </button>
        <h1>Collab Canvas</h1>
      </div>

      <!-- User Info & Controls -->
      <div class="nav-controls">
        <!-- Connection Status -->
        <ConnectionStatus />
        <!-- Presence List -->
        <div v-if="user && presenceLoaded" class="presence-section">
          <!-- User Count -->
          <div class="user-count" @click="togglePresenceDropdown">
            <span class="count-badge">{{ activeUserCount + 1 }}</span>
            <span class="count-text">users online</span>
            <svg 
              :class="{ 'rotated': showPresenceDropdown }" 
              class="dropdown-arrow" 
              viewBox="0 0 20 20"
            >
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
            </svg>
          </div>

          <!-- Presence Dropdown -->
          <div v-if="showPresenceDropdown" class="presence-dropdown">
            <div class="dropdown-header">Online Users</div>
            
            <!-- Current User -->
            <div class="user-item current-user">
              <div 
                class="cursor-color" 
                :style="{ backgroundColor: userCursorColor }"
              ></div>
              <span class="user-name">{{ userDisplayName }}</span>
              <span class="you-label">(you)</span>
            </div>
            
            <!-- Other Users -->
            <div v-if="activeUsers.length === 0 && activeUserCount === 0" class="empty-state">
              You're the only one here
            </div>
            <div v-else class="user-list">
              <div 
                v-for="activeUser in activeUsers" 
                :key="activeUser.userId"
                class="user-item"
              >
                <div 
                  class="cursor-color" 
                  :style="{ backgroundColor: activeUser.cursorColor }"
                ></div>
                <span class="user-name">{{ activeUser.userName }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Current User Info -->
        <div v-if="user" class="user-info">
          <div 
            class="user-cursor-color" 
            :style="{ backgroundColor: userCursorColor }"
            :title="'Your cursor color'"
          ></div>
          <span class="user-name">{{ userDisplayName }}</span>
        </div>

        <!-- Version History & Save (owner-only) -->
        <button v-if="isOwner" class="logout-button" title="Version History" @click="$emit('toggle-versions')">
          History
        </button>
        <button v-if="isOwner" class="logout-button" title="Save Version" @click="$emit('save-version')" :disabled="isOffline">
          Save
        </button>
        
        <!-- Sign Out Button (far right) -->
        <button 
          v-if="user" 
          @click="handleLogout"
          :disabled="isLoading"
          class="logout-button"
          title="Sign out"
        >
          <svg class="logout-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
          </svg>
          {{ isLoading ? 'Signing out...' : 'Sign Out' }}
        </button>
      </div>
    </div>

    <!-- Click outside to close dropdown -->
    <div 
      v-if="showPresenceDropdown" 
      @click="showPresenceDropdown = false"
      class="dropdown-overlay"
    ></div>
  </nav>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useRouter } from 'vue-router'
import { usePresence } from '../composables/usePresence'
import { usePresenceRTDB } from '../composables/usePresenceRTDB'
import { useCursors } from '../composables/useCursors'
import { useConnectionState, CONNECTION_STATUS } from '../composables/useConnectionState'
import { getFeatureFlag } from '../utils/featureFlags'
import ConnectionStatus from './ConnectionStatus.vue'

export default {
  name: 'NavBar',
  components: { ConnectionStatus },
  props: {
    canvasId: {
      type: String,
      default: 'default'
    },
    canUserEdit: {
      type: Boolean,
      default: false
    },
    isOwner: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const { user, signOut, isLoading } = useAuth()
    
    // Use the correct presence system based on feature flag
    const useRealtimeDB = getFeatureFlag('USE_REALTIME_DB', false)
    const presenceComposable = useRealtimeDB ? usePresenceRTDB() : usePresence()
    const { activeUsers, activeUsersVersion, getActiveUsers, getActiveUserCount, setUserOffline } = presenceComposable
    
    const { removeCursor } = useCursors()
    const { state: connectionState } = useConnectionState()
    const router = useRouter()
    
    // Local state
    const showPresenceDropdown = ref(false)
    const userCursorColor = ref('#667eea')
    const presenceLoaded = ref(false)

    // Computed properties
    const userDisplayName = computed(() => {
      if (!user.value) return ''
      return user.value.displayName || user.value.email?.split('@')[0] || 'Anonymous'
    })

    // Use activeUsers directly for reactivity
    // Convert to array first to ensure Vue tracks changes properly
    // Include activeUsersVersion in computation to force updates
    const activeUsersList = computed(() => {
      // Access version to trigger reactivity
      activeUsersVersion.value
      return Array.from(activeUsers.values())
    })
    const activeUserCount = computed(() => activeUsersList.value.length)
    
    // Check if offline
    const isOffline = computed(() => connectionState.status === CONNECTION_STATUS.OFFLINE)

    // Load user's cursor color from Firestore (disabled until PR #5)
    const loadUserCursorColor = async () => {
      if (!user.value) return
      
      // TODO: Load from user profile in Firestore
      // For now, use default color  
      userCursorColor.value = '#667eea'
    }

    // Mock presence data for now (replaced with real presence in PR #8)
    const loadPresenceData = () => {
      // Presence is now handled by usePresence composable
      // and integrated with CanvasView lifecycle
    }

    // Toggle presence dropdown
    const togglePresenceDropdown = () => {
      showPresenceDropdown.value = !showPresenceDropdown.value
    }

    // Handle logout
    const handleLogout = async () => {
      try {
        const userId = user.value?.uid
        
        if (userId) {
          // Clean up presence and cursor before signing out
          // Use the actual canvasId prop instead of hardcoded 'default'
          await Promise.all([
            setUserOffline(props.canvasId, userId),
            removeCursor(props.canvasId, userId)
          ])
        }
        
        // Sign out user
        await signOut()
        router.push('/')
      } catch (error) {
        console.error('Logout error:', error)
      }
    }

    // Handle back to dashboard
    const handleBackToDashboard = async () => {
      console.log('🔙 Back button clicked - navigating to Dashboard')
      try {
        await router.push({ name: 'Dashboard' })
        console.log('✅ Navigation to Dashboard completed')
      } catch (error) {
        console.error('❌ Error navigating to dashboard:', error)
        // Try alternative navigation
        try {
          await router.push('/')
          console.log('✅ Navigation to / completed as fallback')
        } catch (fallbackError) {
          console.error('❌ Fallback navigation also failed:', fallbackError)
        }
      }
    }

    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (!event.target.closest('.presence-section')) {
        showPresenceDropdown.value = false
      }
    }

    // Watch for presence data to load
    watch(activeUsersList, () => {
      // Mark presence as loaded after we receive data
      // Small delay to ensure initial snapshot is processed
      setTimeout(() => {
        presenceLoaded.value = true
      }, 500)
    }, { immediate: true })

    // Lifecycle
    onMounted(() => {
      if (user.value) {
        loadUserCursorColor()
        loadPresenceData()
      }
      document.addEventListener('click', handleClickOutside)
    })

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside)
    })

    // Watch for user changes
    const unwatchUser = user.value ? null : (() => {
      if (user.value) {
        loadUserCursorColor()
        loadPresenceData()
      }
    })

    return {
      user,
      isLoading,
      userDisplayName,
      userCursorColor,
      activeUsers: activeUsersList,
      activeUserCount,
      showPresenceDropdown,
      togglePresenceDropdown,
      handleLogout,
      handleBackToDashboard,
      presenceLoaded,
      isOffline
    }
  }
}
</script>

<style scoped>
.navbar {
  background: #c0c0c0;
  border-bottom: 2px solid #808080;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  box-shadow: inset 1px 1px 0 0 #ffffff, inset -1px -1px 0 0 #808080;
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-brand h1 {
  margin: 0;
  color: #000;
  font-size: 14px;
  font-weight: bold;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #c0c0c0;
  border: none;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
  font-size: 11px;
  font-weight: normal;
  color: #000;
  cursor: pointer;
}

.back-button:active {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.nav-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.presence-section {
  position: relative;
}

.user-count {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #c0c0c0;
  border: none;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
  cursor: pointer;
  font-size: 11px;
}

.user-count:active {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.count-badge {
  background: #000080;
  color: white;
  border-radius: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}

.count-text {
  color: #000;
}

.dropdown-arrow {
  width: 12px;
  height: 12px;
  fill: #000;
  transition: transform 0.1s;
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.presence-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #c0c0c0;
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
  min-width: 180px;
  z-index: 1001;
}

.dropdown-header {
  padding: 6px 8px;
  font-weight: bold;
  color: #000;
  border-bottom: 2px solid #808080;
  font-size: 11px;
  background: #000080;
  color: #fff;
}

.empty-state {
  padding: 8px;
  color: #000;
  font-size: 11px;
  text-align: center;
}

.user-list {
  padding: 4px 0;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  transition: none;
}

.user-item:hover {
  background: #000080;
  color: #fff;
}

.user-item:hover .user-name {
  color: #fff;
}

.user-item.current-user {
  background: #808080;
}

.cursor-color,
.user-cursor-color {
  width: 10px;
  height: 10px;
  border-radius: 0;
  border: 1px solid #000;
}

.user-cursor-color {
  width: 12px;
  height: 12px;
}

.user-name {
  color: #000;
  font-size: 11px;
}

.you-label {
  color: #000;
  font-size: 10px;
  font-style: normal;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #c0c0c0;
  border: 1px solid #808080;
}

.logout-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #c0c0c0;
  color: #000;
  border: none;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
  cursor: pointer;
  transition: none;
  font-size: 11px;
}

.logout-button:active:not(:disabled) {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.logout-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.logout-icon {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}
</style>
