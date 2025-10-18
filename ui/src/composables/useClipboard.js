import { ref, computed } from 'vue'
import { getMaxZIndex } from '../types/shapes'

export function useClipboard(shapes, createShape, selectedShapeIds, updateTransformer, user, canvasId, userName) {
  const clipboard = ref([])
  const hasClipboard = computed(() => clipboard.value.length > 0)

  const handleCopy = () => {
    if (selectedShapeIds.value.length > 0) {
      clipboard.value = selectedShapeIds.value.map(id => {
        const shape = shapes.get(id)
        return shape ? { ...shape } : null
      }).filter(s => s !== null)
      
      console.log(`Copied ${clipboard.value.length} shape(s) to clipboard`)
    }
  }

  const handlePaste = async () => {
    if (clipboard.value.length === 0 || !user.value) return
    
    const userId = user.value.uid
    const maxZ = getMaxZIndex(Array.from(shapes.values()))
    const pastedIds = []
    
    for (let i = 0; i < clipboard.value.length; i++) {
      const copiedShape = clipboard.value[i]
      
      // Remove id from copied shape so createShape generates a new one
      const { id, createdBy, createdAt, lastModified, lastModifiedBy, ...shapeData } = copiedShape
      
      const newShape = await createShape(
        copiedShape.type,
        {
          ...shapeData,
          x: copiedShape.x + 20,
          y: copiedShape.y + 20,
          zIndex: maxZ + i + 1
        },
        userId,
        canvasId.value,
        userName.value
      )
      
      if (newShape) {
        pastedIds.push(newShape.id)
      }
    }
    
    // Select pasted shapes
    selectedShapeIds.value = pastedIds
    updateTransformer()
    
    console.log(`Pasted ${pastedIds.length} shape(s)`)
    
    return pastedIds
  }

  return {
    clipboard,
    hasClipboard,
    handleCopy,
    handlePaste
  }
}

