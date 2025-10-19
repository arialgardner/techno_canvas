<template>
  <div class="dashboard-container theme-win98">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="window">
        <div class="inner">
          <div class="header">
            <span class="title">Canvas Rooms</span>
          </div>
          <div class="content header-content">
            <div class="header-actions">
              <button @click="showCreateModal = true">
                Create New Room
              </button>
              <button @click="showGuestLog = true">
                📖 Guest Log
              </button>
              <div class="user-menu">
                <div class="user-info">
                  <span class="user-name">{{ user?.displayName || user?.email }}</span>
                </div>
                <button @click="handleSignOut">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <LoadingSpinner
      v-if="isLoading && canvasesList.length === 0"
      title="Loading Rooms..."
      message="Fetching your collaborative workspaces"
    />

    <!-- Empty State -->
    <EmptyState
      v-else-if="!isLoading && canvasesList.length === 0"
      type="dashboard"
      title="No Rooms Yet"
      message="Create your first room to start collaborating"
      class="dashboard-empty-state"
    >
      <button @click="showCreateModal = true" class="empty-state-button">
        Create Room
      </button>
    </EmptyState>

    <!-- Canvas Grid -->
    <div v-else class="canvas-grid">
      <div
        v-for="canvas in canvasesList"
        :key="canvas.id"
        class="canvas-card window"
      >
        <div class="inner">
          <div class="header">
            <span class="title">{{ canvas.name }}</span>
            <span
              v-if="canvas.owner === user.uid"
              class="owner-badge"
              title="You own this canvas"
            >
              Owner
            </span>
            <span
              v-else-if="getUserRole(canvas, user.uid) === 'editor'"
              class="editor-badge"
              title="You can edit this canvas"
            >
              Editor
            </span>
            <span
              v-else-if="getUserRole(canvas, user.uid) === 'viewer'"
              class="viewer-badge"
              title="You can view this canvas"
            >
              Viewer
            </span>
          </div>

          <div class="content">
            <!-- Thumbnail -->
            <div class="canvas-thumbnail">
              <span class="canvas-icon">🔗</span>
            </div>

            <div class="canvas-meta">
              <div>{{ formatDate(canvas.lastModified) }}</div>
            </div>

            <div class="canvas-actions" @click.stop>
              <button
                @click="openCanvas(canvas.id)"
                title="Open room"
                class="primary-button"
              >
                Open
              </button>
              <button
                v-if="canvas.owner === user.uid"
                @click="startRename(canvas)"
                title="Rename room"
              >
                Rename
              </button>
              <button
                v-if="canvas.owner === user.uid"
                @click="confirmDelete(canvas)"
                title="Delete room"
              >
                Delete
              </button>
              <button
                @click="shareCanvas(canvas)"
                title="Share room"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Canvas Modal -->
    <div v-if="showCreateModal" class="modal-overlay">
      <div class="window modal-window">
        <div class="inner">
          <div class="header">
            <span class="title">Create New Room</span>
          </div>

          <div class="content">
            <div class="form-group">
              <label for="canvas-name">Room Name:</label>
              <input
                id="canvas-name"
                v-model="newCanvasName"
                type="text"
                placeholder="Enter room name"
                @keyup.enter="handleCreateCanvas"
              />
            </div>

            <div class="modal-actions">
              <button @click="showCreateModal = false">
                Cancel
              </button>
              <button
                @click="handleCreateCanvas"
                :disabled="!newCanvasName || isCreating"
              >
                {{ isCreating ? 'Creating...' : 'Create Room' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Rename Canvas Modal -->
    <div v-if="renameCanvas" class="modal-overlay">
      <div class="window modal-window">
        <div class="inner">
          <div class="header">
            <span class="title">Rename Room</span>
          </div>

          <div class="content">
            <div class="form-group">
              <label for="rename-input">Room Name:</label>
              <input
                id="rename-input"
                v-model="renameCanvasName"
                type="text"
                @keyup.enter="handleRename"
              />
            </div>

            <div class="modal-actions">
              <button @click="renameCanvas = null">
                Cancel
              </button>
              <button
                @click="handleRename"
                :disabled="!renameCanvasName"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="deleteCanvas" class="modal-overlay">
      <div class="window modal-window">
        <div class="inner">
          <div class="header">
            <span class="title">Delete Room</span>
          </div>

          <div class="content">
            <p class="warning-text">
              Are you sure you want to delete "<strong>{{ deleteCanvas.name }}</strong>"?
            </p>
            <p class="warning-subtext">
              This action cannot be undone. All shapes and data will be permanently deleted.
            </p>

            <div class="modal-actions">
              <button @click="deleteCanvas = null">
                Cancel
              </button>
              <button
                @click="handleDelete"
                :disabled="isDeleting"
                class="danger-button"
              >
                {{ isDeleting ? 'Deleting...' : 'Delete Room' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Canvas Modal -->
    <div v-if="shareCanvasData" class="modal-overlay">
      <div class="window modal-window">
        <div class="inner">
          <div class="header">
            <span class="title">Share Room</span>
          </div>

          <div class="content">
            <div class="form-group">
              <label>Shareable Link:</label>
              <div class="share-link-row">
                <input
                  :value="getShareableLink(shareCanvasData.id)"
                  readonly
                  class="share-link"
                  ref="shareLinkInput"
                />
                <button @click="copyShareLink">
                  {{ linkCopied ? 'Copied!' : 'Copy' }}
                </button>
              </div>
            </div>

            <div class="share-info">
              Anyone with this link and an account can access this room with Editor permissions by default.
            </div>

            <div class="modal-actions">
              <button @click="shareCanvasData = null">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Guest Log Modal -->
    <GuestLog 
      v-if="showGuestLog"
      :isVisible="showGuestLog"
      @close="showGuestLog = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCanvases } from '../composables/useCanvases'
import { useAuth } from '../composables/useAuth'
import { useInactivityLogout } from '../composables/useInactivityLogout'
import LoadingSpinner from '../components/LoadingSpinner.vue'
import EmptyState from '../components/EmptyState.vue'
import GuestLog from '../components/GuestLog.vue'

const router = useRouter()
const { user, signOut } = useAuth()
const {
  canvases,
  isLoading,
  getUserCanvases,
  createCanvas,
  updateCanvas,
  deleteCanvas: deleteCanvasFromDb,
  getUserRole
} = useCanvases()

// Inactivity tracking - auto logout after 10 minutes
useInactivityLogout('dashboard')

// Canvas list
const canvasesList = computed(() => {
  return Array.from(canvases.value.values()).sort((a, b) => {
    return (b.lastModified?.toMillis?.() || 0) - (a.lastModified?.toMillis?.() || 0)
  })
})

// Create modal
const showCreateModal = ref(false)
const newCanvasName = ref('')
const isCreating = ref(false)

// Rename modal
const renameCanvas = ref(null)
const renameCanvasName = ref('')

// Delete modal
const deleteCanvas = ref(null)
const isDeleting = ref(false)

// Share modal
const shareCanvasData = ref(null)
const linkCopied = ref(false)
const shareLinkInput = ref(null)

// Guest log modal
const showGuestLog = ref(false)

// Load canvases on mount
onMounted(async () => {
  // Wait for auth to be ready
  if (!user.value) {
    // Wait a bit for auth to initialize
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  if (user.value) {
    // console.log('Loading canvases for user:', user.value.uid)
    await getUserCanvases(user.value.uid)
    // console.log('Loaded canvases:', canvases.value.size)
  } else {
    console.error('User not loaded after waiting')
  }
})

// Navigation
const openCanvas = (canvasId) => {
  // console.log('[Dashboard] Opening canvas:', canvasId)
  try {
    router.push({ name: 'Canvas', params: { canvasId } })
  } catch (error) {
    console.error('[Dashboard] Error navigating to canvas:', error)
    alert('Failed to open room. Please try again.')
  }
}

// Create canvas
const handleCreateCanvas = async () => {
  if (!newCanvasName.value || isCreating.value) return

  try {
    isCreating.value = true
    const canvas = await createCanvas(user.value.uid, user.value.displayName || user.value.email, {
      name: newCanvasName.value
    })

    // Reset form
    showCreateModal.value = false
    newCanvasName.value = ''

    // Navigate to new canvas
    openCanvas(canvas.id)
  } catch (error) {
    console.error('Error creating canvas:', error)
    alert('Failed to create room. Please try again.')
  } finally {
    isCreating.value = false
  }
}

// Rename canvas
const startRename = (canvas) => {
  renameCanvas.value = canvas
  renameCanvasName.value = canvas.name
}

const handleRename = async () => {
  if (!renameCanvasName.value || !renameCanvas.value) return

  try {
    await updateCanvas(renameCanvas.value.id, { name: renameCanvasName.value })
    renameCanvas.value = null
    renameCanvasName.value = ''
  } catch (error) {
    console.error('Error renaming canvas:', error)
    alert('Failed to rename room. Please try again.')
  }
}

// Delete canvas
const confirmDelete = (canvas) => {
  deleteCanvas.value = canvas
}

const handleDelete = async () => {
  if (!deleteCanvas.value || isDeleting.value) return

  try {
    isDeleting.value = true
    await deleteCanvasFromDb(deleteCanvas.value.id)
    deleteCanvas.value = null
  } catch (error) {
    console.error('Error deleting canvas:', error)
    alert('Failed to delete room. Please try again.')
  } finally {
    isDeleting.value = false
  }
}

// Share canvas
const shareCanvas = (canvas) => {
  shareCanvasData.value = canvas
  linkCopied.value = false
}

const getShareableLink = (canvasId) => {
  return `${window.location.origin}/canvas/${canvasId}`
}

const copyShareLink = async () => {
  if (!shareCanvasData.value) return

  try {
    const link = getShareableLink(shareCanvasData.value.id)
    await navigator.clipboard.writeText(link)
    linkCopied.value = true
    setTimeout(() => {
      linkCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('Error copying link:', error)
  }
}

// Sign out
const handleSignOut = async () => {
  try {
    await signOut()
    router.push({ name: 'Auth' })
  } catch (error) {
    console.error('Error signing out:', error)
    alert('Failed to sign out. Please try again.')
  }
}

// Format date
const formatDate = (timestamp) => {
  if (!timestamp) return 'Unknown'
  
  try {
    let date
    if (timestamp.toDate) {
      date = timestamp.toDate()
    } else if (timestamp instanceof Date) {
      date = timestamp
    } else {
      return 'Unknown'
    }

    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString()
  } catch (error) {
    return 'Unknown'
  }
}
</script>

<style lang="scss" scoped>
.dashboard-container {
  min-height: 100vh;
  height: 100vh;
  background: #000;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  gap: 20px;
}

.dashboard-header {
  width: 100%;
  flex-shrink: 0;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-info {
  padding: 4px 8px;
  background: #c0c0c0;
  border: 1px solid #808080;
  font-size: 11px;
}

.user-name {
  font-weight: normal;
}

.canvas-grid {
  width: 100%;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(440px, 1fr));
  gap: 16px;
  align-content: start;
  padding-bottom: 20px;
}

@media (min-width: 768px) {
  .canvas-grid {
    grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
  }
}

.canvas-card {
  cursor: pointer;
  transition: transform 0.1s;

  &:hover {
    transform: translate(-2px, -2px);
  }

  &:active {
    transform: translate(0, 0);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.owner-badge,
.editor-badge,
.viewer-badge {
  font-size: 9px;
  padding: 2px 4px;
  background: #c0c0c0;
  border: 1px solid #808080;
  flex-shrink: 0;
}

.canvas-thumbnail {
  width: 100%;
  height: 140px;
  background: #000080;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 2px solid #808080;
}

.canvas-icon {
  font-size: 48px;
}

.canvas-meta {
  font-size: 11px;
  margin: 8px 0;
  
  div {
    margin: 2px 0;
  }
}

.canvas-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #808080;

  button {
    flex: 1;
    padding: 4px 8px;
    font-size: 11px;
  }

  .primary-button {
    background: #000080;
    color: white;

    &:hover {
      background: #0000a0;
    }

    &:active {
      background: #000060;
    }
  }
}

.dashboard-empty-state {
  flex: 1;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.modal-window {
  max-width: 500px;
  width: 100%;
}

.form-group {
  margin-bottom: 12px;

  label {
    display: block;
    margin-bottom: 4px;
  }

  input {
    width: 100%;
    box-sizing: border-box;
  }
}

.modal-actions {
  display: flex;
  gap: 6px;
  margin-top: 16px;

  button {
    flex: 1;
  }
}

.share-link-row {
  display: flex;
  gap: 6px;

  .share-link {
    flex: 1;
  }

  button {
    flex: 0 0 auto;
    min-width: 80px;
  }
}

.share-info {
  margin-top: 12px;
  padding: 8px;
  background: #c0c0c0;
  border: 1px solid #808080;
  font-size: 11px;
}

.warning-text {
  font-size: 12px;
  margin: 0 0 8px;
}

.warning-subtext {
  font-size: 11px;
  margin: 0 0 12px;
  color: #666;
}

.danger-button {
  &:not(:disabled) {
    background: #c00;
    color: white;

    &:hover {
      background: #a00;
    }

    &:active {
      background: #800;
    }
  }
}
</style>


