import { ref, computed } from 'vue'

export function useTextEditor({
  shapes,
  isTextLocked,
  acquireTextLock,
  releaseTextLock,
  getLockedTextOwner,
  updateShape,
  user,
  canvasId,
  userName
}) {
  const editingTextId = ref(null)
  const showTextEditor = ref(false)
  const showFormatToolbar = ref(false)
  
  const editingText = computed(() => {
    if (!editingTextId.value) return null
    return shapes.get(editingTextId.value)
  })

  const handleTextEdit = async (textId) => {
    const userId = user.value?.uid
    if (!userId) return

    // Check if locked by another user
    if (isTextLocked(textId, userId)) {
      const owner = getLockedTextOwner(textId)
      alert(`This text is currently being edited by ${owner}`)
      return
    }

    // Acquire lock
    const lockResult = await acquireTextLock(textId, userId, canvasId.value)
    if (!lockResult.success) {
      alert(lockResult.message)
      return
    }

    // Open editor
    editingTextId.value = textId
    showTextEditor.value = true
    showFormatToolbar.value = true
  }

  const handleTextSave = async (newText) => {
    if (!editingTextId.value) return

    const userId = user.value?.uid || 'anonymous'

    // Update text content
    await updateShape(editingTextId.value, { text: newText }, userId, canvasId.value, true, true, userName.value)

    // Release lock and close editor
    await releaseTextLock(editingTextId.value, userId, canvasId.value)
    editingTextId.value = null
    showTextEditor.value = false
    showFormatToolbar.value = false
  }

  const handleTextCancel = async () => {
    if (!editingTextId.value) return

    const userId = user.value?.uid || 'anonymous'

    // Release lock and close editor
    await releaseTextLock(editingTextId.value, userId, canvasId.value)
    editingTextId.value = null
    showTextEditor.value = false
    showFormatToolbar.value = false
  }

  const handleFormatChange = async (format) => {
    if (!editingTextId.value) return

    const userId = user.value?.uid || 'anonymous'

    // Update text formatting
    await updateShape(editingTextId.value, format, userId, canvasId.value, true, true, userName.value)
  }

  return {
    editingTextId,
    showTextEditor,
    showFormatToolbar,
    editingText,
    handleTextEdit,
    handleTextSave,
    handleTextCancel,
    handleFormatChange
  }
}

