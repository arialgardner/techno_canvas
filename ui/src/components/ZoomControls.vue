<template>
  <div class="zoom-controls">
    <div class="zoom-display">
      {{ Math.round(zoom * 100) }}%
    </div>
    
    <button 
      @click="$emit('zoom-in')"
      class="zoom-button"
      title="Zoom In"
    >
      <svg class="zoom-icon" viewBox="0 0 24 24">
        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
      </svg>
    </button>
    
    <button 
      @click="$emit('zoom-out')"
      class="zoom-button"
      title="Zoom Out"
    >
      <svg class="zoom-icon" viewBox="0 0 24 24">
        <path d="M19 13H5v-2h14v2z"/>
      </svg>
    </button>
    
    <button 
      @click="$emit('zoom-reset')"
      class="zoom-button reset"
      title="Reset Zoom (100%)"
    >
      <svg class="zoom-icon" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    </button>
  </div>
</template>

<script>
export default {
  name: 'ZoomControls',
  props: {
    zoom: {
      type: Number,
      required: true
    }
  },
  emits: ['zoom-in', 'zoom-out', 'zoom-reset']
}
</script>

<style scoped>
.zoom-controls {
  position: fixed;
  bottom: 2rem;
  left: 2rem; /* Move to bottom-left to avoid AI panel on right */
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 1000;
  background: #c0c0c0;
  padding: 4px;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
  border: 2px solid #000;
}

.zoom-display {
  text-align: center;
  font-size: 11px;
  font-weight: bold;
  color: #000;
  padding: 4px;
  border-bottom: 1px solid #808080;
  margin-bottom: 2px;
  background: #fff;
  box-shadow: inset -1px -1px 0 0 #ffffff, inset 1px 1px 0 0 #808080;
}

.zoom-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: #c0c0c0;
  color: #000;
  cursor: pointer;
  transition: none;
  padding: 0;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}

.zoom-button:hover {
  background: #c0c0c0;
}

.zoom-button:active {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.zoom-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

/* Responsive adjustments - keep small and in corner */
@media (max-width: 1200px) {
  .zoom-controls {
    padding: 4px;
    gap: 3px;
  }
  
  .zoom-display {
    font-size: 10px;
    padding: 3px;
  }
  
  .zoom-button {
    width: 28px;
    height: 28px;
  }
  
  .zoom-icon {
    width: 14px;
    height: 14px;
  }
}

@media (max-width: 768px) {
  .zoom-controls {
    bottom: 1rem;
    left: 1rem;
    padding: 3px;
    gap: 3px;
  }
  
  .zoom-display {
    font-size: 10px;
    padding: 3px;
    margin-bottom: 2px;
  }
  
  .zoom-button {
    width: 26px;
    height: 26px;
  }
  
  .zoom-icon {
    width: 14px;
    height: 14px;
  }
}

/* Very small screens - even more compact */
@media (max-width: 480px) {
  .zoom-controls {
    bottom: 0.75rem;
    left: 0.75rem;
    padding: 3px;
    gap: 2px;
  }
  
  .zoom-display {
    font-size: 9px;
    padding: 2px;
  }
  
  .zoom-button {
    width: 24px;
    height: 24px;
  }
  
  .zoom-icon {
    width: 12px;
    height: 12px;
  }
}
</style>
