<template>
  <div class="toolbar">
    <div class="toolbar-group">
      <button
        v-for="tool in tools"
        :key="tool.name"
        :class="['tool-button', { active: activeTool === tool.name }]"
        :title="`${tool.label}`"
        @click="selectTool(tool.name)"
      >
        <span class="tool-icon">{{ tool.icon }}</span>
        <span class="tool-label">{{ tool.label }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'Toolbar',
  props: {},
  emits: ['tool-selected'],
  setup(props, { emit }) {
    const activeTool = ref('select')
    
    const tools = [
      { name: 'select', label: 'Select', icon: '↖' },
      { name: 'pan', label: 'Pan', icon: '⊕' },
      { name: 'rectangle', label: 'Rectangle', icon: '▭' },
      { name: 'circle', label: 'Circle', icon: '○' },
      { name: 'line', label: 'Line', icon: '╱' },
      { name: 'text', label: 'Text', icon: 'T' }
    ]

    const selectTool = (toolName) => {
      activeTool.value = toolName
      emit('tool-selected', toolName)
    }

    return {
      activeTool,
      tools,
      selectTool
    }
  }
}
</script>

<style scoped>
.toolbar {
  position: fixed;
  top: 90px; /* Position below navbar (70px) + 20px margin */
  left: 50%;
  transform: translateX(-50%);
  background: #c0c0c0;
  padding: 4px;
  display: flex;
  gap: 4px;
  z-index: 100; /* Above canvas but below navbar */
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
}

.toolbar-group {
  display: flex;
  gap: 4px;
}

.tool-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  background: #c0c0c0;
  border: none;
  cursor: pointer;
  transition: none;
  min-width: 60px;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}

.tool-button:hover {
  background: #c0c0c0;
}

.tool-button:active {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.tool-button.active {
  background: #000080;
  color: white;
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.tool-icon {
  font-size: 18px;
  line-height: 1;
}

.tool-label {
  font-size: 10px;
  font-weight: normal;
  text-transform: none;
  letter-spacing: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .toolbar {
    top: 70px;
    padding: 4px;
  }

  .tool-button {
    min-width: 50px;
    padding: 5px 8px;
  }

  .tool-icon {
    font-size: 16px;
  }

  .tool-label {
    font-size: 9px;
  }
}
</style>

