<template>
  <div v-if="isVisible" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-container">
      <div class="modal-header">
        <h3>{{ title }}</h3>
      </div>
      
      <div class="modal-body">
        <p>{{ message }}</p>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleCancel">
          Cancel
        </button>
        <button class="btn btn-danger" @click="handleConfirm">
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConfirmModal',
  props: {
    isVisible: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: 'Confirm Action'
    },
    message: {
      type: String,
      required: true
    },
    confirmText: {
      type: String,
      default: 'Confirm'
    }
  },
  emits: ['confirm', 'cancel'],
  setup(props, { emit }) {
    const handleConfirm = () => {
      emit('confirm')
    }

    const handleCancel = () => {
      emit('cancel')
    }

    return {
      handleConfirm,
      handleCancel
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-container {
  background: #c0c0c0;
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
  max-width: 450px;
  width: 90%;
  overflow: hidden;
  animation: modalSlideIn 0.2s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.modal-header {
  padding: 4px 6px;
  background: #000080;
  color: #fff;
}

.modal-header h3 {
  margin: 0;
  font-size: 11px;
  font-weight: bold;
}

.modal-body {
  padding: 12px;
  background: #fff;
  border: 2px solid #808080;
  margin: 4px;
}

.modal-body p {
  margin: 0;
  color: #000;
  line-height: 1.4;
  font-size: 11px;
}

.modal-footer {
  padding: 4px;
  background: #c0c0c0;
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

.btn {
  padding: 4px 12px;
  border: none;
  font-size: 11px;
  font-weight: normal;
  cursor: pointer;
  transition: none;
  outline: none;
  background: #c0c0c0;
  color: #000;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}

.btn:focus {
  outline: 1px dotted #000;
  outline-offset: -2px;
}

.btn-secondary {
  background: #c0c0c0;
  color: #000;
}

.btn-secondary:active {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.btn-danger {
  background: #c00;
  color: #fff;
}

.btn-danger:active {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}
</style>

