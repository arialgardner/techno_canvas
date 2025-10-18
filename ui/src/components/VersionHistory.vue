<template>
  <div v-if="isVisible" class="vh-overlay">
    <div class="vh-panel">
      <div class="vh-header">
        <h3>Version History</h3>
        <button class="vh-close" @click="$emit('close')">×</button>
      </div>
      <div class="vh-content">
        <div v-if="isLoading" class="vh-empty">Loading…</div>
        <div v-else-if="versions.length === 0" class="vh-empty">No versions yet</div>
        <div v-else class="vh-list">
          <div class="vh-item" v-for="ver in versions" :key="ver.id">
            <div class="vh-meta">
              <div class="vh-title">{{ formatWhen(ver.createdAt) }}</div>
              <div class="vh-sub">by {{ ver.createdByName || ver.createdBy || 'unknown' }} • {{ (ver.shapes || []).length }} shapes • {{ ver.summary || 'auto' }}</div>
            </div>
            <div class="vh-actions">
              <button class="vh-btn" :disabled="!canRestore" @click="$emit('restore', ver)">Restore</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
</template>

<script>
export default {
  name: 'VersionHistory',
  props: {
    isVisible: { type: Boolean, default: false },
    versions: { type: Array, default: () => [] },
    isLoading: { type: Boolean, default: false },
    canRestore: { type: Boolean, default: false }
  },
  emits: ['close', 'restore'],
  setup() {
    const formatWhen = (ts) => {
      try {
        if (!ts) return 'Unknown time'
        // Firestore Timestamp or millis or Date
        const d = ts.toDate ? ts.toDate() : (typeof ts === 'number' ? new Date(ts) : new Date(ts))
        return d.toLocaleString()
      } catch {
        return 'Unknown time'
      }
    }
    return { formatWhen }
  }
}
</script>

<style scoped>
.vh-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
  z-index: 2000;
}
.vh-panel {
  width: 560px;
  max-width: calc(100% - 40px);
  background: #c0c0c0;
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
  overflow: hidden;
}
.vh-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px;
  border-bottom: none;
  background: #000080;
  color: #fff;
}
.vh-header h3 {
  font-size: 11px;
  font-weight: bold;
  margin: 0;
}
.vh-close {
  background: #c0c0c0;
  border: none;
  width: 20px;
  height: 20px;
  cursor: pointer;
  color: #000;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}
.vh-close:active {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}
.vh-content { 
  max-height: 60vh; 
  overflow: auto;
  background: #fff;
  border: 2px solid #808080;
  margin: 4px;
}
.vh-empty { 
  padding: 12px; 
  color: #000; 
  text-align: center; 
  font-size: 11px;
}
.vh-list { display: flex; flex-direction: column; }
.vh-item { 
  display: flex; 
  align-items: center; 
  justify-content: space-between; 
  padding: 8px 12px; 
  border-bottom: 1px solid #808080;
}
.vh-item:last-child {
  border-bottom: none;
}
.vh-meta { display: flex; flex-direction: column; gap: 2px; }
.vh-title { font-weight: bold; color: #000; font-size: 11px; }
.vh-sub { font-size: 10px; color: #000; }
.vh-actions { display: flex; gap: 4px; }
.vh-btn { 
  background: #c0c0c0; 
  border: none;
  color: #000; 
  padding: 4px 10px; 
  cursor: pointer;
  transition: none;
  font-size: 11px;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}
.vh-btn:active:not(:disabled) {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}
.vh-btn:disabled { 
  opacity: 0.6; 
  cursor: not-allowed;
  color: #808080;
}
</style>


