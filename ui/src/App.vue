<template>
  <div id="app">
    <!-- Error Handler (global) -->
    <ErrorHandler />
    
    <!-- Navigation Bar (only show on canvas route) -->
    <NavBar 
      v-if="showNavBar" 
      :canvasId="currentCanvasId"
      :canUserEdit="canUserEdit"
      :isOwner="isCanvasOwner"
      @toggle-versions="handleToggleVersions" 
      @save-version="handleSaveVersion" 
    />
    
    <!-- Router View -->
    <router-view />
  </div>
</template>

<script>
import { computed, onMounted, provide, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NavBar from './components/NavBar.vue'
import ErrorHandler from './components/ErrorHandler.vue'
import { useErrorHandling } from './composables/useErrorHandling'
import { useCanvases } from './composables/useCanvases'
import { useAuth } from './composables/useAuth'

export default {
  name: 'App',
  components: {
    NavBar,
    ErrorHandler
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const { setupNetworkMonitoring } = useErrorHandling()
    const { currentCanvas, canEdit, getUserRole } = useCanvases()
    const { user } = useAuth()
    
    // Provide controls for version history modal
    const versionHistoryTrigger = ref(0)
    const saveVersionTrigger = ref(0)
    provide('versionHistoryTrigger', versionHistoryTrigger)
    provide('saveVersionTrigger', saveVersionTrigger)
    
    // Only show navbar on canvas route (not on auth page)
    const showNavBar = computed(() => {
      return route.name === 'Canvas'
    })
    
    // Get current canvas ID from route
    const currentCanvasId = computed(() => {
      return route.params.canvasId || 'default'
    })
    
    // Check if user can edit the current canvas (owner or editor)
    const canUserEdit = computed(() => {
      if (!user.value || !currentCanvas.value) return false
      return canEdit(currentCanvas.value, user.value.uid)
    })
    
    // Check if user is the canvas owner
    const isCanvasOwner = computed(() => {
      if (!user.value || !currentCanvas.value) return false
      const role = getUserRole(currentCanvas.value, user.value.uid)
      return role === 'owner'
    })
    
    // Set up global error handling
    onMounted(() => {
      setupNetworkMonitoring()
    })
    
    const handleToggleVersions = () => {
      // Trigger version history modal without URL change
      versionHistoryTrigger.value++
    }

    const handleSaveVersion = () => {
      // Trigger save version action without URL change
      saveVersionTrigger.value++
    }

    return {
      showNavBar,
      currentCanvasId,
      canUserEdit,
      isCanvasOwner,
      handleToggleVersions,
      handleSaveVersion
    }
  }
}
</script>

<style>
/* Global styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
}

#app {
  height: 100vh;
  width: 100vw;
  max-width: 100%;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Make sure router-view takes remaining space */
.router-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Windows 98 Theme - Global Button Styles */
.theme-win98 button,
.window button,
button {
  border-radius: 0 !important;
}

/* Windows 98 Theme - Window Component Styles */
.theme-win98 .window {
  background: #c0c0c0;
  border: 2px solid #000;
  box-shadow: inset -1px -1px 0 0 #808080, inset 1px 1px 0 0 #ffffff;
}

.theme-win98 .window .inner {
  padding: 0;
}

.theme-win98 .window .header {
  background: #000080;
  color: #fff;
  padding: 4px 6px;
  font-size: 11px;
  font-weight: bold;
}

.theme-win98 .window .content {
  padding: 8px;
}

.theme-win98 button,
.window button {
  background: #c0c0c0;
  border: none;
  padding: 4px 12px;
  font-size: 11px;
  color: #000;
  box-shadow: inset -1px -1px 0 0 #000000, inset 1px 1px 0 0 #ffffff, inset -2px -2px 0 0 #808080, inset 2px 2px 0 0 #dfdfdf;
}

.theme-win98 button:active,
.window button:active {
  box-shadow: inset 1px 1px 0 0 #000000, inset 0 0 0 1px #808080;
}

.theme-win98 button:disabled,
.window button:disabled {
  color: #808080;
  opacity: 0.6;
}

.theme-win98 input,
.theme-win98 select,
.theme-win98 textarea {
  border: none;
  box-shadow: inset -1px -1px 0 0 #ffffff, inset 1px 1px 0 0 #808080, inset -2px -2px 0 0 #dfdfdf, inset 2px 2px 0 0 #000000;
  padding: 3px 4px;
  font-size: 11px;
  background: #fff;
  color: #000;
}

.theme-win98 input:focus,
.theme-win98 select:focus,
.theme-win98 textarea:focus {
  outline: 1px dotted #000;
  outline-offset: -2px;
}
</style>