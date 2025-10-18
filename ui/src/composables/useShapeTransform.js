import { ref } from 'vue'
import { usePerformance } from '../composables/usePerformance'
import { calculateRectPositionAfterRotation } from '../utils/rotationUtils'

export function useShapeTransform(shapes, updateShape, userName) {
  // Track which shapes are being resized
  const resizingShapes = ref(new Set())

  // Get throttle utility from performance composable
  const { throttle } = usePerformance()

  // Throttled transform update during drag
  const throttledTransformUpdate = throttle(async (shapeId, updates, userId, canvasId, userName) => {
    await updateShape(shapeId, updates, userId, canvasId, false, false, userName)
  }, 50)

  // Handle transform changes during drag (throttled)
  const handleTransform = (e, user, canvasId) => {
    const node = e.target
    const shapeId = node.id()
    
    if (!shapeId || !shapes.has(shapeId)) return
    
    const userId = user.value?.uid || 'anonymous'
    const shape = shapes.get(shapeId)
    
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const isResizing = Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001
    
    // Don't send updates during pure rotation - only on transformend
    if (!isResizing) return
    
    // Mark shape as being resized
    resizingShapes.value.add(shapeId)
    
    // Get transform updates based on shape type
    const updates = {
      rotation: node.rotation()
    }
    
    if (shape.type === 'rectangle') {
      const newWidth = Math.abs(node.width() * scaleX)
      const newHeight = Math.abs(node.height() * scaleY)
      
      const offsetX = scaleX < 0 ? -newWidth / 2 : newWidth / 2
      const offsetY = scaleY < 0 ? -newHeight / 2 : newHeight / 2
      
      updates.x = node.x() - offsetX
      updates.y = node.y() - offsetY
      updates.width = newWidth
      updates.height = newHeight
      
      node.width(newWidth)
      node.height(newHeight)
      node.offsetX(newWidth / 2)
      node.offsetY(newHeight / 2)
      node.scaleX(1)
      node.scaleY(1)
    } else if (shape.type === 'circle') {
      const newWidth = node.width() * scaleX
      const newRadius = Math.max(5, newWidth / 2)
      
      updates.radius = newRadius
      updates.x = node.x()
      updates.y = node.y()
      
      node.width(newRadius * 2)
      node.height(newRadius * 2)
      node.offsetX(newRadius)
      node.offsetY(newRadius)
      node.scaleX(1)
      node.scaleY(1)
    } else if (shape.type === 'text') {
      const newWidth = node.width() * scaleX
      const newHeight = node.height() * scaleY
      updates.x = node.x() - newWidth / 2
      updates.y = node.y() - newHeight / 2
      updates.width = newWidth
      updates.height = newHeight
    } else if (shape.type === 'line') {
      updates.x = node.x()
      updates.y = node.y()
      updates.points = shape.points.map((coord, i) => 
        i % 2 === 0 ? coord * scaleX : coord * scaleY
      )
    }
    
    throttledTransformUpdate(shapeId, updates, userId, canvasId.value, userName.value)
  }

  // Handle transformer end (final save)
  const handleTransformEnd = async (e, user, canvasId, shapeLayer) => {
    const node = e.target
    const shapeId = node.id()
    
    if (!shapeId || !shapes.has(shapeId)) return
    
    const userId = user.value?.uid || 'anonymous'
    const shape = shapes.get(shapeId)
    
    const updates = {
      rotation: node.rotation()
    }
    
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const wasResized = resizingShapes.value.has(shapeId) || Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001
    
    resizingShapes.value.delete(shapeId)
    
    if (shape.type === 'rectangle') {
      const currentWidth = wasResized ? Math.abs(node.width() * scaleX) : node.width()
      const currentHeight = wasResized ? Math.abs(node.height() * scaleY) : node.height()

      if (wasResized) {
        const offsetX = scaleX < 0 ? -currentWidth / 2 : currentWidth / 2
        const offsetY = scaleY < 0 ? -currentHeight / 2 : currentHeight / 2
        updates.x = node.x() - offsetX
        updates.y = node.y() - offsetY
        updates.width = currentWidth
        updates.height = currentHeight
        node.width(currentWidth)
        node.height(currentHeight)
        node.offsetX(currentWidth / 2)
        node.offsetY(currentHeight / 2)
        node.scaleX(1)
        node.scaleY(1)
      } else {
        const rotation = node.rotation()
        const { x: newX, y: newY } = calculateRectPositionAfterRotation(
          shape.x, shape.y, currentWidth, currentHeight, rotation
        )
        updates.x = newX
        updates.y = newY
      }
    } else if (shape.type === 'text') {
      const currentWidth = wasResized ? Math.abs(node.width() * scaleX) : node.width()
      const currentHeight = wasResized ? Math.abs(node.height() * scaleY) : node.height()
      if (wasResized) {
        const offsetX = scaleX < 0 ? -currentWidth / 2 : currentWidth / 2
        const offsetY = scaleY < 0 ? -currentHeight / 2 : currentHeight / 2
        updates.x = node.x() - offsetX
        updates.y = node.y() - offsetY
        updates.width = currentWidth
        updates.height = currentHeight
        node.width(currentWidth)
        node.height(currentHeight)
        node.offsetX(currentWidth / 2)
        node.offsetY(currentHeight / 2)
        node.scaleX(1)
        node.scaleY(1)
      }
    } else if (shape.type === 'circle') {
      if (wasResized) {
        const oldRadius = shape.radius
        const newWidth = node.width() * scaleX
        const newRadius = Math.max(5, newWidth / 2)
        const radiusDelta = newRadius - oldRadius
        
        updates.radius = newRadius
        updates.x = shape.x + radiusDelta
        updates.y = shape.y + radiusDelta
        
        node.width(newRadius * 2)
        node.height(newRadius * 2)
        node.offsetX(newRadius)
        node.offsetY(newRadius)
        node.x(updates.x)
        node.y(updates.y)
        node.scaleX(1)
        node.scaleY(1)
      }
    } else if (shape.type === 'line') {
      if (wasResized) {
        updates.x = node.x()
        updates.y = node.y()
        updates.points = shape.points.map((coord, i) => 
          i % 2 === 0 ? coord * scaleX : coord * scaleY
        )
        node.scaleX(1)
        node.scaleY(1)
      }
    }
    
    await updateShape(shapeId, updates, userId, canvasId.value, true, true, userName.value)
    
    if (shapeLayer.value) {
      shapeLayer.value.getNode().batchDraw()
    }
  }

  return {
    resizingShapes,
    handleTransform,
    handleTransformEnd
  }
}

