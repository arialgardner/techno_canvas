<template>
  <div v-if="isVisible">
    <!-- Backdrop overlay -->
    <div class="queue-overlay"></div>
    
    <!-- Centered modal -->
    <div class="queue-viewer">
      <div class="header">
        <h4>Operation Queue</h4>
        <button class="close" @click="$emit('close')">×</button>
      </div>
      <div class="content">
        <div v-if="ops.length === 0" class="empty">No queued operations</div>
        <div v-else class="list">
          <div v-for="op in ops" :key="op.id" class="item">
            <div class="left">
              <span class="type" :class="op.type">{{ op.type }}</span>
              <span class="shape">{{ op.shapeId }}</span>
            </div>
            <div class="right">
              <span class="status">{{ op.status || 'pending' }}</span>
              <button class="btn" @click="retry(op)">Retry</button>
              <button class="btn danger" @click="remove(op)">Remove</button>
            </div>
          </div>
        </div>
      </div>
      <div class="footer">
        <button class="btn" @click="refresh">Refresh</button>
        <button class="btn danger" @click="clearAll" :disabled="ops.length === 0">Clear All</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue'
import { useOperationQueue } from '../composables/useOperationQueue'

export default {
  name: 'QueueViewer',
  props: { isVisible: { type: Boolean, default: false } },
  emits: ['close'],
  setup(props) {
    const { loadQueuedOperations, markCompleted, markFailed, clearQueue } = useOperationQueue()
    const ops = ref([])

    const refresh = async () => {
      ops.value = await loadQueuedOperations()
    }

    const retry = async (op) => {
      // Mark pending again; actual processing handled by reconnect flow in PR #6
      op.status = 'pending'
      await markFailed(op, null)
      await refresh()
    }

    const remove = async (op) => {
      await markCompleted(op.id)
      await refresh()
    }

    const clearAll = async () => {
      await clearQueue()
      await refresh()
    }

    watch(() => props.isVisible, (v) => { if (v) refresh() })
    onMounted(refresh)

    return { ops, refresh, retry, remove, clearAll }
  }
}
</script>

<style scoped>
.queue-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
}
.queue-viewer {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 500px;
  background: #c0c0c0;
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
  z-index: 2001;
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 6px;
  border-bottom: none;
  background: #000080;
  color: #fff;
}
.header h4 { 
  margin: 0; 
  font-size: 11px; 
  font-weight: bold;
}
.close { 
  background: #c0c0c0; 
  border: none; 
  font-size: 16px; 
  cursor: pointer; 
  color: #000;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  flex-shrink: 0;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}
.close:active { 
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}
.content { 
  flex: 1; 
  overflow: auto; 
  min-height: 0;
  background: #fff;
  border: 2px solid #808080;
  margin: 4px;
}
.empty { 
  padding: 12px; 
  color: #000; 
  font-size: 11px; 
  text-align: center; 
}
.list { display: flex; flex-direction: column; }
.item { 
  display: flex; 
  justify-content: space-between; 
  padding: 8px 10px; 
  border-bottom: 1px solid #808080;
}
.item:last-child {
  border-bottom: none;
}
.left { display: flex; gap: 6px; align-items: center; }
.type { 
  text-transform: uppercase; 
  font-size: 9px; 
  padding: 2px 4px; 
  background: #c0c0c0; 
  color: #000;
  border: 1px solid #808080;
  font-weight: bold;
}
.type.update { background: #00ffff; color: #000; }
.type.create { background: #00ff00; color: #000; }
.type.delete { background: #ff0000; color: #fff; }
.shape { font-size: 10px; color: #000; }
.right { display: flex; gap: 4px; align-items: center; }
.status { font-size: 10px; color: #000; margin-right: 4px; }
.btn { 
  background: #c0c0c0; 
  border: none;
  padding: 4px 8px; 
  font-size: 10px; 
  cursor: pointer; 
  color: #000; 
  transition: none;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}
.btn:active:not(:disabled) { 
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}
.btn:disabled { 
  opacity: 0.6; 
  cursor: not-allowed;
  color: #808080;
}
.btn.danger { 
  background: #c00; 
  color: #fff;
}
.btn.danger:active:not(:disabled) { 
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}
.btn.danger:disabled { 
  background: #c00; 
  opacity: 0.6;
}
.footer { 
  display: flex; 
  gap: 4px; 
  padding: 4px; 
  background: #c0c0c0;
}
</style>


