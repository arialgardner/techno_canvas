<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content recovery-modal">
      <div class="modal-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      
      <h2 class="modal-title">Restore Unsaved Changes?</h2>
      
      <p class="modal-message">
        We found unsaved changes from {{ recoveryAge }}. Would you like to restore them?
      </p>
      
      <div class="recovery-info">
        <div class="info-item">
          <span class="info-label">Last saved:</span>
          <span class="info-value">{{ formattedTime }}</span>
        </div>
      </div>
      
      <div class="modal-actions">
        <button 
          @click="$emit('discard')" 
          class="button-secondary"
          :disabled="isRestoring"
        >
          Discard
        </button>
        <button 
          @click="$emit('restore')" 
          class="button-primary"
          :disabled="isRestoring"
        >
          {{ isRestoring ? 'Restoring...' : 'Restore Changes' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  recoveryAge: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Number,
    default: 0
  },
  isRestoring: {
    type: Boolean,
    default: false
  }
})

defineEmits(['restore', 'discard'])

const formattedTime = computed(() => {
  if (!props.timestamp) return ''
  return new Date(props.timestamp).toLocaleString()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal-content {
  background: #c0c0c0;
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
  max-width: 480px;
  width: 100%;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.recovery-modal {
  text-align: center;
  padding: 16px;
}

.modal-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  background: #ffff00;
  border: 2px solid #000;
  box-shadow: 2px 2px 0 0 #808080;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000;
}

.modal-icon svg {
  width: 28px;
  height: 28px;
}

.modal-title {
  font-size: 14px;
  font-weight: bold;
  color: #000;
  margin: 0 0 8px;
}

.modal-message {
  font-size: 11px;
  color: #000;
  margin: 0 0 12px;
  line-height: 1.4;
}

.recovery-info {
  background: #fff;
  border: 2px solid #808080;
  padding: 8px;
  margin-bottom: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 10px;
  color: #000;
  font-weight: bold;
}

.info-value {
  font-size: 10px;
  color: #000;
  font-weight: normal;
}

.modal-actions {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.button-primary,
.button-secondary {
  padding: 4px 12px;
  border: none;
  font-size: 11px;
  font-weight: normal;
  cursor: pointer;
  transition: none;
  min-width: 100px;
  background: #c0c0c0;
  color: #000;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}

.button-primary {
  background: #000080;
  color: #fff;
}

.button-primary:active:not(:disabled) {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.button-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-secondary {
  background: #c0c0c0;
  color: #000;
}

.button-secondary:active:not(:disabled) {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.button-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

