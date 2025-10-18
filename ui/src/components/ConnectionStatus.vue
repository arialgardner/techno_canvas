<template>
  <div>
    <div class="connection-status" @click="toggleExpanded" :title="tooltip">
      <span :class="['dot', statusClass]"></span>
      <span class="text">{{ label }}</span>
      <svg class="chevron" viewBox="0 0 20 20" :class="{ rotated: expanded }">
        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
      </svg>

      <div v-if="expanded" class="panel">
        <div class="dropdown-header">Connection</div>
        <div class="row actions">
          <button class="btn" @click.stop="syncNow">Sync Now</button>
          <button class="btn" @click.stop="retryConnection" :disabled="isConnected">Retry</button>
          <button class="btn" @click.stop="toggleQueue">View Queue</button>
        </div>
        <div v-if="state.error" class="error">{{ state.error }}</div>
      </div>
    </div>

    <!-- Click outside to close dropdown -->
    <div 
      v-if="expanded" 
      @click="expanded = false"
      class="dropdown-overlay"
    ></div>

    <!-- Queue Viewer Modal (outside dropdown) -->
    <QueueViewer :is-visible="showQueue" @close="showQueue = false" />
  </div>
</template>

<script>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useConnectionState, CONNECTION_STATUS } from '../composables/useConnectionState'
import QueueViewer from './QueueViewer.vue'

export default {
  name: 'ConnectionStatus',
  components: { QueueViewer },
  setup() {
    const { state, syncNow, retryConnection, init, cleanup } = useConnectionState()
    const expanded = ref(false)
    const showQueue = ref(false)

    onMounted(() => {
      init()
    })

    onUnmounted(() => {
      cleanup()
    })

    const statusClass = computed(() => {
      switch (state.status) {
        case CONNECTION_STATUS.CONNECTED: return 'green'
        case CONNECTION_STATUS.SYNCING: return 'blue'
        case CONNECTION_STATUS.OFFLINE: return 'yellow'
        case CONNECTION_STATUS.ERROR: return 'red'
        default: return 'gray'
      }
    })

    const label = computed(() => {
      switch (state.status) {
        case CONNECTION_STATUS.CONNECTED: return 'Connected'
        case CONNECTION_STATUS.SYNCING: return 'Syncing...'
        case CONNECTION_STATUS.OFFLINE: return 'Offline'
        case CONNECTION_STATUS.ERROR: return 'Connection Error'
        default: return 'Unknown'
      }
    })

    const tooltip = computed(() => {
      switch (state.status) {
        case CONNECTION_STATUS.CONNECTED: return 'Real-time sync active'
        case CONNECTION_STATUS.SYNCING: return `Processing ${state.queueLength} operations...`
        case CONNECTION_STATUS.OFFLINE: return `Changes saved locally • ${state.queueLength} queued`
        case CONNECTION_STATUS.ERROR: return 'Retrying...'
        default: return ''
      }
    })

    const toggleExpanded = () => expanded.value = !expanded.value
    const toggleQueue = () => showQueue.value = !showQueue.value
    const formatTime = (ts) => new Date(ts).toLocaleTimeString()

    const isConnected = computed(() => state.status === CONNECTION_STATUS.CONNECTED)

    return {
      state,
      label,
      statusClass,
      expanded,
      toggleExpanded,
      toggleQueue,
      formatTime,
      syncNow,
      retryConnection,
      tooltip,
      showQueue,
      isConnected
    }
  }
}
</script>

<style scoped>
.connection-status {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #c0c0c0;
  border: none;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
  cursor: pointer;
  position: relative;
  font-size: 11px;
}
.connection-status:active {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 0;
  border: 1px solid #000;
}
.dot.green { background: #00ff00; }
.dot.blue { background: #0000ff; }
.dot.yellow { background: #ffff00; }
.dot.red { background: #ff0000; }
.dot.gray { background: #808080; }
.text { color: #000; font-size: 11px; }
.chevron { width: 12px; height: 12px; fill: #000; transition: transform 0.1s; }
.chevron.rotated { transform: rotate(180deg); }
.panel {
  position: absolute;
  top: 110%;
  right: 0;
  background: #c0c0c0;
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
  padding: 0;
  z-index: 1001;
  width: 120px;
  overflow: hidden;
}
.dropdown-header {
  padding: 4px 6px;
  font-weight: bold;
  color: #fff;
  border-bottom: 2px solid #808080;
  font-size: 10px;
  background: #000080;
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.2;
}
.row {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.row.actions { 
  gap: 0;
  flex-direction: column;
}
.btn {
  background: #c0c0c0;
  border: none;
  padding: 4px 6px;
  font-size: 10px;
  cursor: pointer;
  color: #000;
  transition: none;
  text-align: center;
  width: 100%;
  border-bottom: 1px solid #808080;
  box-sizing: border-box;
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.3;
}
.btn:last-child {
  border-bottom: none;
}
.btn:hover:not(:disabled) { 
  background: #000080; 
  color: #fff;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  color: #808080;
}
.btn:disabled:hover {
  background: #c0c0c0;
  color: #808080;
}
.error { 
  color: #c00; 
  font-size: 10px; 
  padding: 6px 8px;
  background: #fff;
  border-top: 2px solid #808080;
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.3;
}
.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}
</style>


