import { ref, reactive } from 'vue'
import { DEFAULT_SHAPE_PROPERTIES } from '../types/shapes'

export function useCanvasMouseEvents({
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
  onCursorMove // NEW: callback for cursor tracking
}) {
  
  const handleMouseDown = async (e) => {
    // Ignore right-clicks (button 2) - let context menu handle them
    if (e.evt.button === 2) {
      return
    }
    
    const clickedOnEmpty = e.target === stage.value.getNode()
    
    const pointer = stage.value.getNode().getPointerPosition()
    const stageAttrs = stage.value.getNode().attrs
    
    const canvasX = (pointer.x - stageAttrs.x) / stageAttrs.scaleX
    const canvasY = (pointer.y - stageAttrs.y) / stageAttrs.scaleY
    
    // Check if clicking on a selected shape to start group drag (only for multiple selection)
    if (!clickedOnEmpty && activeTool.value === 'select' && selectedShapeIds.value.length > 1) {
      const clickedShapeId = e.target.id()
      
      if (clickedShapeId && selectedShapeIds.value.includes(clickedShapeId)) {
        startGroupDrag(canvasX, canvasY, selectedShapeIds.value, shapes)
        canvasWrapper.value.style.cursor = 'grabbing'
        return
      }
    }
    
    // Only handle empty space clicks - let shapes handle their own events
    if (clickedOnEmpty) {
      clearSelection()
      
      const userId = user.value?.uid || 'anonymous'
      
      // Prevent shape creation in viewer mode
      if (isViewerMode.value && activeTool.value !== 'select') {
        activeTool.value = 'select'
      }
      
      // Route to appropriate shape creator based on active tool
      if (activeTool.value === 'pan') {
        isPanning.value = true
        isDragging.value = true
        lastPointerPosition.x = pointer.x
        lastPointerPosition.y = pointer.y
        canvasWrapper.value.style.cursor = 'grabbing'
        return
      } else if (activeTool.value === 'rectangle' && canUserEdit.value) {
        const w = DEFAULT_SHAPE_PROPERTIES.rectangle.width
        const h = DEFAULT_SHAPE_PROPERTIES.rectangle.height
        await createShape('rectangle', { x: canvasX - w / 2, y: canvasY - h / 2 }, userId, canvasId.value, userName.value)
        return
      } else if (activeTool.value === 'circle' && canUserEdit.value) {
        const r = DEFAULT_SHAPE_PROPERTIES.circle.radius
        await createShape('circle', { x: canvasX + r, y: canvasY + r }, userId, canvasId.value, userName.value)
        return
      } else if (activeTool.value === 'line' && canUserEdit.value) {
        if (!isCreatingLine.value) {
          startLineCreation(canvasX, canvasY)
          return
        }
      } else if (activeTool.value === 'text' && canUserEdit.value) {
        if (showTextEditor.value) {
          return
        }
        const newText = await createShape('text', { x: canvasX, y: canvasY }, userId, canvasId.value, userName.value)
        if (newText) {
          handleTextEdit(newText.id)
        }
        return
      } else if (activeTool.value === 'select') {
        const isMiddleButton = e.evt && e.evt.button === 1
        
        if (isMiddleButton || isSpacebarPressed.value) {
          isPanning.value = true
          isDragging.value = true
          lastPointerPosition.x = pointer.x
          lastPointerPosition.y = pointer.y
          canvasWrapper.value.style.cursor = 'grabbing'
        } else {
          startMarqueeSelection(canvasX, canvasY)
        }
      }
    }
  }

  const handleMouseMove = (e) => {
    const pointer = stage.value.getNode().getPointerPosition()
    const stageAttrs = stage.value.getNode().attrs
    const canvasX = (pointer.x - stageAttrs.x) / stageAttrs.scaleX
    const canvasY = (pointer.y - stageAttrs.y) / stageAttrs.scaleY
    
    // Track cursor position for other users (always, regardless of tool/state)
    if (onCursorMove && user.value) {
      onCursorMove(canvasX, canvasY)
    }
    
    // Handle group dragging
    if (isDraggingGroup.value) {
      const userId = user.value?.uid || 'anonymous'
      updateGroupDrag(canvasX, canvasY, selectedShapeIds.value, shapes, updateShape, userId, canvasId.value, userName.value)
      return
    }
    
    // Handle marquee selection update
    if (isSelecting.value) {
      updateMarqueeSelection(canvasX, canvasY)
      return
    }
    
    if (!isPanning.value) {
      if (activeTool.value === 'pan') {
        canvasWrapper.value.style.cursor = 'grab'
      } else if (e.target === stage.value.getNode()) {
        canvasWrapper.value.style.cursor = 'default'
      }
      return
    }

    // Pan the stage
    const deltaX = pointer.x - lastPointerPosition.x
    const deltaY = pointer.y - lastPointerPosition.y

    stagePosition.x += deltaX
    stagePosition.y += deltaY

    lastPointerPosition.x = pointer.x
    lastPointerPosition.y = pointer.y
    
    // Update viewport culling after pan
    if (shapesList.value.length >= 100) {
      updateVisibleShapes(shapesList.value)
    }
  }

  const handleMouseUp = async (e) => {
    // Handle group drag completion
    if (isDraggingGroup.value) {
      const pointer = stage.value.getNode().getPointerPosition()
      const stageAttrs = stage.value.getNode().attrs
      const canvasX = (pointer.x - stageAttrs.x) / stageAttrs.scaleX
      const canvasY = (pointer.y - stageAttrs.y) / stageAttrs.scaleY
      
      const userId = user.value?.uid || 'anonymous'
      await endGroupDrag(canvasX, canvasY, selectedShapeIds.value, updateShapesBatch, canvasId.value, userId, userName.value)
      
      canvasWrapper.value.style.cursor = 'default'
      updateTransformer()
      return
    }
    
    // Handle line creation completion
    if (isCreatingLine.value && lineStartPoint.value) {
      const pointer = stage.value.getNode().getPointerPosition()
      const stageAttrs = stage.value.getNode().attrs
      
      const canvasX = (pointer.x - stageAttrs.x) / stageAttrs.scaleX
      const canvasY = (pointer.y - stageAttrs.y) / stageAttrs.scaleY
      
      const dx = canvasX - lineStartPoint.value.x
      const dy = canvasY - lineStartPoint.value.y
      const length = Math.sqrt(dx * dx + dy * dy)
      
      if (length >= 10) {
        const userId = user.value?.uid || 'anonymous'
        await createShape('line', { 
          points: [
            lineStartPoint.value.x, 
            lineStartPoint.value.y, 
            canvasX, 
            canvasY
          ] 
        }, userId, canvasId.value, userName.value)
      }
      
      endLineCreation()
      return
    }
    
    // Finalize marquee selection
    if (isSelecting.value) {
      finalizeMarqueeSelection(shapesList.value)
      return
    }
    
    // Handle panning end
    isDragging.value = false
    isPanning.value = false
    if (canvasWrapper.value) {
      if (activeTool.value === 'select') {
        canvasWrapper.value.style.cursor = 'default'
      } else if (activeTool.value === 'pan') {
        canvasWrapper.value.style.cursor = 'grab'
      } else {
        canvasWrapper.value.style.cursor = 'default'
      }
    }
  }

  const handleWindowMouseUp = async (e) => {
    // Handle group drag completion (multi-select drag)
    if (isDraggingGroup.value) {
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
    
    // Finalize marquee selection
    if (isSelecting.value) {
      finalizeMarqueeSelection(shapesList.value)
    }

    // End panning state
    if (isPanning.value || isDragging.value) {
      isDragging.value = false
      isPanning.value = false
      if (canvasWrapper.value) {
        if (activeTool.value === 'select') {
          canvasWrapper.value.style.cursor = 'default'
        } else if (activeTool.value === 'pan') {
          canvasWrapper.value.style.cursor = 'grab'
        } else {
          canvasWrapper.value.style.cursor = 'default'
        }
      }
    }
    
    // Stop any Konva shape dragging (individual shapes)
    if (stage.value) {
      const stageNode = stage.value.getNode()
      // Find any shape that's currently being dragged
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

  const handleDoubleClick = async (e) => {
    const clickedOnEmpty = e.target === stage.value.getNode()
    
    // Prevent double-click from creating new text if editor is already open
    if (clickedOnEmpty && activeTool.value === 'text' && canUserEdit.value && !showTextEditor.value) {
      const pointer = stage.value.getNode().getPointerPosition()
      const stageAttrs = stage.value.getNode().attrs
      
      const canvasX = (pointer.x - stageAttrs.x) / stageAttrs.scaleX
      const canvasY = (pointer.y - stageAttrs.y) / stageAttrs.scaleY
      
      const userId = user.value?.uid || 'anonymous'
      
      const newText = await createShape('text', { x: canvasX, y: canvasY }, userId, canvasId.value, userName.value)
      
      if (newText) {
        handleTextEdit(newText.id)
      }
    }
  }

  const handleMouseLeave = () => {
    // Just a placeholder - isMouseOverCanvas is handled separately in CanvasView
  }

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWindowMouseUp,
    handleDoubleClick
  }
}

