import { ref } from 'vue'

export function useToolManager(canvasWrapper, isViewerMode) {
  const activeTool = ref('select')
  const isCreatingLine = ref(false)
  const lineStartPoint = ref(null)

  const handleToolSelected = (toolName) => {
    // Prevent tool changes in viewer mode
    if (isViewerMode && isViewerMode.value) {
      activeTool.value = 'select'
      return
    }
    
    activeTool.value = toolName
    
    // Reset line creation if switching away from line tool
    if (toolName !== 'line') {
      isCreatingLine.value = false
      lineStartPoint.value = null
    }
    
    // Update cursor
    if (canvasWrapper && canvasWrapper.value) {
      if (toolName === 'select') {
        canvasWrapper.value.style.cursor = 'default'
      } else if (toolName === 'pan') {
        canvasWrapper.value.style.cursor = 'grab'
      } else {
        canvasWrapper.value.style.cursor = 'default'
      }
    }
  }

  const startLineCreation = (canvasX, canvasY) => {
    isCreatingLine.value = true
    lineStartPoint.value = { x: canvasX, y: canvasY }
  }

  const endLineCreation = () => {
    isCreatingLine.value = false
    lineStartPoint.value = null
  }

  return {
    activeTool,
    isCreatingLine,
    lineStartPoint,
    handleToolSelected,
    startLineCreation,
    endLineCreation
  }
}

