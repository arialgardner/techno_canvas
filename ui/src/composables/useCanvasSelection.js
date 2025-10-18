import { ref, reactive } from 'vue'

export function useCanvasSelection(stage, transformer, shapes) {
  const selectedShapeIds = ref([])
  
  // Marquee selection state
  const isSelecting = ref(false)
  const selectionRect = reactive({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false
  })

  const handleShapeSelect = (shapeId, event, activeTool) => {
    // Ignore selection while pan tool is active
    if (activeTool === 'pan') {
      return
    }
    
    // Check if Shift key is pressed for multi-select
    const isShiftKey = event?.shiftKey || false
    
    if (isShiftKey) {
      // Multi-select: add/remove from selection
      const index = selectedShapeIds.value.indexOf(shapeId)
      if (index > -1) {
        // Already selected, remove it
        selectedShapeIds.value = selectedShapeIds.value.filter(id => id !== shapeId)
      } else {
        // Not selected, add it
        selectedShapeIds.value = [...selectedShapeIds.value, shapeId]
      }
    } else {
      // Single select: replace selection
      selectedShapeIds.value = [shapeId]
    }
    
    // Attach transformer to selected shapes
    updateTransformer()
  }

  const clearSelection = () => {
    selectedShapeIds.value = []
    if (transformer.value) {
      transformer.value.getNode().nodes([])
    }
  }

  const updateTransformer = () => {
    if (!transformer.value || !stage.value) return
    
    const transformerNode = transformer.value.getNode()
    const stageNode = stage.value.getNode()
    
    if (selectedShapeIds.value.length === 0) {
      transformerNode.nodes([])
      return
    }
    
    // Find selected shape nodes
    const selectedNodes = selectedShapeIds.value
      .map(id => stageNode.findOne(`#${id}`))
      .filter(node => node != null)
    
    if (selectedNodes.length > 0) {
      transformerNode.nodes(selectedNodes)
      
      // Ensure all nodes have their correct rotation from shape data
      selectedNodes.forEach(node => {
        const shapeId = node.id()
        const shape = shapes.get(shapeId)
        if (shape && shape.rotation !== undefined) {
          node.rotation(shape.rotation)
        }
      })
      
      // Configure transformer based on shape type
      const firstShape = shapes.get(selectedShapeIds.value[0])
      if (firstShape) {
        configureTransformer(firstShape.type, transformerNode)
      }
    }
  }

  const configureTransformer = (shapeType, transformerNode) => {
    if (!transformerNode) return
    
    // Global transformer styling
    transformerNode.borderStroke('#3B82F6')
    transformerNode.borderStrokeWidth(2)
    transformerNode.anchorFill('white')
    transformerNode.anchorStroke('#3B82F6')
    transformerNode.anchorStrokeWidth(2)
    transformerNode.anchorSize(8)
    transformerNode.anchorCornerRadius(2)
    
    // Rotation handle styling
    transformerNode.rotateAnchorOffset(20)
    transformerNode.rotationSnaps([0, 45, 90, 135, 180, 225, 270, 315])
    transformerNode.rotationSnapTolerance(5)
    
    // Configure based on shape type
    switch (shapeType) {
      case 'rectangle':
        transformerNode.enabledAnchors(['top-left', 'top-center', 'top-right', 
                                       'middle-right', 'middle-left',
                                       'bottom-left', 'bottom-center', 'bottom-right'])
        transformerNode.rotateEnabled(false)
        transformerNode.boundBoxFunc((oldBox, newBox) => {
          if (Math.abs(newBox.width) < 10 || Math.abs(newBox.height) < 10) {
            return oldBox
          }
          return newBox
        })
        break
      case 'circle':
        transformerNode.enabledAnchors(['top-left', 'top-center', 'top-right', 
                                       'middle-right', 'middle-left',
                                       'bottom-left', 'bottom-center', 'bottom-right'])
        transformerNode.rotateEnabled(false)
        transformerNode.keepRatio(true)
        transformerNode.boundBoxFunc((oldBox, newBox) => {
          const minDiameter = 10
          if (Math.abs(newBox.width) < minDiameter || Math.abs(newBox.height) < minDiameter) {
            return oldBox
          }
          return newBox
        })
        break
      case 'line':
        transformerNode.enabledAnchors(['top-left', 'bottom-right'])
        transformerNode.rotateEnabled(true)
        transformerNode.boundBoxFunc(null)
        break
      case 'text':
        transformerNode.enabledAnchors(['middle-left', 'middle-right'])
        transformerNode.rotateEnabled(true)
        transformerNode.boundBoxFunc((oldBox, newBox) => {
          if (Math.abs(newBox.width) < 20) {
            return oldBox
          }
          return newBox
        })
        break
      default:
        transformerNode.enabledAnchors(['top-left', 'top-center', 'top-right', 
                                       'middle-right', 'middle-left',
                                       'bottom-left', 'bottom-center', 'bottom-right'])
        transformerNode.rotateEnabled(true)
        transformerNode.boundBoxFunc(null)
    }
    
    transformerNode.getLayer().batchDraw()
  }

  const startMarqueeSelection = (canvasX, canvasY) => {
    isSelecting.value = true
    selectionRect.x = canvasX
    selectionRect.y = canvasY
    selectionRect.width = 0
    selectionRect.height = 0
    selectionRect.visible = true
  }

  const updateMarqueeSelection = (canvasX, canvasY) => {
    if (!isSelecting.value) return
    selectionRect.width = canvasX - selectionRect.x
    selectionRect.height = canvasY - selectionRect.y
  }

  const finalizeMarqueeSelection = (shapesList) => {
    if (!isSelecting.value) return []
    
    // Normalize selection rectangle
    const selX = selectionRect.width < 0 ? selectionRect.x + selectionRect.width : selectionRect.x
    const selY = selectionRect.height < 0 ? selectionRect.y + selectionRect.height : selectionRect.y
    const selWidth = Math.abs(selectionRect.width)
    const selHeight = Math.abs(selectionRect.height)
    
    // Find shapes that intersect with selection rectangle
    const containedShapes = shapesList.filter(shape => {
      let shapeX, shapeY, shapeWidth, shapeHeight
      
      if (shape.type === 'rectangle' || shape.type === 'text') {
        shapeX = shape.x
        shapeY = shape.y
        shapeWidth = shape.width
        shapeHeight = shape.height
      } else if (shape.type === 'circle') {
        shapeX = shape.x - shape.radius
        shapeY = shape.y - shape.radius
        shapeWidth = shape.radius * 2
        shapeHeight = shape.radius * 2
      } else if (shape.type === 'line') {
        const points = shape.points || []
        const allX = [shape.x || 0, ...points.filter((_, i) => i % 2 === 0).map(x => (shape.x || 0) + x)]
        const allY = [shape.y || 0, ...points.filter((_, i) => i % 2 === 1).map(y => (shape.y || 0) + y)]
        shapeX = Math.min(...allX)
        shapeY = Math.min(...allY)
        shapeWidth = Math.max(...allX) - shapeX
        shapeHeight = Math.max(...allY) - shapeY
      }
      
      // Check for intersection
      return (
        shapeX < selX + selWidth &&
        shapeX + shapeWidth > selX &&
        shapeY < selY + selHeight &&
        shapeY + shapeHeight > selY
      )
    })
    
    selectedShapeIds.value = containedShapes.map(s => s.id)
    updateTransformer()
    
    // Hide selection rectangle
    isSelecting.value = false
    selectionRect.visible = false
    
    return selectedShapeIds.value
  }

  const selectAll = (shapesList) => {
    selectedShapeIds.value = shapesList.map(s => s.id)
    updateTransformer()
  }

  return {
    selectedShapeIds,
    isSelecting,
    selectionRect,
    handleShapeSelect,
    clearSelection,
    updateTransformer,
    startMarqueeSelection,
    updateMarqueeSelection,
    finalizeMarqueeSelection,
    selectAll
  }
}

