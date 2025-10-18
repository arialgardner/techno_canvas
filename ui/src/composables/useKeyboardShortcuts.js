import { ref, onMounted, onUnmounted } from 'vue'

export function useKeyboardShortcuts({
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
  versionOpsCounter
}) {
  const isSpacebarPressed = ref(false)
  let keyboardNudgeTimer = null
  const keyboardNudgePending = new Map()

  const handleSpacebarDown = (e) => {
    if (e.code === 'Space' && !e.repeat) {
      const activeElement = document.activeElement
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      )
      
      if (!isTyping) {
        e.preventDefault()
        isSpacebarPressed.value = true
      }
    }
  }
  
  const handleSpacebarUp = (e) => {
    if (e.code === 'Space') {
      isSpacebarPressed.value = false
    }
  }

  const handleKeyDown = async (e) => {
    const modKey = e.metaKey || e.ctrlKey
    
    // ESC to deselect all
    if (e.key === 'Escape') {
      clearSelection()
      if (showTextEditor && showTextEditor.value) {
        handleTextCancel()
      }
      return
    }
    
    // Layer operations (only if shapes are selected)
    if (selectedShapeIds.value.length > 0 && user.value) {
      const userId = user.value.uid
      
      // Cmd+] or Ctrl+]: Bring to front
      if (modKey && e.key === ']' && !e.shiftKey) {
        e.preventDefault()
        await bringToFront(selectedShapeIds.value, userId, canvasId.value)
        return
      }
      
      // Cmd+[ or Ctrl+[: Send to back
      if (modKey && e.key === '[' && !e.shiftKey) {
        e.preventDefault()
        await sendToBack(selectedShapeIds.value, userId, canvasId.value)
        return
      }
      
      // Cmd+Shift+] or Ctrl+Shift+]: Bring forward
      if (modKey && e.shiftKey && e.key === ']') {
        e.preventDefault()
        await bringForward(selectedShapeIds.value, userId, canvasId.value)
        return
      }
      
      // Cmd+Shift+[ or Ctrl+Shift+[: Send backward
      if (modKey && e.shiftKey && e.key === '[') {
        e.preventDefault()
        await sendBackward(selectedShapeIds.value, userId, canvasId.value)
        return
      }
    }
    
    // Cmd+A or Ctrl+A: Select all (handled by parent)
    if (modKey && e.key === 'a') {
      e.preventDefault()
      // This will be handled by the parent component
      return true // Signal to parent to handle
    }
    
    // Cmd+C or Ctrl+C: Copy
    if (modKey && e.key === 'c' && selectedShapeIds.value.length > 0) {
      e.preventDefault()
      handleContextCopy()
      return
    }
    
    // Cmd+V or Ctrl+V: Paste
    if (modKey && e.key === 'v' && clipboard.value.length > 0) {
      e.preventDefault()
      await handleContextPaste()
      return
    }
    
    // Cmd+D or Ctrl+D: Duplicate
    if (modKey && e.key === 'd' && selectedShapeIds.value.length > 0 && (!showTextEditor || !showTextEditor.value)) {
      e.preventDefault()
      const userId = user.value?.uid || 'anonymous'
      const duplicatedIds = await duplicateShapes(selectedShapeIds.value, userId, canvasId.value)
      return duplicatedIds // Return to parent to update selection
    }
    
    // Delete or Backspace
    const activeElement = document.activeElement
    const isTyping = activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable
    )
    
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeIds.value.length > 0 && (!showTextEditor || !showTextEditor.value) && !isTyping) {
      e.preventDefault()
      // Signal to parent to handle deletion (with confirmation if needed)
      return { action: 'delete', shapeIds: selectedShapeIds.value }
    }

    // Arrow keys: Nudge selected shapes
    if (!modKey && selectedShapeIds.value.length > 0 && (!showTextEditor || !showTextEditor.value)) {
      const step = e.shiftKey ? 10 : 2
      let dx = 0, dy = 0
      if (e.key === 'ArrowLeft') dx = -step
      if (e.key === 'ArrowRight') dx = step
      if (e.key === 'ArrowUp') dy = -step
      if (e.key === 'ArrowDown') dy = step
      
      if (dx !== 0 || dy !== 0) {
        e.preventDefault()
        const userId = user.value?.uid || 'anonymous'

        // Local-only optimistic movement
        selectedShapeIds.value.forEach(id => {
          const shape = shapes.get(id)
          if (!shape) return
          const updates = {}
          if (dx !== 0) updates.x = (shape.x || 0) + dx
          if (dy !== 0) updates.y = (shape.y || 0) + dy
          updateShape(id, updates, userId, canvasId.value, false, false, userName.value)

          // Record pending final value for debounced commit
          const pending = keyboardNudgePending.get(id) || {}
          if (updates.x !== undefined) pending.x = updates.x
          if (updates.y !== undefined) pending.y = updates.y
          keyboardNudgePending.set(id, pending)
        })

        // Debounce batch commit
        if (keyboardNudgeTimer) {
          clearTimeout(keyboardNudgeTimer)
        }
        keyboardNudgeTimer = window.setTimeout(async () => {
          try {
            if (keyboardNudgePending.size > 0) {
              const shapeUpdates = Array.from(keyboardNudgePending.entries()).map(([id, updates]) => ({ id, updates }))
              await updateShapesBatch(canvasId.value, shapeUpdates)
              keyboardNudgePending.clear()
            }
          } catch (err) {
            console.error('Keyboard nudge batch update failed:', err)
          } finally {
            try {
              versionOpsCounter.value += selectedShapeIds.value.length
              if (versionOpsCounter.value >= 10 && user.value?.uid) {
                const shapesArray = Array.from(shapes.values())
                if (shapesArray.length > 0) {
                  await createVersion(canvasId.value, user.value.uid, userName.value, shapesArray, 'threshold')
                  versionOpsCounter.value = 0
                }
              }
            } catch {}
          }
        }, 150)
        
        return
      }
    }
  }

  const setupKeyboardListeners = () => {
    window.addEventListener('keydown', handleSpacebarDown)
    window.addEventListener('keyup', handleSpacebarUp)
    window.addEventListener('keydown', handleKeyDown)
  }

  const cleanupKeyboardListeners = () => {
    window.removeEventListener('keydown', handleSpacebarDown)
    window.removeEventListener('keyup', handleSpacebarUp)
    window.removeEventListener('keydown', handleKeyDown)
    
    if (keyboardNudgeTimer) {
      clearTimeout(keyboardNudgeTimer)
    }
  }

  return {
    isSpacebarPressed,
    handleSpacebarDown,
    handleSpacebarUp,
    handleKeyDown,
    setupKeyboardListeners,
    cleanupKeyboardListeners
  }
}

