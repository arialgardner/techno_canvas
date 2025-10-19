<template>
  <div class="canvas-container">
    <!-- Error message -->
    <div v-if="error && !isLoading" class="error-message">
      <p>{{ error }}</p>
      <button @click="error = null" class="dismiss-error">Dismiss</button>
    </div>

    <!-- Toolbar -->
    <Toolbar 
      @tool-selected="handleToolSelected" 
      @open-ai-modal="showAIModal = true"
    />

    <!-- Zoom Controls -->
    <ZoomControls 
      :zoom="zoomLevel"
      @zoom-in="handleZoomIn"
      @zoom-out="handleZoomOut"
      @zoom-reset="handleZoomReset"
    />

    <!-- Performance Monitor (shown with ?debug=performance) -->
    <PerformanceMonitor />

    <!-- Testing Dashboard (shown with ?testing=true) -->
    <TestingDashboard />

    <!-- Konva Canvas -->
    <div 
      ref="canvasWrapper" 
      class="canvas-wrapper" 
      :data-panning="activeTool === 'pan' ? 'true' : 'false'"
      :data-is-dragging="isPanning ? 'true' : 'false'"
      @click="handleCloseContextMenu"
    >
      <!-- Empty state when no shapes (outside Konva stage) -->
      <EmptyState 
        v-if="!isLoading && shapesList.length === 0"
        type="canvas"
        :title="`Welcome to ${currentCanvas?.name || 'Untitled'}!`"
        message="Enjoy your time"
        style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10; pointer-events: none;"
      />

      <v-stage
        ref="stage"
        :config="stageConfig"
        @wheel="handleWheel"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseLeave"
        @dblclick="handleDoubleClick"
        @contextmenu="handleContextMenu"
      >
        <v-layer ref="shapeLayer">
          <!-- Render visible shapes only (v5: viewport culling optimization) -->
          <template v-for="shape in visibleShapesList" :key="shape.id">
            <!-- Rectangles -->
            <Rectangle
              v-if="shape.type === 'rectangle'"
              :rectangle="shape"
              :is-selected="selectedShapeIds.includes(shape.id)"
              :active-tool="activeTool"
              :disable-drag="activeTool === 'pan' || (selectedShapeIds.length > 1 && selectedShapeIds.includes(shape.id))"
              @update="handleShapeUpdate"
              @select="handleShapeSelect"
            />
            
            <!-- Circles -->
            <Circle
              v-if="shape.type === 'circle'"
              :circle="shape"
              :is-selected="selectedShapeIds.includes(shape.id)"
              :active-tool="activeTool"
              :disable-drag="activeTool === 'pan' || (selectedShapeIds.length > 1 && selectedShapeIds.includes(shape.id))"
              @update="handleShapeUpdate"
              @select="handleShapeSelect"
            />
            
            <!-- Lines -->
            <Line
              v-if="shape.type === 'line'"
              :line="shape"
              :is-selected="selectedShapeIds.includes(shape.id)"
              :active-tool="activeTool"
              :disable-drag="activeTool === 'pan' || (selectedShapeIds.length > 1 && selectedShapeIds.includes(shape.id))"
              @update="handleShapeUpdate"
              @select="handleShapeSelect"
            />

            <!-- Text -->
            <TextShape
              v-if="shape.type === 'text'"
              :text="shape"
              :is-selected="selectedShapeIds.includes(shape.id)"
              :active-tool="activeTool"
              :disable-drag="activeTool === 'pan' || (selectedShapeIds.length > 1 && selectedShapeIds.includes(shape.id))"
              :editor-open="showTextEditor"
              @update="handleShapeUpdate"
              @edit="handleTextEdit"
              @select="handleShapeSelect"
            />
          </template>

          <!-- Marquee Selection Rectangle -->
          <v-rect
            v-if="selectionRect.visible"
            :config="{
              x: selectionRect.width < 0 ? selectionRect.x + selectionRect.width : selectionRect.x,
              y: selectionRect.height < 0 ? selectionRect.y + selectionRect.height : selectionRect.y,
              width: Math.abs(selectionRect.width),
              height: Math.abs(selectionRect.height),
              stroke: '#3B82F6',
              strokeWidth: 2,
              dash: [10, 5],
              fill: 'rgba(59, 130, 246, 0.1)',
              listening: false
            }"
          />

          <!-- Transformer for resize/rotate handles -->
          <v-transformer ref="transformer" />
        </v-layer>
      </v-stage>

      <!-- Remote User Cursors -->
      <UserCursor
        v-for="cursor in remoteCursors"
        :key="cursor.userId"
        :cursor="cursor"
        :stage-attrs="stageConfig"
      />

      <!-- Text Editor -->
      <TextEditor
        :is-visible="showTextEditor"
        :text-shape="editingText"
        :stage-position="stagePosition"
        :stage-scale="zoomLevel"
        @save="handleTextSave"
        @cancel="handleTextCancel"
      />

      <!-- Text Format Toolbar -->
      <TextFormatToolbar
        :is-visible="showFormatToolbar"
        :text-shape="editingText"
        :stage-position="stagePosition"
        :stage-scale="zoomLevel"
        @format-change="handleFormatChange"
      />

      <!-- Context Menu -->
      <ContextMenu
        :is-visible="contextMenuVisible"
        :position="contextMenuPosition"
        :has-selection="selectedShapeIds.length > 0"
        @bring-to-front="handleContextBringToFront"
        @bring-forward="handleContextBringForward"
        @send-backward="handleContextSendBackward"
        @send-to-back="handleContextSendToBack"
        @duplicate="handleContextDuplicate"
        @delete="handleContextDelete"
        @close="handleCloseContextMenu"
      />
    </div>
    
    <!-- Confirmation Modal (outside canvas-wrapper for proper z-index) -->
    <ConfirmModal
      :is-visible="confirmModalVisible"
      title="Delete Shapes"
      :message="confirmModalMessage"
      confirm-text="Delete"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
    />

    <!-- Properties Panel -->
    <PropertiesPanel
      :selected-shapes="selectedShapesData"
      :canvas-width="canvasWidth"
      :canvas-height="canvasHeight"
      :total-shapes="shapesList.length"
      @update-property="handleUpdateProperty"
      @update-canvas-size="handleUpdateCanvasSize"
      @bulk-update="handleBulkUpdate"
    />

    <!-- Recovery Modal -->
    <RecoveryModal
      :is-visible="showRecoveryModal"
      :recovery-age="recoveryMeta.age"
      :timestamp="recoveryMeta.ts"
      :is-restoring="false"
      @restore="handleRecover"
      @discard="handleDiscardRecovery"
    />

    <!-- Version History Modal (owner-only visibility handled by NavBar button) -->
    <VersionHistory
      :is-visible="showVersionHistory"
      :versions="versionsList"
      :is-loading="versionsLoading"
      :can-restore="canRestoreVersions"
      @close="handleCloseVersionHistory"
      @restore="handleRestoreVersion"
    />

    <!-- AI Command Panel (v6: AI-powered natural language commands) -->
    <AICommandPanel
      v-if="user"
      :visible="showAIModal"
      :context="aiContext"
      :canvas-id="canvasId"
      @command-executed="handleAICommandExecuted"
      @utility-action="handleAIUtilityAction"
      @close="showAIModal = false"
    />

    <!-- Spotify Sidebar (v7: Always-visible playlist browser) -->
    <SpotifySidebar ref="spotifySidebarRef" />

    <!-- Chat Log Widget (room-specific chat) -->
    <ChatLog :canvasId="canvasId" />

  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted, onBeforeUnmount, computed, watch, inject, provide, nextTick } from 'vue'
import VueKonva from 'vue-konva'
import Toolbar from '../components/Toolbar.vue'
import ZoomControls from '../components/ZoomControls.vue'
import Rectangle from '../components/Rectangle.vue'
import Circle from '../components/Circle.vue'
import Line from '../components/Line.vue'
import TextShape from '../components/TextShape.vue'
import TextEditor from '../components/TextEditor.vue'
import TextFormatToolbar from '../components/TextFormatToolbar.vue'
import ContextMenu from '../components/ContextMenu.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import UserCursor from '../components/UserCursor.vue'
import PerformanceMonitor from '../components/PerformanceMonitor.vue'
import Notifications from '../components/Notifications.vue'
import EmptyState from '../components/EmptyState.vue'
import TestingDashboard from '../components/TestingDashboard.vue'
import PropertiesPanel from '../components/PropertiesPanel.vue'
import RecoveryModal from '../components/RecoveryModal.vue'
import VersionHistory from '../components/VersionHistory.vue'
import AICommandPanel from '../components/AICommandPanel.vue'
import SpotifySidebar from '../components/SpotifySidebar.vue'
import ChatLog from '../components/ChatLog.vue'
import { useShapes } from '../composables/useShapes'
import { useFirestore } from '../composables/useFirestore' // v5: Batch operations
import { getMaxZIndex, DEFAULT_SHAPE_PROPERTIES } from '../types/shapes'
import { useAuth } from '../composables/useAuth'
import { useCanvases } from '../composables/useCanvases'
import { useCursorsRTDB } from '../composables/useCursorsRTDB'
import { usePresenceRTDB } from '../composables/usePresenceRTDB'
import { usePerformance } from '../composables/usePerformance'
import { usePerformanceMonitoring } from '../composables/usePerformanceMonitoring'
import { useConnectionState } from '../composables/useConnectionState'
import { useQueueProcessor } from '../composables/useQueueProcessor'
import { useStateReconciliation } from '../composables/useStateReconciliation'
import { useCrashRecovery } from '../composables/useCrashRecovery'
import { useVersions } from '../composables/useVersions'
import { useInactivityLogout } from '../composables/useInactivityLogout'
import { useViewportCulling } from '../composables/useViewportCulling' // v5: Rendering optimization
import { useBugFixes } from '../utils/bugFixUtils'
import { calculateRectPositionAfterRotation } from '../utils/rotationUtils'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useCanvasZoom } from '../composables/useCanvasZoom'
import { useCanvasSelection } from '../composables/useCanvasSelection'
import { useToolManager } from '../composables/useToolManager'
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts'
import { useGroupDrag } from '../composables/useGroupDrag'
import { useShapeTransform } from '../composables/useShapeTransform'
import { useContextMenu } from '../composables/useContextMenu'
import { useClipboard } from '../composables/useClipboard'
import { useTextEditor } from '../composables/useTextEditor'
import { useCanvasMouseEvents } from '../composables/useCanvasMouseEvents'

export default {
  name: 'CanvasView',
  components: {
    Toolbar,
    ZoomControls,
    Rectangle,
    Circle,
    Line,
    TextShape,
    TextEditor,
    TextFormatToolbar,
    ContextMenu,
    ConfirmModal,
    PropertiesPanel,
    RecoveryModal,
    VersionHistory,
    UserCursor,
    PerformanceMonitor,
    Notifications,
    EmptyState,
    TestingDashboard,
    AICommandPanel,
    SpotifySidebar,
    ChatLog
  },
  setup() {
    // Router
    const route = useRoute()
    const router = useRouter()
    const canvasId = computed(() => route.params.canvasId || 'default')
    
    // Inject triggers from App.vue
    const versionHistoryTrigger = inject('versionHistoryTrigger', ref(0))
    const saveVersionTrigger = inject('saveVersionTrigger', ref(0))
    
    // Ref to SpotifySidebar for accessing child methods
    const spotifySidebarRef = ref(null)
    
    // Provide Spotify playlist loader for ChatLog
    // This bridges the connection between sibling components
    provide('loadSpotifyPlaylist', async (url) => {
      if (spotifySidebarRef.value?.spotifyEmbedRef?.loadPlaylistFromUrl) {
        return await spotifySidebarRef.value.spotifyEmbedRef.loadPlaylistFromUrl(url)
      }
      return false
    })
    
    // Composables
    const { user } = useAuth()
    
    // Computed property for user name
    const userName = computed(() => {
      if (!user.value) return 'Anonymous'
      return user.value.displayName || user.value.email?.split('@')[0] || 'Anonymous'
    })
    
    const {
      currentCanvas,
      getCanvas,
      updateCanvas,
      subscribeToCanvas,
      unsubscribeFromCanvas,
      getUserRole,
      canEdit: canEditCanvas,
      canManagePermissions,
      canDelete: canDeleteCanvas,
      grantAccessFromLink,
      isLoading: canvasLoading,
      error: canvasError
    } = useCanvases()
    
    const { 
      shapes,
      shapesVersion,
      createShape,
      updateShape,
      getAllShapes,
      loadShapesFromFirestore,
      startRealtimeSync, 
      stopRealtimeSync,
      pauseSync, // v5: Bulk operation support
      resumeSync, // v5: Bulk operation support
      isLoading, 
      error,
      isConnected,
      isSyncing,
      // Text lock management
      isTextLocked,
      acquireTextLock,
      releaseTextLock,
      getLockedTextOwner,
      // Layer operations
      bringToFront,
      sendToBack,
      bringForward,
      sendBackward,
      // Delete operations
      deleteShapes,
      // Duplicate operations
      duplicateShapes
    } = useShapes()
    
    // v5: Batch operations and snapshot support for version restore
    const { saveShapesBatch, updateShapesBatch, deleteShapesBatch, loadCanvasSnapshot, updateCanvasSnapshot } = useFirestore()
    
    // v8: Using Firebase Realtime Database for cursors and presence (required for sync)
    console.log(`[v8] Using Realtime DB for cursors and presence`)
    
    // Cursor composable - using RTDB for real-time updates
    const {
      cursors,
      updateCursorPosition,
      subscribeToCursors,
      cleanup: cleanupCursors,
      removeCursor,
      screenToCanvas,
      getAllCursors,
      cleanupStaleCursors
    } = useCursorsRTDB()
    
    // Presence composable - using RTDB for consistent presence tracking
    const {
      setUserOnline,
      setUserOffline,
      subscribeToPresence,
      getActiveUserCount,
      cleanupStalePresence,
      cleanup: cleanupPresence
    } = usePresenceRTDB()
    
    const { measureRender, throttle, logPerformanceSummary } = usePerformance()
    const { state: connectionState, setSyncHandler } = useConnectionState()
    const { processQueue } = useQueueProcessor()
    const { reconcile, startPeriodic, stopPeriodic, triggerOnVisibilityChange } = useStateReconciliation()
    const { saveSnapshot, loadSnapshot, clearSnapshot } = useCrashRecovery()
    const { isLoading: versionsLoading, versions: versionsList, listVersions, createVersion } = useVersions()

    // Inactivity tracking - auto logout after 10 minutes
    useInactivityLogout(canvasId)

    // Refs
    const stage = ref(null)
    const canvasWrapper = ref(null)
    const shapeLayer = ref(null)

    // Canvas configuration
    const CANVAS_SIZE = 3000 // Virtual canvas size
    const MIN_ZOOM = 0.25
    const MAX_ZOOM = 3
    const ZOOM_FACTOR = 1.05

    // Reactive state
    const stageSize = reactive({
      width: window.innerWidth,
      height: window.innerHeight - 70 // Account for navbar height
    })

    const stagePosition = reactive({
      x: 0,
      y: 0
    })

    const isDragging = ref(false)
    const isPanning = ref(false) // Separate panning state
    const lastPointerPosition = reactive({ x: 0, y: 0 })
    const showVersionHistory = ref(false)
    const canRestoreVersions = computed(() => true) // owner-only checked via NavBar button visibility
    
    // AI Panel state - load from localStorage to persist across refreshes (per-canvas)
    const getAIPanelVisibleKey = (id) => `ai-panel-visible-${id}`
    const savedAIPanelState = localStorage.getItem(getAIPanelVisibleKey(canvasId.value))
    const showAIModal = ref(savedAIPanelState === 'true')
    
    // Watch for changes to AI panel visibility and save to localStorage (canvas-specific)
    watch(showAIModal, (newValue) => {
      localStorage.setItem(getAIPanelVisibleKey(canvasId.value), String(newValue))
    })
    
    // Watch for canvas changes and reload AI panel visibility for the new canvas
    watch(canvasId, (newCanvasId) => {
      const savedState = localStorage.getItem(getAIPanelVisibleKey(newCanvasId))
      showAIModal.value = savedState === 'true'
    })
    
    // Viewer mode - computed based on canvas permissions
    const isViewerMode = computed(() => {
      if (!currentCanvas.value || !user.value) return false
      const role = getUserRole(currentCanvas.value, user.value.uid)
      return role === 'viewer'
    })
    
    // Shape state (needed before viewport culling)
    const shapesList = computed(() => getAllShapes())

    // v5: Viewport culling for rendering optimization (must be before useCanvasZoom)
    const { 
      visibleShapeIds, 
      updateVisibleShapes, 
      isVisible: isShapeVisible,
      getVisibilityRatio 
    } = useViewportCulling(stage)
    
    // Computed list of shapes to render (with culling for large canvases)
    const visibleShapesList = computed(() => {
      const allShapes = shapesList.value
      
      // Only apply culling if we have 100+ shapes
      if (allShapes.length < 100) {
        return allShapes
      }
      
      // Filter to only visible shapes
      return allShapes.filter(shape => isShapeVisible(shape.id))
    })
    
    // v5 Bug fix: Update viewport culling when shapes are added/removed
    watch(shapesList, (newShapes) => {
      if (newShapes.length >= 100) {
        updateVisibleShapes(newShapes)
      }
    })

    // Initialize composables
    // Zoom composable (needs updateVisibleShapes from viewport culling)
    const {
      zoomLevel,
      handleZoomIn,
      handleZoomOut,
      handleZoomReset: zoomReset,
      handleWheel,
      zoomAtPoint
    } = useCanvasZoom(stage, stagePosition, stageSize, updateVisibleShapes, shapesList)
    
    // Wrap handleZoomReset to pass CANVAS_SIZE
    const handleZoomReset = () => zoomReset(CANVAS_SIZE)
    
    // Tool manager composable
    const {
      activeTool,
      isCreatingLine,
      lineStartPoint,
      handleToolSelected: toolSelected,
      startLineCreation,
      endLineCreation
    } = useToolManager(canvasWrapper, isViewerMode)
    
    const handleToolSelected = toolSelected
    
    const canUserEdit = computed(() => {
      if (!currentCanvas.value || !user.value) return false
      return canEditCanvas(currentCanvas.value, user.value.uid)
    })
    
    // Check if user has any canvas access (owner, editor, or viewer)
    const hasCanvasAccess = computed(() => {
      if (!currentCanvas.value || !user.value) return false
      const role = getUserRole(currentCanvas.value, user.value.uid)
      return role !== null // User has any role
    })

    // Selection composable
    const transformer = ref(null)
    const {
      selectedShapeIds,
      isSelecting,
      selectionRect,
      handleShapeSelect: shapeSelect,
      clearSelection,
      updateTransformer,
      startMarqueeSelection,
      updateMarqueeSelection,
      finalizeMarqueeSelection,
      selectAll
    } = useCanvasSelection(stage, transformer, shapes)
    
    const handleShapeSelect = (shapeId, event) => shapeSelect(shapeId, event, activeTool.value)
    
    // Group drag composable
    const {
      isDraggingGroup,
      groupDragStart,
      groupDragInitialPositions,
      startGroupDrag,
      updateGroupDrag,
      endGroupDrag,
      cancelGroupDrag
    } = useGroupDrag()

    // Context menu composable
    const {
      contextMenuVisible,
      contextMenuPosition,
      handleContextMenu,
      handleCloseContextMenu,
      handleContextBringToFront,
      handleContextBringForward,
      handleContextSendBackward,
      handleContextSendToBack,
      handleContextDuplicate
    } = useContextMenu({
      selectedShapeIds,
      bringToFront,
      sendToBack,
      bringForward,
      sendBackward,
      duplicateShapes,
      updateTransformer,
      user,
      canvasId
    })
    
    // Clipboard composable
    const {
      clipboard,
      hasClipboard,
      handleCopy: handleContextCopy,
      handlePaste: handleContextPaste
    } = useClipboard(shapes, createShape, selectedShapeIds, updateTransformer, user, canvasId, userName)
    
    // Text editor composable
    const {
      editingTextId,
      showTextEditor,
      showFormatToolbar,
      editingText,
      handleTextEdit,
      handleTextSave,
      handleTextCancel,
      handleFormatChange
    } = useTextEditor({
      shapes,
      isTextLocked,
      acquireTextLock,
      releaseTextLock,
      getLockedTextOwner,
      updateShape,
      user,
      canvasId,
      userName
    })
    
    // Confirmation modal state
    const confirmModalVisible = ref(false)
    const confirmModalMessage = ref('')
    const pendingDeleteIds = ref([])
    const showRecoveryModal = ref(false)
    const recoveryMeta = ref({ age: '', ts: 0 })

    // Cursor state
    const allRemoteCursors = computed(() => getAllCursors())
    
    // Filter cursors to only show those within canvas bounds
    const remoteCursors = computed(() => {
      const cursors = allRemoteCursors.value
      
      // Get actual canvas wrapper dimensions from DOM element
      if (!canvasWrapper.value) {
        return [] // No cursors if canvas wrapper not mounted yet
      }
      
      const wrapperRect = canvasWrapper.value.getBoundingClientRect()
      const canvasWrapperWidth = wrapperRect.width
      const canvasWrapperHeight = wrapperRect.height
      
      return cursors.filter(cursor => {
        // Convert canvas coordinates to screen coordinates
        const canvasX = cursor.x || 0
        const canvasY = cursor.y || 0
        
        const scaleX = stageConfig.value.scaleX || 1
        const scaleY = stageConfig.value.scaleY || 1
        const offsetX = stageConfig.value.x || 0
        const offsetY = stageConfig.value.y || 0
        
        const screenX = canvasX * scaleX + offsetX
        const screenY = canvasY * scaleY + offsetY
        
        // Check if cursor is within canvas wrapper bounds
        // Use tighter bounds (20px margin) to prevent overflow onto properties panel
        return screenX >= -20 && 
               screenX <= canvasWrapperWidth - 20 && 
               screenY >= -20 && 
               screenY <= canvasWrapperHeight + 20
      })
    })
    
    const activeUserCount = computed(() => getActiveUserCount())

    // Performance metrics: update counts (rendered == total for now)
    watch([shapesList], () => {
      try {
        const perf = usePerformanceMonitoring()
        perf.updateShapeMetrics(shapesList.value.length, shapesList.value.length)
      } catch {}
    }, { immediate: true })
    const isMouseOverCanvas = ref(false)
    // Periodic timer reference
    let periodicTimer = null

    // Stage configuration
    const stageConfig = computed(() => ({
      width: stageSize.width,
      height: stageSize.height,
      x: stagePosition.x,
      y: stagePosition.y,
      scaleX: zoomLevel.value,
      scaleY: zoomLevel.value,
      draggable: false // We'll handle dragging manually for better control
    }))

    // (Duplicate AI context and handlers removed; existing v6 integration is retained below.)

    // Initialize canvas position (centered)
    const centerCanvas = () => {
      const centerX = (stageSize.width - CANVAS_SIZE * zoomLevel.value) / 2
      const centerY = (stageSize.height - CANVAS_SIZE * zoomLevel.value) / 2
      
      stagePosition.x = centerX
      stagePosition.y = centerY
    }

    // Handle cursor tracking when mouse moves over canvas
    // This callback is passed to useCanvasMouseEvents and called on every mouse move
    const handleCursorMove = (canvasX, canvasY) => {
      if (!user.value) return
      
      // Get user info
      const userId = user.value.uid
      const userName = user.value.displayName || user.value.email?.split('@')[0] || 'Anonymous'
      const cursorColor = '#667eea' // Will get from user profile later
      
      // Update cursor position (throttled in useCursorsRTDB)
      updateCursorPosition(canvasId.value, userId, canvasX, canvasY, userName, cursorColor)
    }

    // Handle mouse entering canvas
    const handleMouseEnter = () => {
      isMouseOverCanvas.value = true
    }


    // Context menu handlers
    const handleContextSelectAll = () => {
      selectAll(getAllShapes())
    }

    const handleContextDelete = () => {
      if (selectedShapeIds.value.length === 0) return
      
      // Show confirmation modal if >5 shapes are selected
      if (selectedShapeIds.value.length > 5) {
        pendingDeleteIds.value = [...selectedShapeIds.value]
        confirmModalMessage.value = `Are you sure you want to delete ${selectedShapeIds.value.length} shapes? `
        confirmModalVisible.value = true
      } else {
        // Delete immediately if <=5 shapes
        performDelete(selectedShapeIds.value)
      }
    }
    
    const performDelete = async (shapeIds) => {
      await deleteShapes(shapeIds, canvasId.value)
      clearSelection()
    }
    
    const handleConfirmDelete = async () => {
      await performDelete(pendingDeleteIds.value)
      confirmModalVisible.value = false
      pendingDeleteIds.value = []
    }
    
    const handleCancelDelete = () => {
      confirmModalVisible.value = false
      pendingDeleteIds.value = []
    }


    // Shape transform composable
    const {
      resizingShapes,
      handleTransform: transformShape,
      handleTransformEnd: transformShapeEnd
    } = useShapeTransform(shapes, updateShape, userName)
    
    // Wrapper functions to pass additional params
    const handleTransform = (e) => transformShape(e, user, canvasId)
    const handleTransformEnd = async (e) => await transformShapeEnd(e, user, canvasId, shapeLayer)

    // Keyboard shortcuts composable (must be before mouse events)
    const versionOpsCounterRef = ref(0)
    const {
      isSpacebarPressed,
      setupKeyboardListeners,
      cleanupKeyboardListeners,
      handleKeyDown: keyboardKeyDown
    } = useKeyboardShortcuts({
      clearSelection,
      handleTextCancel,
      bringToFront,
      sendToBack,
      bringForward,
      sendBackward,
      selectedShapeIds,
      user,
      canvasId,
      handleContextCopy,
      handleContextPaste,
      clipboard,
      duplicateShapes,
      showTextEditor,
      performDelete,
      shapes,
      updateShape,
      updateShapesBatch,
      userName,
      createVersion,
      versionOpsCounter: versionOpsCounterRef
    })
    
    // Wrapper to handle keyboard shortcuts and update cursor
    const handleSpacebarState = () => {
      if (canvasWrapper.value && activeTool.value === 'select') {
        if (isSpacebarPressed.value && !isPanning.value) {
          canvasWrapper.value.style.cursor = 'grab'
        } else if (!isSpacebarPressed.value && !isPanning.value) {
          canvasWrapper.value.style.cursor = 'default'
        }
      }
    }
    
    // Watch spacebar state to update cursor
    watch(isSpacebarPressed, handleSpacebarState)
    
    // Keyboard handler for global shortcuts - wrapper for composable
    const handleKeyDown = async (e) => {
      const result = await keyboardKeyDown(e)
      
      // Handle special return cases that need parent processing
      if (result === true) {
        // Select all command
        selectAll(getAllShapes())
        return
      }
      
      if (result && Array.isArray(result)) {
        // Duplicate command returned new IDs
        selectedShapeIds.value = result
        updateTransformer()
        return
      }
      
      if (result && result.action === 'delete') {
        // Delete command needs confirmation handling
        if (result.shapeIds.length > 5) {
          pendingDeleteIds.value = [...result.shapeIds]
          confirmModalMessage.value = `Are you sure you want to delete ${result.shapeIds.length} shapes?`
          confirmModalVisible.value = true
        } else {
          await performDelete(result.shapeIds)
        }
        return
      }
    }

    // Mouse events composable
    const {
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleMouseLeave,
      handleDoubleClick
    } = useCanvasMouseEvents({
      stage,
      stageConfig,
      stagePosition,
      canvasWrapper,
      activeTool,
      isViewerMode,
      canUserEdit,
      selectedShapeIds,
      clearSelection,
      startGroupDrag,
      shapes,
      user,
      canvasId,
      userName,
      createShape,
      isCreatingLine,
      lineStartPoint,
      startLineCreation,
      endLineCreation,
      handleTextEdit,
      showTextEditor,
      isPanning,
      isDragging,
      isDraggingGroup,
      lastPointerPosition,
      isSpacebarPressed,
      startMarqueeSelection,
      updateMarqueeSelection,
      updateGroupDrag,
      updateShape,
      finalizeMarqueeSelection,
      shapesList,
      endGroupDrag,
      updateShapesBatch,
      updateTransformer,
      isSelecting,
      updateVisibleShapes,
      onCursorMove: handleCursorMove // Pass cursor tracking callback
    })



    // Generic shape update handler
    const handleShapeUpdate = async (shapeUpdate) => {
      const { id, saveToFirestore, ...updates } = shapeUpdate
      const userId = user.value?.uid || 'anonymous'
      
      // Always update local state immediately for smooth dragging
      await updateShape(id, updates, userId, canvasId.value, false, false, userName.value)
      
      // Save to Firestore only when saveToFirestore flag is true (e.g., on drag end)
      // v3: isFinal=true for high priority when saveToFirestore is true
      if (saveToFirestore) {
        console.log(`Shape ${id} updated:`, updates)
        await updateShape(id, updates, userId, canvasId.value, true, true, userName.value)
      }
    }


    // Global mouseup to finalize selection if user releases outside the stage
    const handleWindowMouseUp = async (e) => {
      // Handle group drag completion (multi-select drag)
      if (isDraggingGroup.value && stage.value) {
        const pointer = stage.value.getNode().getPointerPosition()
        if (pointer) {
          const stageAttrs = stage.value.getNode().attrs
          const canvasX = (pointer.x - stageAttrs.x) / stageAttrs.scaleX
          const canvasY = (pointer.y - stageAttrs.y) / stageAttrs.scaleY
          
          const userId = user.value?.uid || 'anonymous'
          await endGroupDrag(canvasX, canvasY, selectedShapeIds.value, updateShapesBatch, canvasId.value, userId, userName.value)
          
          if (canvasWrapper.value) {
            canvasWrapper.value.style.cursor = 'default'
          }
          updateTransformer()
        }
      }
      
      // Mirror finalize logic so selection commits on release without extra click
      if (isSelecting.value) {
        finalizeMarqueeSelection(shapesList.value)
      }

      // End any panning state
      if (isPanning.value || isDragging.value) {
        isDragging.value = false
        isPanning.value = false
        if (canvasWrapper.value) {
          if (activeTool.value === 'select') {
            canvasWrapper.value.style.cursor = 'default'
          } else if (activeTool.value === 'pan') {
            canvasWrapper.value.style.cursor = 'grab'
          } else {
            // Text and shape tools use default cursor
            canvasWrapper.value.style.cursor = 'default'
          }
        }
      }
      
      // Stop any Konva shape dragging (individual shapes)
      if (stage.value) {
        const stageNode = stage.value.getNode()
        // Find any shape that's currently being dragged and stop it
        const allShapes = stageNode.find('Circle,Rect,Line,Text')
        allShapes.forEach(shapeNode => {
          try {
            if (typeof shapeNode.isDragging === 'function' && shapeNode.isDragging()) {
              shapeNode.stopDrag()
            }
          } catch (err) {
            console.warn('Error stopping shape drag:', err)
          }
        })
      }
    }

    // Handle window resize
    const handleResize = () => {
      stageSize.width = window.innerWidth
      stageSize.height = window.innerHeight - 70 // Account for navbar
      
      // Force re-computation of cursor filtering by triggering reactive updates
      // This ensures cursors are properly filtered after resize
      if (remoteCursors.value) {
        // Access remoteCursors to trigger recomputation
        remoteCursors.value.length
      }
    }

    // Lifecycle
    onMounted(async () => {
      // Register sync handler for ConnectionStatus "Sync Now"
      setSyncHandler(async () => {
        await processQueue()
        await reconcile(canvasId.value, shapes)
      })
      // Set initial canvas position
      centerCanvas()
      
      // Add resize listener
      window.addEventListener('resize', handleResize)
      
      // Setup keyboard listeners via composable
      setupKeyboardListeners()
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('mouseup', handleWindowMouseUp)

      // Initial snapshot on open
      try {
        const shapesArray = Array.from(shapes.values())
        if (shapesArray.length > 0 && user.value?.uid) {
          await createVersion(canvasId.value, user.value.uid, userName.value, shapesArray, 'initial')
        }
      } catch (e) {
        console.error('Initial version save failed:', e)
      }
      
      // Set initial cursor - add null check
      if (canvasWrapper.value) {
        canvasWrapper.value.style.cursor = 'default'
      }
      
      // Set up transformer event listeners
      nextTick(() => {
        if (transformer.value) {
          const transformerNode = transformer.value.getNode()
          transformerNode.on('transform', handleTransform) // During transform (throttled)
          transformerNode.on('transformend', handleTransformEnd) // On transform end (save)
        }
      })
      
      // Load canvas metadata first
      try {
        console.log(`🎨 Loading canvas: ${canvasId.value}`)
        await getCanvas(canvasId.value)
        console.log('✅ Canvas loaded:', currentCanvas.value)
        
        // Check if user has access
        if (!currentCanvas.value) {
          console.error('❌ Canvas not found')
          router.push({ name: 'Dashboard' })
          return
        }
        
        let userRole = getUserRole(currentCanvas.value, user.value.uid)
        
        // If user doesn't have access, grant editor permissions via shared link
        if (!userRole) {
          console.log('🔗 User accessing canvas via shared link - granting editor access')
          try {
            await grantAccessFromLink(canvasId.value, user.value.uid)
            userRole = 'editor'
            console.log(`✅ Granted editor access to user ${user.value.uid}`)
          } catch (error) {
            console.error('❌ Failed to grant access from link:', error)
            alert('Unable to access this canvas. Please check the link and try again.')
            router.push({ name: 'Dashboard' })
            return
          }
        }
        
        console.log(`✅ User role: ${userRole}`)
        
        // Subscribe to canvas updates
        subscribeToCanvas(canvasId.value)
        
        // Load existing shapes from Firestore
        console.log('🔄 Loading shapes from Firestore...')
        await loadShapesFromFirestore(canvasId.value)
        console.log(`✅ Loaded ${shapesList.value.length} shapes successfully`)
        
        // Start real-time synchronization after initial load
        console.log('🔄 Starting real-time sync...')
        startRealtimeSync(canvasId.value, user.value?.uid)
        console.log('✅ Real-time sync started')
      } catch (err) {
        console.error('❌ Failed to load canvas/shapes on mount:', err)
        // Check if it's a permission error
        if (err.message && (err.message.includes('not found') || err.message.includes('permission'))) {
          router.push({ name: 'Dashboard' })
          return
        }
        // Continue without shapes - user can still create new ones
        // Still start real-time sync for new shapes
        try {
          startRealtimeSync(canvasId.value, user.value?.uid)
        } catch (syncErr) {
          console.error('❌ Failed to start sync:', syncErr)
        }
      }

      // Start cursor tracking if user is authenticated
      if (user.value) {
        subscribeToCursors(canvasId.value, user.value.uid)
        
        // Set user online for presence
        const userName = user.value.displayName || user.value.email?.split('@')[0] || 'Anonymous'
        const cursorColor = '#667eea' // Will get from user profile later
        await setUserOnline(canvasId.value, user.value.uid, userName, cursorColor)
        
        // Subscribe to presence updates
        subscribeToPresence(canvasId.value, user.value.uid)
      }

      // Note: Cursor tracking is now handled by useCanvasMouseEvents via onCursorMove callback
      // Add mouse leave handler for cursor cleanup
      if (canvasWrapper.value) {
        canvasWrapper.value.addEventListener('mouseleave', handleMouseLeave)
      }

      // Start periodic reconciliation and tab-visibility reconciliation
      startPeriodic(canvasId.value, shapes, () => [], 60000)
      triggerOnVisibilityChange(canvasId.value, shapes, () => [])
      // Periodic version save every 5 minutes
      const savePeriodic = async () => {
        try {
          const shapesArray = Array.from(shapes.values())
          if (shapesArray.length > 0 && user.value?.uid) {
            await createVersion(canvasId.value, user.value.uid, userName.value, shapesArray, 'periodic')
          }
        } catch (e) {
          console.error('Periodic version save failed:', e)
        }
      }
      periodicTimer = window.setInterval(savePeriodic, 5 * 60 * 1000)

      // Crash recovery detection on mount
      const rec = loadSnapshot(canvasId.value)
      if (rec && rec.timestamp && Date.now() - rec.timestamp < 5 * 60 * 1000) {
        // Offer recovery if < 5 minutes old
        const ageMin = Math.max(1, Math.round((Date.now() - rec.timestamp) / 60000))
        recoveryMeta.value = { age: `${ageMin} minute(s) ago`, ts: rec.timestamp }
        showRecoveryModal.value = true
      } else if (rec) {
        // Stale, clear
        clearSnapshot(canvasId.value)
      }
    })

    // Watch for version history trigger from navbar
    watch(versionHistoryTrigger, async () => {
      if (versionHistoryTrigger.value > 0) {
        showVersionHistory.value = true
        try {
          await listVersions(canvasId.value)
        } catch (e) {
          console.error('Failed to load versions:', e)
        }
      }
    })

    // Watch for save version trigger from navbar
    watch(saveVersionTrigger, async () => {
      if (saveVersionTrigger.value > 0 && user.value?.uid) {
        try {
          const shapesArray = Array.from(shapes.values())
          if (shapesArray.length > 0) {
            await createVersion(canvasId.value, user.value.uid, userName.value, shapesArray, 'manual')
            await listVersions(canvasId.value)
          }
        } catch (e) {
          console.error('Save version failed:', e)
        }
      }
    })

    // Navigation guard - cleanup when navigating away
    onBeforeRouteLeave((to, from, next) => {
      console.log('🚪 Navigation guard triggered')
      const userId = user.value?.uid
      
      if (userId && canvasId.value) {
        console.log('🚪 Cleaning up presence and cursor for user:', userId)
        
        // Remove presence and cursor immediately (fire and forget)
        setUserOffline(canvasId.value, userId).catch(err => {
          console.error('Error setting user offline during navigation:', err)
        })
        removeCursor(canvasId.value, userId).catch(err => {
          console.error('Error removing cursor during navigation:', err)
        })
      }
      
      // Always allow navigation to proceed
      console.log('✅ Allowing navigation to:', to.name)
      next()
    })

    // Cleanup before component unmounts (e.g., when navigating away)
    onBeforeUnmount(() => {
      const userId = user.value?.uid
      
      if (userId) {
        console.log('🚪 Component unmounting - final cleanup')
        
        // Remove presence and cursor synchronously
        // Note: setUserOffline and removeCursor are async, but we call them
        // without await so they fire immediately. The Firebase SDK will handle
        // them even if the component unmounts.
        setUserOffline(canvasId.value, userId).catch(err => {
          console.error('Error setting user offline:', err)
        })
        removeCursor(canvasId.value, userId).catch(err => {
          console.error('Error removing cursor:', err)
        })
      }
      
      // Stop all intervals and subscriptions immediately
      stopRealtimeSync()
      stopPeriodic()
      
      // Clear periodic timer
      try { window.clearInterval(periodicTimer) } catch {}
    })

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
      cleanupKeyboardListeners()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('mouseup', handleWindowMouseUp)
      
      // Clean up canvas subscription
      unsubscribeFromCanvas()
      
      // Clean up cursor tracking (this will unsubscribe from listeners)
      const userId = user.value?.uid
      cleanupCursors(canvasId.value, userId)
      
      // Clean up presence tracking (this will unsubscribe from listeners)
      cleanupPresence(canvasId.value, userId)
      
      // Remove cursor event listeners
      if (canvasWrapper.value) {
        canvasWrapper.value.removeEventListener('mouseleave', handleMouseLeave)
      }
    })

    // Computed properties for properties panel
    const selectedShapesData = computed(() => {
      // Force reactivity by accessing shapesVersion (incremented on any shape update)
      const _ = shapesVersion.value
      return selectedShapeIds.value.map(id => shapes.get(id)).filter(Boolean)
    })

    const canvasWidth = ref(3000)
    const canvasHeight = ref(3000)
    
    // Watch for canvas metadata changes and update dimensions
    watch(currentCanvas, (newCanvas) => {
      if (newCanvas) {
        canvasWidth.value = newCanvas.width || 3000
        canvasHeight.value = newCanvas.height || 3000
      }
    }, { immediate: true })

    // Watch for canvas ID changes (when switching between canvases)
    // Clean up old canvas presence/cursor before loading new canvas
    watch(canvasId, async (newCanvasId, oldCanvasId) => {
      const userId = user.value?.uid
      
      if (userId && oldCanvasId && oldCanvasId !== newCanvasId) {
        console.log(`🔄 Switching from canvas ${oldCanvasId} to ${newCanvasId}`)
        
        try {
          // Clean up presence and cursor from old canvas
          await Promise.all([
            setUserOffline(oldCanvasId, userId),
            removeCursor(oldCanvasId, userId)
          ])
          
          // The new canvas will set up presence/cursor in onMounted
          console.log(`✅ Cleaned up old canvas: ${oldCanvasId}`)
        } catch (error) {
          console.error('Error cleaning up old canvas:', error)
        }
      }
    })

    // Connection status constants
    const CONNECTION_STATUS = {
      CONNECTED: 'connected',
      OFFLINE: 'offline',
      ERROR: 'error'
    }

    // Watch for connection state changes to handle reconnection
    let previousConnectionStatus = ref(connectionState.status)
    watch(() => connectionState.status, async (newStatus, oldStatus) => {
      const userId = user.value?.uid
      
      // Only handle reconnection when moving from offline/error to connected
      if (
        userId && 
        canvasId.value && 
        (oldStatus === CONNECTION_STATUS.OFFLINE || oldStatus === CONNECTION_STATUS.ERROR) &&
        newStatus === CONNECTION_STATUS.CONNECTED
      ) {
        console.log('🔄 Connection restored - re-establishing presence and cursors')
        
        try {
          // Re-establish user's own presence
          const userName = user.value.displayName || user.value.email?.split('@')[0] || 'Anonymous'
          const cursorColor = '#667eea'
          
          await setUserOnline(canvasId.value, userId, userName, cursorColor)
          console.log('✅ Presence re-established after reconnection')
          
          // Re-subscribe to presence updates immediately
          // The subscription's first snapshot will clear and rebuild from server state
          subscribeToPresence(canvasId.value, userId)
          console.log('✅ Presence subscription refreshed')
          
          // Re-subscribe to cursors
          subscribeToCursors(canvasId.value, userId)
          console.log('✅ Cursor subscription refreshed')
          
          // Force a stale cleanup check after reconnection settles
          // This catches any edge cases where presence is still out of sync
          setTimeout(() => {
            console.log('🔄 Running post-reconnection cleanup check')
            cleanupStalePresence()
          }, 2000)
          
        } catch (error) {
          console.error('❌ Error re-establishing presence after reconnection:', error)
        }
      }
      
      previousConnectionStatus.value = newStatus
    })

    // Properties panel handlers
    const handleUpdateProperty = ({ shapeId, property, value, additionalUpdates }) => {
      if (!shapeId) return
      
      // Validate value based on property
      let validatedValue = value
      
      // Rotation wraparound
      if (property === 'rotation') {
        validatedValue = ((value % 360) + 360) % 360
      }
      
      // Minimum constraints
      if (property === 'width' && validatedValue < 10) validatedValue = 10
      if (property === 'height' && validatedValue < 10) validatedValue = 10
      if (property === 'radius' && validatedValue < 5) validatedValue = 5
      
      // Canvas bounds
      if (property === 'x' && validatedValue < 0) validatedValue = 0
      if (property === 'y' && validatedValue < 0) validatedValue = 0
      if (property === 'x' && validatedValue > canvasWidth.value) validatedValue = canvasWidth.value
      if (property === 'y' && validatedValue > canvasHeight.value) validatedValue = canvasHeight.value
      
      // Build updates object with primary property
      let updates = { [property]: validatedValue }
      
      // Merge additional updates (e.g., x,y from rotation calculations)
      if (additionalUpdates) {
        updates = { ...updates, ...additionalUpdates }
      }
      
      // Update the shape
      const userId = user.value?.uid || 'anonymous'
      updateShape(shapeId, updates, userId, canvasId.value, true, true, userName.value)
    }

    const handleBulkUpdate = ({ shapeIds, property, value }) => {
      shapeIds.forEach(shapeId => {
        handleUpdateProperty({ shapeId, property, value })
      })
    }

    const handleUpdateCanvasSize = async ({ width, height }) => {
      try {
        await updateCanvas(canvasId.value, { width, height })
        canvasWidth.value = width
        canvasHeight.value = height
      } catch (error) {
        console.error('Error updating canvas size:', error)
      }
    }

    // Recovery actions
    const handleRecover = async () => {
      const rec = loadSnapshot(canvasId.value)
      if (!rec) { showRecoveryModal.value = false; return }
      // Merge recovered shapes by timestamp
      const remoteIds = new Set(Array.from(shapes.keys()))
      rec.shapes.forEach(s => {
        const local = shapes.get(s.id)
        if (!local) {
          shapes.set(s.id, s)
        } else if ((s.lastModified || 0) > (local.lastModified || 0)) {
          shapes.set(s.id, s)
        }
      })
      // Close and clear
      clearSnapshot(canvasId.value)
      showRecoveryModal.value = false
    }

    const handleDiscardRecovery = () => {
      clearSnapshot(canvasId.value)
      showRecoveryModal.value = false
    }

    // Version restore (v5: Optimized with snapshots and batch operations)
    const handleRestoreVersion = async (version) => {
      if (!version) return
      
      const startTime = Date.now()
      let shapesToRestore = null
      let restoreMethod = 'unknown'
      
      try {
        // Step 1: Determine restore strategy based on available data
        console.log('🔄 Determining restore strategy...')
        
        // Try 1: Load from canvas snapshot (fastest - single document read)
        try {
          shapesToRestore = await loadCanvasSnapshot(canvasId.value)
          if (shapesToRestore && shapesToRestore.length > 0) {
            restoreMethod = 'snapshot'
            console.log(`✅ Using snapshot (${shapesToRestore.length} shapes)`)
          }
        } catch (snapshotError) {
          console.warn('Snapshot load failed:', snapshotError)
        }
        
        // Try 2: Decompress from version.compressed (fallback)
        if (!shapesToRestore && version.compressed) {
          try {
            const { decompressShapes } = await import('../utils/compression.js')
            shapesToRestore = decompressShapes(version.compressed)
            restoreMethod = 'compressed'
            console.log(`✅ Using compressed version data (${shapesToRestore.length} shapes)`)
          } catch (decompressError) {
            console.warn('Decompression failed:', decompressError)
          }
        }
        
        // Try 3: Use uncompressed shapes array (backward compatibility)
        if (!shapesToRestore && version.shapes && Array.isArray(version.shapes)) {
          shapesToRestore = version.shapes
          restoreMethod = 'legacy'
          console.log(`✅ Using legacy shapes array (${shapesToRestore.length} shapes)`)
        }
        
        // Validate we have shapes to restore
        if (!shapesToRestore || shapesToRestore.length === 0) {
          throw new Error('No valid shape data found in version')
        }
        
        console.log(`🔄 Restoring ${shapesToRestore.length} shapes using ${restoreMethod} method`)
        
        // Step 2: Pause real-time sync to prevent listener spam during bulk operation
        pauseSync()
        
        // Step 3: Batch delete all current shapes from Firestore
        const currentShapes = Array.from(shapes.values())
        console.log('Batch deleting', currentShapes.length, 'current shapes')
        
        const shapeIds = currentShapes.map(s => s.id)
        if (shapeIds.length > 0) {
          await deleteShapesBatch(canvasId.value, shapeIds)
        }
        
        // Step 4: Clear local shapes immediately
        shapes.clear()
        
        // Step 5: Batch create all version shapes in Firestore
        console.log('Batch creating', shapesToRestore.length, 'shapes from version')
        
        // Prepare shapes for batch write (preserve IDs and metadata)
        const shapesToCreate = shapesToRestore.map(versionShape => ({
          ...versionShape,
          // Update metadata to current restore operation
          lastModifiedBy: user.value.uid,
          lastModifiedByName: userName.value
        }))
        
        await saveShapesBatch(canvasId.value, shapesToCreate)
        
        // Step 6: Update canvas snapshot for future fast restores
        if (restoreMethod !== 'snapshot') {
          console.log('📸 Updating canvas snapshot...')
          await updateCanvasSnapshot(canvasId.value, shapesToRestore)
        }
        
        // Step 7: Resume real-time sync (will reload shapes from Firestore)
        await resumeSync(canvasId.value)
        
        const duration = Date.now() - startTime
        console.log(`✅ Version restored successfully in ${duration}ms (${shapesToRestore.length} shapes, ${restoreMethod} method)`)
        
        showVersionHistory.value = false
      } catch (error) {
        console.error('❌ Error restoring version:', error)
        
        // Ensure sync resumes even on error
        try {
          await resumeSync(canvasId.value)
        } catch (resumeError) {
          console.error('Error resuming sync after failure:', resumeError)
        }
        
        alert('Failed to restore version. Please try again.')
      }
    }

    const handleCloseVersionHistory = () => {
      // Just close the modal without URL changes
      showVersionHistory.value = false
    }

    // V6: AI Command System Integration
    // Calculate viewport center (visible screen area) for AI positioning
    const aiContext = computed(() => {
      // Get center of visible screen area
      const centerScreenX = stageSize.width / 2
      const centerScreenY = stageSize.height / 2
      
      // Convert screen coordinates to canvas coordinates
      const canvasX = (centerScreenX - stagePosition.x) / zoomLevel.value
      const canvasY = (centerScreenY - stagePosition.y) / zoomLevel.value
      
      // Calculate viewport dimensions in canvas coordinates
      const viewportWidth = stageSize.width / zoomLevel.value
      const viewportHeight = stageSize.height / zoomLevel.value
      
      // Calculate viewport bounds for shape positioning
      const viewportBounds = {
        left: canvasX - viewportWidth / 2,
        right: canvasX + viewportWidth / 2,
        top: canvasY - viewportHeight / 2,
        bottom: canvasY + viewportHeight / 2
      }
      
      console.log('🎯 Viewport center calculated:', { 
        screenCenter: { x: centerScreenX, y: centerScreenY },
        stagePosition: { x: stagePosition.x, y: stagePosition.y },
        zoomLevel: zoomLevel.value,
        canvasCenter: { x: canvasX, y: canvasY },
        viewportDimensions: { width: viewportWidth, height: viewportHeight },
        viewportBounds
      })
      
      // Extract single selected shape details for AI
      let selectedShape = null
      if (selectedShapeIds.value.length === 1) {
        const shapeId = selectedShapeIds.value[0]
        const shape = shapes.get(shapeId)
        if (shape) {
          selectedShape = {
            id: shape.id,
            type: shape.type,
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
            radius: shape.radius,
            fill: shape.fill,
            stroke: shape.stroke,
            strokeWidth: shape.strokeWidth,
            rotation: shape.rotation,
            opacity: shape.opacity,
            text: shape.text,
            fontSize: shape.fontSize,
            fontFamily: shape.fontFamily,
            fontStyle: shape.fontStyle
          }
        }
      }
      
      return {
        viewportCenter: {
          x: canvasX,
          y: canvasY
        },
        viewportWidth,
        viewportHeight,
        viewportBounds,
        panOffset: {
          x: stagePosition.x,
          y: stagePosition.y
        },
        zoomLevel: zoomLevel.value,
        selectedShapeIds: selectedShapeIds.value,
        selectedShape, // Single selected shape with all attributes
        shapes: shapes,
        lastCreatedShape: null, // TODO: Track last created shape if needed
        userId: user.value?.uid,
        canvasId: canvasId.value,
        userName: userName.value
      }
    })
    
    // Handle AI command execution results
    const handleAICommandExecuted = (result) => {
      if (result.type === 'selection' && result.selectedIds) {
        // Update selection from AI command
        selectedShapeIds.value = result.selectedIds
        updateTransformer()
      }
      // Other command types are already handled by the executor
    }
    
    // Handle utility actions from AI commands
    const handleAIUtilityAction = (action, amount) => {
      switch (action) {
        case 'zoom-in':
          handleZoomIn()
          break
        case 'zoom-out':
          handleZoomOut()
          break
        case 'center':
          handleZoomReset()
          break
        case 'clear-selection':
          clearSelection()
          break
      }
    }

    return {
      // Refs
      stage,
      canvasWrapper,
      shapeLayer,
      transformer,
      spotifySidebarRef,
      
      // State
      stageConfig,
      stagePosition,
      zoomLevel,
      activeTool,
      shapesList,
      showAIModal,
      visibleShapesList, // v5: Viewport-culled shapes for rendering
      remoteCursors,
      activeUserCount,
      isLoading,
      error,
      isConnected,
      isSyncing,
      // Selection state
      selectedShapeIds,
      selectionRect,
      // Context menu state
      contextMenuVisible,
      contextMenuPosition,
      // Confirmation modal state
      confirmModalVisible,
      confirmModalMessage,
      // Text editing state
      editingTextId,
      showTextEditor,
      showFormatToolbar,
      editingText,
      
      // Event handlers
      handleToolSelected,
      handleWheel,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleMouseLeave,
      handleDoubleClick,
      handleZoomIn,
      handleZoomOut,
      handleZoomReset,
      handleShapeUpdate,
      // Selection handlers
      handleShapeSelect,
      clearSelection,
      updateTransformer,
      handleTransformEnd,
      // Context menu handlers
      handleContextMenu,
      handleCloseContextMenu,
      handleContextBringToFront,
      handleContextBringForward,
      handleContextSendBackward,
      handleContextSendToBack,
      handleContextDuplicate,
      handleContextDelete,
      // Confirmation modal handlers
      handleConfirmDelete,
      handleCancelDelete,
      // Text handlers
      handleTextEdit,
      handleTextSave,
      handleTextCancel,
      handleFormatChange,
      // Properties panel
      selectedShapesData,
      canvasWidth,
      canvasHeight,
      handleUpdateProperty,
      handleBulkUpdate,
      handleUpdateCanvasSize,
      // Recovery modal
      showRecoveryModal,
      recoveryMeta,
      handleRecover,
      handleDiscardRecovery,
      // Version history
      showVersionHistory,
      versionsList,
      versionsLoading,
      canRestoreVersions,
      handleRestoreVersion,
      handleCloseVersionHistory,
      // V6: AI Command System
      aiContext,
      handleAICommandExecuted,
      handleAIUtilityAction,
      user,
      // Canvas metadata
      currentCanvas,
      canvasId,
      // Panning state
      isPanning,
      // Canvas access check
      hasCanvasAccess
    }
  }
}
</script>

<style scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #000;
  display: flex;
  flex-direction: column;
}

.canvas-wrapper {
  position: fixed;
  top: 70px; /* Account for navbar height */
  left: 0;
  right: 300px; /* Account for properties panel */
  bottom: 0;
  overflow: hidden; /* Clip any overflow content including cursors */
  border-left: 2px solid #ffffff;
  border-top: 2px solid #ffffff;
  border-right: 2px solid #808080;
  border-bottom: 2px solid #808080;
  margin: 4px;
}

.canvas-wrapper[data-panning="true"] {
  cursor: grab;
}

.canvas-wrapper[data-panning="true"][data-is-dragging="true"] {
  cursor: grabbing !important;
}

/* Responsive canvas width for smaller screens */
@media (max-width: 1200px) {
  .canvas-wrapper {
    right: 250px; /* Account for narrower properties panel */
  }
}

/* Responsive for very small screens */
@media (max-width: 768px) {
  .canvas-wrapper {
    right: 0; /* Full width, properties panel hidden or overlaid */
  }
}

/* Canvas background with dotted grid pattern */
.canvas-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #000000;
  background-image: 
    repeating-linear-gradient(0deg, transparent, transparent 19px, #404040 19px, #404040 20px),
    repeating-linear-gradient(90deg, transparent, transparent 19px, #404040 19px, #404040 20px);
  background-size: 20px 20px;
  pointer-events: none;
  z-index: -1;
}

/* Disable text selection on canvas */
.canvas-wrapper {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}

/* Loading overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #c0c0c0;
  border-top: 4px solid #000080;
  border-radius: 0;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-spinner p {
  color: #ffffff;
  font-weight: normal;
}

/* Error message */
.error-message {
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: #c0c0c0;
  color: #000;
  padding: 8px;
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
  z-index: 1001;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.dismiss-error {
  padding: 4px 12px;
  font-size: 11px;
  cursor: pointer;
}
</style>