<template>
  <div class="empty-state">
    <div class="empty-icon">
      <slot name="icon">
        {{ defaultIcon }}
      </slot>
    </div>
    <h3 class="empty-title">{{ title }}</h3>
    <p class="empty-message">{{ message }}</p>
    <div v-if="actionText" class="empty-action">
      <button @click="$emit('action')" class="action-button">
        {{ actionText }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'default' // 'canvas', 'users', 'rectangles', 'default'
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  },
  actionText: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['action'])

const defaultIcon = computed(() => {
  switch (props.type) {
    case 'canvas':
      return '🔗'
    case 'users':
      return '👥'
    case 'rectangles':
      return '📦'
    case 'offline':
      return '📡'
    default:
      return '📄'
  }
})

const defaultTitle = computed(() => {
  if (props.title) return props.title
  
  switch (props.type) {
    case 'canvas':
      return 'Empty Canvas'
    case 'users':
      return 'No Other Users'
    case 'rectangles':
      return 'No Rectangles Yet'
    case 'offline':
      return 'You\'re Offline'
    default:
      return 'Nothing Here'
  }
})

const defaultMessage = computed(() => {
  if (props.message) return props.message
  
  switch (props.type) {
    case 'canvas':
      return 'Click anywhere on the canvas to create your first rectangle'
    case 'users':
      return 'You\'re the only one here right now. Share the link to collaborate!'
    case 'rectangles':
      return 'Start creating rectangles by clicking on the canvas'
    case 'offline':
      return 'Some features may not work properly while offline'
    default:
      return 'There\'s nothing to show here yet'
  }
})
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  max-width: 400px;
  margin: 0 auto;
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 16px;
  opacity: 0.7;
}

.empty-title {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: bold;
  color: #000;
}

.empty-message {
  margin: 0 0 20px 0;
  font-size: 12px;
  color: #000;
  line-height: 1.4;
  max-width: 300px;
}

.empty-action {
  margin-top: 8px;
}

.action-button {
  background: #c0c0c0;
  color: #000;
  border: none;
  padding: 6px 16px;
  font-size: 11px;
  font-weight: normal;
  cursor: pointer;
  transition: none;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}

.action-button:active {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

/* Responsive */
@media (max-width: 480px) {
  .empty-state {
    padding: 40px 16px;
  }
  
  .empty-icon {
    font-size: 40px;
    margin-bottom: 20px;
  }
  
  .empty-title {
    font-size: 18px;
  }
  
  .empty-message {
    font-size: 14px;
  }
}
</style>
