import { ref, reactive } from 'vue'

export function useGroupDrag() {
  const isDraggingGroup = ref(false)
  const groupDragStart = reactive({ x: 0, y: 0 })
  const groupDragInitialPositions = ref(new Map())

  const startGroupDrag = (canvasX, canvasY, selectedShapeIds, shapes) => {
    isDraggingGroup.value = true
    groupDragStart.x = canvasX
    groupDragStart.y = canvasY
    
    // Store initial positions of all selected shapes
    groupDragInitialPositions.value.clear()
    selectedShapeIds.forEach(shapeId => {
      const shape = shapes.get(shapeId)
      if (shape) {
        groupDragInitialPositions.value.set(shapeId, { x: shape.x, y: shape.y })
      }
    })
  }

  const updateGroupDrag = (canvasX, canvasY, selectedShapeIds, shapes, updateShape, userId, canvasId, userName) => {
    if (!isDraggingGroup.value) return
    
    const deltaX = canvasX - groupDragStart.x
    const deltaY = canvasY - groupDragStart.y
    
    // Update all selected shapes with the delta
    selectedShapeIds.forEach(shapeId => {
      const initialPos = groupDragInitialPositions.value.get(shapeId)
      if (initialPos) {
        const newX = initialPos.x + deltaX
        const newY = initialPos.y + deltaY
        
        // Update local state immediately (optimistic update)
        updateShape(shapeId, { x: newX, y: newY }, userId, canvasId, false, false, userName)
      }
    })
  }

  const endGroupDrag = async (canvasX, canvasY, selectedShapeIds, updateShapesBatch, canvasId, userId, userName) => {
    if (!isDraggingGroup.value) return null
    
    const deltaX = canvasX - groupDragStart.x
    const deltaY = canvasY - groupDragStart.y
    
    // Only save if there was actual movement
    if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
      // Prepare batch update for all shape positions
      const shapeUpdates = selectedShapeIds
        .map(shapeId => {
          const initialPos = groupDragInitialPositions.value.get(shapeId)
          if (initialPos) {
            return {
              id: shapeId,
              updates: {
                x: initialPos.x + deltaX,
                y: initialPos.y + deltaY,
                lastModifiedBy: userId,
                lastModifiedByName: userName
              }
            }
          }
          return null
        })
        .filter(Boolean)
      
      // Save all shape positions as a single batch operation
      if (shapeUpdates.length > 0) {
        try {
          await updateShapesBatch(canvasId, shapeUpdates)
        } catch (error) {
          console.error('Error updating group positions:', error)
        }
      }
    }
    
    // Reset group drag state
    isDraggingGroup.value = false
    groupDragInitialPositions.value.clear()
    
    return true
  }

  const cancelGroupDrag = () => {
    isDraggingGroup.value = false
    groupDragInitialPositions.value.clear()
  }

  return {
    isDraggingGroup,
    groupDragStart,
    groupDragInitialPositions,
    startGroupDrag,
    updateGroupDrag,
    endGroupDrag,
    cancelGroupDrag
  }
}

