<template>
  <div class="audio-visualizer">
    <div class="visualizer-header">
      <span class="visualizer-title">♫ Audio</span>
      <button 
        class="mode-toggle" 
        @click="toggleMode"
        :title="mode === 'oscilloscope' ? 'Switch to Bars' : 'Switch to Oscilloscope'"
      >
        {{ mode === 'oscilloscope' ? '▬' : '∿' }}
      </button>
    </div>
    
    <div class="visualizer-display">
      <!-- Oscilloscope Mode -->
      <canvas 
        v-if="mode === 'oscilloscope'"
        ref="oscilloscopeCanvas" 
        class="visualizer-canvas"
        width="284"
        height="80"
      ></canvas>
      
      <!-- Pixel Bars Mode -->
      <div v-else class="pixel-bars">
        <div 
          v-for="i in barCount" 
          :key="i"
          class="bar"
          :style="{ height: barHeights[i - 1] + '%' }"
        ></div>
      </div>
    </div>
    
    <div class="visualizer-status">
      <span v-if="isPlaying" class="status-text">Now Playing</span>
      <span v-else class="status-text">No Audio</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useMusicPlayer } from '../composables/useMusicPlayer'

const { isPlaying } = useMusicPlayer()

// Mode: 'oscilloscope' or 'bars'
const mode = ref('oscilloscope')
const oscilloscopeCanvas = ref(null)
const barCount = 16
const barHeights = ref(Array(barCount).fill(10))

// Animation state
let animationFrameId = null
let time = 0

const toggleMode = () => {
  mode.value = mode.value === 'oscilloscope' ? 'bars' : 'oscilloscope'
  // Save preference
  localStorage.setItem('audioVisualizer_mode', mode.value)
}

// Load saved mode preference
onMounted(() => {
  const savedMode = localStorage.getItem('audioVisualizer_mode')
  if (savedMode) {
    mode.value = savedMode
  }
  
  // Only start animation if music is playing
  if (isPlaying.value) {
    startAnimation()
  } else {
    // Show flatline initially
    resetVisualization()
  }
})

onUnmounted(() => {
  stopAnimation()
})

// Watch for playing state changes
watch(isPlaying, (playing) => {
  if (playing) {
    // Start animating when music plays
    if (!animationFrameId) {
      startAnimation()
    }
  } else {
    // Stop animation and show flatline
    stopAnimation()
    resetVisualization()
  }
})

watch(mode, () => {
  // When switching modes, update visualization
  stopAnimation()
  if (isPlaying.value) {
    startAnimation()
  } else {
    resetVisualization()
  }
})

const startAnimation = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }
  // Reset time for smooth start
  time = 0
  animate()
}

const stopAnimation = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
}

const resetVisualization = () => {
  if (mode.value === 'bars') {
    // Set bars to minimum height
    barHeights.value = Array(barCount).fill(10)
  } else if (oscilloscopeCanvas.value) {
    // Draw flatline for oscilloscope
    const canvas = oscilloscopeCanvas.value
    const ctx = canvas.getContext('2d')
    const width = canvas.width
    const height = canvas.height
    const centerY = height / 2
    
    // Clear with black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, width, height)
    
    // Draw grid (retro CRT style)
    ctx.strokeStyle = '#003300'
    ctx.lineWidth = 1
    
    // Horizontal grid lines
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    
    // Vertical grid lines
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    
    // Show flat line (no audio)
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = 2
    ctx.shadowBlur = 4
    ctx.shadowColor = '#00ff00'
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()
    ctx.shadowBlur = 0
  }
}

const animate = () => {
  if (mode.value === 'oscilloscope') {
    animateOscilloscope()
  } else {
    animateBars()
  }
  
  // Only continue animating if music is playing
  if (isPlaying.value) {
    animationFrameId = requestAnimationFrame(animate)
  } else {
    animationFrameId = null
  }
}

// Oscilloscope visualization - retro CRT style
const animateOscilloscope = () => {
  if (!oscilloscopeCanvas.value) return
  
  const canvas = oscilloscopeCanvas.value
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  const centerY = height / 2
  
  // Clear with black background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)
  
  // Draw grid (retro CRT style)
  ctx.strokeStyle = '#003300'
  ctx.lineWidth = 1
  
  // Horizontal grid lines
  for (let y = 0; y < height; y += 20) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  
  // Vertical grid lines
  for (let x = 0; x < width; x += 20) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  
  if (!isPlaying.value) {
    // Show flat line when not playing
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()
    return
  }
  
  // Generate waveform data (simulated)
  time += 0.05
  const points = []
  const segments = 200
  
  for (let i = 0; i < segments; i++) {
    const x = (i / segments) * width
    
    // Create complex waveform by combining multiple frequencies
    const t = (i / segments) * Math.PI * 4 + time
    const wave1 = Math.sin(t * 2) * 25
    const wave2 = Math.sin(t * 3.5) * 15
    const wave3 = Math.sin(t * 7) * 8
    const wave4 = Math.sin(t * 0.5) * 12 // Slow modulation
    
    const y = centerY + wave1 + wave2 + wave3 + wave4
    
    points.push({ x, y })
  }
  
  // Draw waveform with green phosphor glow effect
  ctx.shadowBlur = 8
  ctx.shadowColor = '#00ff00'
  ctx.strokeStyle = '#00ff00'
  ctx.lineWidth = 2
  
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  
  ctx.stroke()
  
  // Add second pass for extra glow
  ctx.shadowBlur = 15
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
  }
  ctx.stroke()
  
  // Reset shadow
  ctx.shadowBlur = 0
}

// Pixel bars visualization - retro equalizer style
const animateBars = () => {
  if (!isPlaying.value) {
    // Set to minimum
    barHeights.value = Array(barCount).fill(10)
    return
  }
  
  time += 0.1
  
  const newHeights = []
  for (let i = 0; i < barCount; i++) {
    // Each bar oscillates at different frequency
    const baseFreq = 0.3 + i * 0.15
    const phase = time + i * 0.2
    
    // Combine multiple sine waves for more organic movement
    const wave1 = Math.sin(phase * baseFreq) * 30
    const wave2 = Math.sin(phase * baseFreq * 2) * 15
    const wave3 = Math.sin(phase * baseFreq * 0.5) * 20
    
    // Add some randomness for variety
    const noise = (Math.random() - 0.5) * 10
    
    let height = 50 + wave1 + wave2 + wave3 + noise
    
    // Create bass/treble pattern (lower bars = bass, higher bars = treble)
    if (i < 4 || i > 12) {
      height *= 1.2 // Boost outer bars
    }
    
    // Clamp between 10% and 95%
    height = Math.max(10, Math.min(95, height))
    
    newHeights.push(height)
  }
  
  barHeights.value = newHeights
}
</script>

<style scoped>
.audio-visualizer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: #000000;
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
  box-shadow: inset 1px 1px 0px 0px rgba(0,0,0,0.2);
}

.visualizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 4px;
  background: #000080;
  border: 1px solid #ffffff;
}

.visualizer-title {
  font-size: 11px;
  font-weight: bold;
  color: #ffffff;
  font-family: 'Tahoma', 'MS Sans Serif', sans-serif;
}

.mode-toggle {
  width: 20px;
  height: 20px;
  background: #c0c0c0;
  color: #000000;
  border: 1px solid #ffffff;
  border-right-color: #000000;
  border-bottom-color: #000000;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.mode-toggle:active {
  border: 1px solid #000000;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
}

.visualizer-display {
  background: #000000;
  border: 2px inset #808080;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
}

.visualizer-canvas {
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.pixel-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  width: 100%;
  height: 80px;
  padding: 4px;
  gap: 2px;
}

.bar {
  flex: 1;
  background: linear-gradient(to top, #00ff00, #00aa00);
  min-height: 4px;
  transition: height 0.1s ease-out;
  box-shadow: 0 0 4px rgba(0, 255, 0, 0.5);
  border: 1px solid #00ff00;
}

.visualizer-status {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2px;
  min-height: 16px;
}

.status-text {
  font-size: 10px;
  color: #00ff00;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
}
</style>

