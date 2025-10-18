<template>
  <div class="toasts">
    <div v-for="t in toasts" :key="t.id" :class="['toast', t.type]">
      <span class="msg">{{ t.message }}</span>
      <button class="close" @click="remove(t.id)">×</button>
    </div>
  </div>
</template>

<script setup>
import { useNotifications } from '../composables/useNotifications'
const { toasts, remove } = useNotifications()
</script>

<style scoped>
.toasts {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
}
.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  color: #000;
  min-width: 240px;
  background: #c0c0c0;
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
  font-size: 11px;
}
.toast.info { 
  background: #00ffff;
  border-left: 4px solid #0000ff;
}
.toast.success { 
  background: #00ff00;
  border-left: 4px solid #008000;
}
.toast.warning { 
  background: #ffff00;
  border-left: 4px solid #ff8000;
}
.toast.error { 
  background: #ff0000;
  color: #fff;
  border-left: 4px solid #800000;
}
.close { 
  background: #c0c0c0;
  border: none;
  color: #000;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff;
}
.close:active {
  box-shadow: inset 1px 1px 0 0 #000000;
}
.toast.error .close {
  color: #fff;
}
</style>


