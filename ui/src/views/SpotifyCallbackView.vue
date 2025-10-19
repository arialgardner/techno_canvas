<template>
  <div class="callback-container">
    <div class="callback-content">
      <div v-if="isProcessing" class="processing">
        <div class="spinner"></div>
        <h2>Connecting to Spotify...</h2>
        <p>Please wait while we complete the authorization</p>
      </div>

      <div v-else-if="error" class="error-state">
        <h2>❌ Connection Failed</h2>
        <p>{{ error }}</p>
        <button @click="goBack" class="back-button">Go Back</button>
      </div>

      <div v-else class="success-state">
        <h2>✅ Connected Successfully!</h2>
        <p>Redirecting you back to your canvas...</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSpotifyAuth } from '../composables/useSpotifyAuth'

export default {
  name: 'SpotifyCallbackView',
  setup() {
    const router = useRouter()
    const route = useRoute()
    const { handleCallback } = useSpotifyAuth()

    const isProcessing = ref(true)
    const error = ref(null)

    onMounted(async () => {
      try {
        // Extract code and state from URL
        const code = route.query.code
        const state = route.query.state
        const errorParam = route.query.error

        if (errorParam) {
          throw new Error(`Spotify authorization failed: ${errorParam}`)
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state')
        }

        // Handle the callback
        const success = await handleCallback(code, state)

        if (success) {
          // Redirect back to dashboard or last canvas
          const returnPath = sessionStorage.getItem('spotify_return_path') || '/dashboard'
          sessionStorage.removeItem('spotify_return_path')

          setTimeout(() => {
            router.push(returnPath)
          }, 1500)
        } else {
          throw new Error('Failed to complete authorization')
        }
      } catch (err) {
        console.error('Callback error:', err)
        error.value = err.message
        isProcessing.value = false
      }
    })

    const goBack = () => {
      const returnPath = sessionStorage.getItem('spotify_return_path') || '/dashboard'
      sessionStorage.removeItem('spotify_return_path')
      router.push(returnPath)
    }

    return {
      isProcessing,
      error,
      goBack,
    }
  }
}
</script>

<style scoped>
.callback-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.callback-content {
  background: #c0c0c0;
  border: 2px solid #fff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  padding: 40px;
  max-width: 500px;
  text-align: center;
}

.processing,
.error-state,
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #c0c0c0;
  border-top: 4px solid #000080;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

h2 {
  margin: 0;
  font-size: 20px;
  color: #000;
}

p {
  margin: 0;
  color: #000;
  line-height: 1.5;
}

.error-state h2 {
  color: #c00;
}

.success-state h2 {
  color: #080;
}

.back-button {
  margin-top: 16px;
  padding: 8px 24px;
  background: #c0c0c0;
  border: 2px solid #fff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  cursor: pointer;
  font-size: 14px;
}

.back-button:active {
  border: 2px solid #808080;
  border-right-color: #fff;
  border-bottom-color: #fff;
}
</style>

