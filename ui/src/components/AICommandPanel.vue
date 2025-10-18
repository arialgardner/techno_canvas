<template>
  <div class="ai-command-panel" :class="{ 'is-focused': isFocused }" data-testid="ai-panel">
    <!-- Beta badge -->
    <div class="beta-badge">
      <span class="beta-text">AI Assistant</span>
      <span class="beta-label">BETA</span>
    </div>
    
    <!-- Keyboard shortcuts info -->
    <div class="shortcuts-info">
      <strong>Shortcuts:</strong> Cmd/Ctrl+J to focus • Enter to send • ↑↓ for history
    </div>
    
    <!-- Main input area -->
    <div class="input-area">
      <input
        ref="commandInput"
        v-model="userInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown.enter="handleSendCommand"
        @keydown.up="navigateHistory(-1)"
        @keydown.down="navigateHistory(1)"
        :placeholder="isProcessing ? 'Processing...' : 'Type AI command...'"
        :disabled="isProcessing"
        class="command-input"
        autocomplete="off"
        data-testid="ai-command-input"
      />
      <button
        @click="handleSendCommand"
        :disabled="isProcessing || !userInput.trim()"
        class="send-button"
        :title="isProcessing ? 'Processing...' : 'Send command'"
        data-testid="ai-submit-button"
      >
        <span v-if="!isProcessing">Send</span>
        <span v-else class="spinner"></span>
      </button>
    </div>

    <!-- Feedback message (success/error) -->
    <transition name="fade">
      <div v-if="currentMessage" class="feedback-message" :class="currentMessage.type" data-testid="ai-status">
        {{ currentMessage.text }}
      </div>
    </transition>

    <!-- Suggested commands (when focused and input is empty) -->
    <transition name="slide-down">
      <div
        v-if="isFocused && !userInput.trim() && !isProcessing"
        class="suggested-commands"
      >
        <div class="suggestions-header">💡 Example Commands</div>
        <div
          v-for="(suggestion, index) in suggestedCommands"
          :key="index"
          @click="selectSuggestion(suggestion.text)"
          class="suggestion-item"
        >
          <span class="suggestion-icon">{{ suggestion.icon }}</span>
          <span class="suggestion-text">{{ suggestion.text }}</span>
        </div>
      </div>
    </transition>

    <!-- Command history dropdown (when focused and has input or history) -->
    <transition name="slide-down">
      <div
        v-if="isFocused && commandHistory.length > 0 && userInput.trim() && !isProcessing"
        class="command-history"
      >
        <div class="history-header">Recent Commands</div>
        <div
          v-for="(cmd, index) in commandHistory.slice(0, 10)"
          :key="index"
          @click="selectHistoryCommand(cmd.input)"
          class="history-item"
          :class="{ 'history-item-error': !cmd.success }"
        >
          <span class="history-icon" :class="cmd.success ? 'success' : 'error'">
            {{ cmd.success ? '✓' : '✗' }}
          </span>
          <span class="history-text">{{ cmd.input }}</span>
          <span class="history-time">{{ formatTime(cmd.timestamp) }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, defineProps, defineEmits } from 'vue'
import { useAICommands } from '../composables/useAICommands'
import { useCommandExecutor } from '../composables/useCommandExecutor'

const props = defineProps({
  context: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['command-executed', 'utility-action'])

// Component state
const userInput = ref('')
const isFocused = ref(false)
const commandInput = ref(null)
const currentMessage = ref(null) // { type: 'success' | 'error', text: '...' }
const historyIndex = ref(-1)

// Suggested commands for users to learn the format
const suggestedCommands = [
  { icon: '▪', text: "add a text layer that says 'collab canvas'" },
  { icon: '▬', text: 'make a 200x300 rectangle' },
  { icon: '✕', text: 'delete all selected shapes' },
  { icon: '○', text: 'make the selected shape white' },
  { icon: '●', text: 'resize the circle to be twice as big' },
  { icon: '▲', text: 'move the selected shape up 40px' },
  { icon: '◼', text: 'create a grid of 3x3 squares' },
  { icon: '★', text: 'create a star made of circles' },
  { icon: '○', text: 'create a circle made of squares' },
]

// Composables
const { isProcessing, error: aiError, commandHistory, executeCommand: parseAICommand } = useAICommands()
const { executeCommand: executeCanvasCommand } = useCommandExecutor()

// Watch for AI parsing errors
watch(aiError, (newError) => {
  if (newError) {
    showMessage('error', newError, 5000)
  }
})

/**
 * Handle focus event
 */
const handleFocus = () => {
  isFocused.value = true
  historyIndex.value = -1
}

/**
 * Handle blur event (with small delay to allow clicks on history)
 */
const handleBlur = () => {
  setTimeout(() => {
    isFocused.value = false
  }, 200)
}

/**
 * Handle send command
 */
const handleSendCommand = async () => {
  if (!userInput.value.trim() || isProcessing.value) return

  const commandText = userInput.value.trim()
  userInput.value = '' // Clear input immediately
  historyIndex.value = -1

  try {
    // 1. Parse command using AI service (calls Cloud Function)
    const parsedCommand = await parseAICommand(commandText, props.context)

    // 2. Execute command on canvas
    const executionResult = await executeCanvasCommand(parsedCommand, props.context)

    // 3. Handle specific results
    if (parsedCommand.category === 'selection' && executionResult?.selectedIds) {
      emit('command-executed', {
        type: 'selection',
        selectedIds: executionResult.selectedIds,
      })
    } else if (parsedCommand.category === 'utility' && executionResult?.action) {
      emit('utility-action', executionResult.action, executionResult.amount)
    } else {
      emit('command-executed', {
        type: parsedCommand.category,
        result: executionResult,
      })
    }

    showMessage('success', `✓ ${commandText}`, 2000)
  } catch (err) {
    console.error('AI Command execution failed:', err)
    showMessage('error', err.message || 'Failed to execute command', 5000)
  }
}

/**
 * Show feedback message
 */
const showMessage = (type, text, duration) => {
  currentMessage.value = { type, text }
  if (duration) {
    setTimeout(() => {
      if (currentMessage.value?.text === text) {
        currentMessage.value = null
      }
    }, duration)
  }
}

/**
 * Select command from history
 */
const selectHistoryCommand = (command) => {
  userInput.value = command
  commandInput.value?.focus()
  isFocused.value = true
}

/**
 * Select a suggested command
 */
const selectSuggestion = (command) => {
  userInput.value = command
  commandInput.value?.focus()
  isFocused.value = true
}

/**
 * Navigate through command history with arrow keys
 */
const navigateHistory = (direction) => {
  if (commandHistory.value.length === 0) return

  const newIndex = historyIndex.value + direction

  if (newIndex < -1) {
    historyIndex.value = -1
    userInput.value = ''
  } else if (newIndex >= commandHistory.value.length) {
    historyIndex.value = commandHistory.value.length - 1
  } else {
    historyIndex.value = newIndex
    if (newIndex === -1) {
      userInput.value = ''
    } else {
      userInput.value = commandHistory.value[newIndex].input
    }
  }
}

/**
 * Format timestamp for display
 */
const formatTime = (timestamp) => {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

/**
 * Handle keyboard shortcut (Cmd/Ctrl+J)
 */
const handleKeyDown = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
    e.preventDefault()
    commandInput.value?.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.ai-command-panel {
  position: fixed;
  bottom: 20px;
  right: 320px; /* Above properties panel */
  width: 400px;
  background-color: #c0c0c0;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 100;
  transition: none;
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
}

/* Responsive positioning - stay on right side */
@media (max-width: 1200px) {
  .ai-command-panel {
    right: 270px; /* Adjust for narrower properties panel */
    width: 350px;
  }
}

@media (max-width: 768px) {
  .ai-command-panel {
    right: 1rem; /* Properties panel hidden, move to right edge */
    width: 280px;
    padding: 4px;
    bottom: 1rem;
  }
}

@media (max-width: 480px) {
  .ai-command-panel {
    right: 0.75rem;
    left: 0.75rem; /* Full width on very small screens */
    width: auto;
    bottom: 0.75rem;
    padding: 4px;
  }
}

.ai-command-panel.is-focused {
  border-color: #000;
}

.beta-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  padding: 4px 6px;
  border-bottom: 1px solid #808080;
  background: #000080;
}

.beta-text {
  font-size: 11px;
  font-weight: bold;
  color: #fff;
}

.beta-label {
  display: inline-block;
  padding: 2px 4px;
  background: #ffff00;
  color: #000;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 0;
  text-transform: uppercase;
  border: 1px solid #000;
}

.shortcuts-info {
  font-size: 10px;
  color: #000;
  padding: 4px 6px;
  background: #fff;
  border: 1px solid #808080;
  margin-bottom: 4px;
  
  strong {
    font-weight: bold;
  }
}

.input-area {
  display: flex;
  gap: 4px;
}

.command-input {
  flex-grow: 1;
  padding: 3px 4px;
  border: none;
  box-shadow: inset -1px -1px 0 0 #ffffff, inset 1px 1px 0 0 #808080, inset -2px -2px 0 0 #dfdfdf, inset 2px 2px 0 0 #000000;
  font-size: 11px;
  outline: none;
  transition: none;
  background-color: #fff;
  color: #000;
}

.command-input:focus {
  outline: 1px dotted #000;
  outline-offset: -2px;
}

.command-input::placeholder {
  color: #808080;
}

.command-input:disabled {
  background-color: #c0c0c0;
  cursor: not-allowed;
  color: #808080;
}

.send-button {
  background: #c0c0c0;
  color: #000;
  padding: 4px 12px;
  border: none;
  cursor: pointer;
  font-size: 11px;
  font-weight: normal;
  transition: none;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}

.send-button:active:not(:disabled) {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.send-button:disabled {
  background: #c0c0c0;
  cursor: not-allowed;
  color: #808080;
}

/* Responsive input and button sizing */
@media (max-width: 768px) {
  .command-input {
    padding: 8px 12px;
    font-size: 13px;
  }
  
  .send-button {
    padding: 8px 16px;
    font-size: 13px;
    min-width: 70px;
  }
}

@media (max-width: 480px) {
  .command-input {
    padding: 7px 10px;
    font-size: 12px;
  }
  
  .send-button {
    padding: 7px 14px;
    font-size: 12px;
    min-width: 60px;
  }
  
  .beta-text {
    font-size: 12px;
  }
  
  .beta-label {
    font-size: 9px;
    padding: 1px 5px;
  }
}

.spinner {
  border: 2px solid #808080;
  border-top: 2px solid #000;
  border-radius: 0;
  width: 14px;
  height: 14px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.feedback-message {
  padding: 4px 6px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  animation: none;
  border: 1px solid #000;
}

.feedback-message.success {
  background-color: #00ff00;
  color: #000;
}

.feedback-message.error {
  background-color: #ff0000;
  color: #fff;
}

/* Responsive feedback message */
@media (max-width: 480px) {
  .feedback-message {
    padding: 8px 12px;
    font-size: 12px;
    gap: 6px;
  }
}

.suggested-commands {
  border-top: 1px solid #808080;
  padding-top: 6px;
  margin-top: 4px;
}

.suggestions-header {
  font-size: 10px;
  font-weight: bold;
  text-transform: none;
  color: #000;
  padding: 2px 4px;
  letter-spacing: 0;
  margin-bottom: 2px;
}

.suggestion-item {
  padding: 4px 6px;
  cursor: pointer;
  font-size: 11px;
  color: #000;
  transition: none;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 1px;
}

.suggestion-item:hover {
  background-color: #000080;
  color: #fff;
}

.suggestion-icon {
  font-size: 12px;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.suggestion-text {
  flex: 1;
  font-style: normal;
}

/* Responsive suggestions */
@media (max-width: 480px) {
  .suggestion-item {
    padding: 8px 10px;
    font-size: 12px;
    gap: 8px;
  }
  
  .suggestion-icon {
    font-size: 14px;
    width: 18px;
  }
  
  .suggestions-header {
    font-size: 10px;
    padding: 3px 6px;
  }
}

.command-history {
  border-top: 1px solid #808080;
  padding-top: 6px;
  margin-top: 4px;
}

.history-header {
  font-size: 10px;
  font-weight: bold;
  text-transform: none;
  color: #000;
  padding: 2px 4px;
  letter-spacing: 0;
}

.history-item {
  padding: 4px 6px;
  cursor: pointer;
  font-size: 11px;
  color: #000;
  transition: none;
  display: flex;
  align-items: center;
  gap: 4px;
}

.history-item:hover {
  background-color: #000080;
  color: #fff;
}

.history-item-error {
  opacity: 0.7;
}

.history-icon {
  width: 14px;
  height: 14px;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  flex-shrink: 0;
  border: 1px solid #000;
}

/* Responsive history */
@media (max-width: 480px) {
  .history-item {
    padding: 7px 8px;
    font-size: 12px;
    gap: 6px;
  }
  
  .history-icon {
    width: 16px;
    height: 16px;
    font-size: 11px;
  }
  
  .history-header {
    font-size: 10px;
    padding: 3px 6px;
  }
}

.history-icon.success {
  background-color: #00ff00;
  color: #000;
}

.history-icon.error {
  background-color: #ff0000;
  color: #fff;
}

.history-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  font-size: 10px;
  color: #808080;
  flex-shrink: 0;
}


/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
