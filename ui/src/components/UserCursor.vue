<template>
  <div 
    class="user-cursor" 
    :style="cursorStyle"
    :data-testid="`user-cursor`"
    :data-user-id="cursor.userId"
  >
    <!-- Cursor Icon (SVG Arrow) -->
    <svg 
      class="cursor-icon" 
      viewBox="0 0 24 24" 
      :style="{ fill: cursor.cursorColor }"
    >
      <path d="M12 2l3.09 6.26L22 9l-5.91 4.74L18 22l-6-3.27L6 22l1.91-8.26L2 9l6.91-.74L12 2z"/>
    </svg>
    
    <!-- User Name Label -->
    <div 
      class="cursor-label"
      :style="{ backgroundColor: cursor.cursorColor }"
    >
      {{ cursor.userName }}
    </div>
  </div>
</template>

<script>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'

export default {
  name: 'UserCursor',
  props: {
    cursor: {
      type: Object,
      required: true
    },
    stageAttrs: {
      type: Object,
      default: () => ({})
    }
  },
  setup(props) {
    const cursorElement = ref(null)

    // Interpolation state
    const currentPos = ref({ x: 0, y: 0 })
    const targetPos = ref({ x: 0, y: 0 })
    const lastPos = ref({ x: 0, y: 0 })
    const lastUpdateTs = ref(0)
    let rafId = null

    // Convert canvas -> screen
    const toScreen = (canvasX, canvasY) => {
      const scaleX = props.stageAttrs.scaleX || 1
      const scaleY = props.stageAttrs.scaleY || 1
      const offsetX = props.stageAttrs.x || 0
      const offsetY = props.stageAttrs.y || 0
      return {
        x: canvasX * scaleX + offsetX,
        y: canvasY * scaleY + offsetY
      }
    }

    // Update target when prop changes
    const updateTargetFromProps = () => {
      const canvasX = props.cursor.x || 0
      const canvasY = props.cursor.y || 0
      const screen = toScreen(canvasX, canvasY)
      lastPos.value = { ...targetPos.value }
      targetPos.value = screen
      lastUpdateTs.value = performance.now()
    }

    watch(() => [props.cursor.x, props.cursor.y, props.stageAttrs.x, props.stageAttrs.y, props.stageAttrs.scaleX, props.stageAttrs.scaleY], () => {
      updateTargetFromProps()
    })

    // rAF interpolation with light prediction
    const TWEEN_DURATION = 80 // ms tween between updates
    const MAX_PREDICT = 50    // ms max prediction window

    const step = () => {
      const now = performance.now()
      const dt = now - lastUpdateTs.value

      // Linear interpolation factor 0..1 over TWEEN_DURATION
      const t = Math.max(0, Math.min(1, dt / TWEEN_DURATION))

      // Basic velocity estimate from last segment
      const vx = targetPos.value.x - lastPos.value.x
      const vy = targetPos.value.y - lastPos.value.y

      let predictedX = targetPos.value.x
      let predictedY = targetPos.value.y

      // Light prediction beyond last target for small dt overrun
      if (dt > TWEEN_DURATION && dt < TWEEN_DURATION + MAX_PREDICT) {
        const over = dt - TWEEN_DURATION
        const k = over / MAX_PREDICT // 0..1
        predictedX = targetPos.value.x + vx * k * 0.5
        predictedY = targetPos.value.y + vy * k * 0.5
      }

      currentPos.value = {
        x: lastPos.value.x + (predictedX - lastPos.value.x) * t,
        y: lastPos.value.y + (predictedY - lastPos.value.y) * t
      }

      rafId = requestAnimationFrame(step)
    }

    onMounted(() => {
      updateTargetFromProps()
      currentPos.value = { ...targetPos.value }
      rafId = requestAnimationFrame(step)
    })

    onUnmounted(() => {
      if (rafId) cancelAnimationFrame(rafId)
    })

    // Cursor positioning style
    const cursorStyle = computed(() => ({
      position: 'absolute',
      left: `${currentPos.value.x}px`,
      top: `${currentPos.value.y}px`,
      pointerEvents: 'none',
      zIndex: 1000,
      transform: 'translate(-2px, -2px)'
    }))

    return {
      cursorStyle,
      cursorElement
    }
  }
}
</script>

<style scoped>
.user-cursor {
  position: absolute;
  pointer-events: none;
  user-select: none;
}

.cursor-icon {
  width: 20px;
  height: 20px;
  filter: drop-shadow(1px 1px 0 #000);
}

.cursor-label {
  position: absolute;
  top: 22px;
  left: 8px;
  color: white;
  padding: 2px 4px;
  border-radius: 0;
  font-size: 11px;
  font-weight: bold;
  white-space: nowrap;
  border: 1px solid #000;
  box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.5);
  min-width: 0;
}

/* Retro pointer tail */
.cursor-label::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 6px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid #000;
}

.cursor-label::after {
  content: '';
  position: absolute;
  top: -3px;
  left: 6px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid currentColor;
}

/* Instant appearance (no smooth animation) */
.user-cursor {
  animation: cursorAppear 0.05s steps(1);
}

@keyframes cursorAppear {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Hide cursor when too close to edges */
.user-cursor.near-edge {
  opacity: 0.7;
}
</style>
