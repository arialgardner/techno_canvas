import { ref, reactive } from 'vue'

export function useCanvasZoom(stage, stagePosition, stageSize, updateVisibleShapes, shapesList) {
  const MIN_ZOOM = 0.25
  const MAX_ZOOM = 3
  const ZOOM_FACTOR = 1.05
  
  const zoomLevel = ref(1)

  const clampZoom = (zoom) => {
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
  }

  const zoomAtPoint = (pointer, direction) => {
    const oldZoom = zoomLevel.value
    const newZoom = clampZoom(
      direction > 0 ? oldZoom * ZOOM_FACTOR : oldZoom / ZOOM_FACTOR
    )
    
    if (newZoom === oldZoom) return

    // Calculate new position to zoom towards cursor
    const mousePointTo = {
      x: (pointer.x - stagePosition.x) / oldZoom,
      y: (pointer.y - stagePosition.y) / oldZoom
    }

    zoomLevel.value = newZoom

    const newPos = {
      x: pointer.x - mousePointTo.x * newZoom,
      y: pointer.y - mousePointTo.y * newZoom
    }

    stagePosition.x = newPos.x
    stagePosition.y = newPos.y
    
    // Update viewport culling after zoom
    if (shapesList && shapesList.value && shapesList.value.length >= 100) {
      updateVisibleShapes(shapesList.value)
    }
  }

  const handleZoomIn = () => {
    const centerPoint = {
      x: stageSize.width / 2,
      y: stageSize.height / 2
    }
    zoomAtPoint(centerPoint, 1)
  }

  const handleZoomOut = () => {
    const centerPoint = {
      x: stageSize.width / 2,
      y: stageSize.height / 2
    }
    zoomAtPoint(centerPoint, -1)
  }

  const handleZoomReset = (CANVAS_SIZE) => {
    zoomLevel.value = 1
    // Center canvas
    const centerX = (stageSize.width - CANVAS_SIZE * zoomLevel.value) / 2
    const centerY = (stageSize.height - CANVAS_SIZE * zoomLevel.value) / 2
    
    stagePosition.x = centerX
    stagePosition.y = centerY
  }

  const handleWheel = (e) => {
    e.evt.preventDefault()
    
    const pointer = stage.value.getNode().getPointerPosition()
    const direction = e.evt.deltaY > 0 ? -1 : 1
    
    zoomAtPoint(pointer, direction)
  }

  return {
    zoomLevel,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleWheel,
    zoomAtPoint
  }
}

