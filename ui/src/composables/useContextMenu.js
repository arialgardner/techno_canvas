import { ref, reactive, computed } from 'vue'

export function useContextMenu({
  selectedShapeIds,
  bringToFront,
  sendToBack,
  bringForward,
  sendBackward,
  duplicateShapes,
  updateTransformer,
  user,
  canvasId
}) {
  const contextMenuVisible = ref(false)
  const contextMenuPosition = reactive({ x: 0, y: 0 })

  const handleContextMenu = (e) => {
    e.evt.preventDefault()
    contextMenuPosition.x = e.evt.clientX
    contextMenuPosition.y = e.evt.clientY
    contextMenuVisible.value = true
  }

  const handleCloseContextMenu = () => {
    contextMenuVisible.value = false
  }

  const handleContextBringToFront = async () => {
    if (selectedShapeIds.value.length > 0 && user.value) {
      await bringToFront(selectedShapeIds.value, user.value.uid, canvasId.value)
    }
    handleCloseContextMenu()
  }

  const handleContextBringForward = async () => {
    if (selectedShapeIds.value.length > 0 && user.value) {
      await bringForward(selectedShapeIds.value, user.value.uid, canvasId.value)
    }
    handleCloseContextMenu()
  }

  const handleContextSendBackward = async () => {
    if (selectedShapeIds.value.length > 0 && user.value) {
      await sendBackward(selectedShapeIds.value, user.value.uid, canvasId.value)
    }
    handleCloseContextMenu()
  }

  const handleContextSendToBack = async () => {
    if (selectedShapeIds.value.length > 0 && user.value) {
      await sendToBack(selectedShapeIds.value, user.value.uid, canvasId.value)
    }
    handleCloseContextMenu()
  }

  const handleContextDuplicate = async () => {
    if (selectedShapeIds.value.length > 0 && user.value) {
      const duplicatedIds = await duplicateShapes(selectedShapeIds.value, user.value.uid, canvasId.value)
      selectedShapeIds.value = duplicatedIds
      updateTransformer()
    }
    handleCloseContextMenu()
  }

  return {
    contextMenuVisible,
    contextMenuPosition,
    handleContextMenu,
    handleCloseContextMenu,
    handleContextBringToFront,
    handleContextBringForward,
    handleContextSendBackward,
    handleContextSendToBack,
    handleContextDuplicate
  }
}

