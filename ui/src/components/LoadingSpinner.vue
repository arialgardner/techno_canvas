<template>
  <div class="loading-container">
    <div class="loading-content">
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>
      <h3 class="loading-title">{{ title }}</h3>
      <p v-if="message" class="loading-message">{{ message }}</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: 'Loading...'
  },
  message: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 40px 20px;
}

.loading-content {
  text-align: center;
  max-width: 300px;
}

.loading-spinner {
  display: inline-block;
  position: relative;
  width: 64px;
  height: 64px;
  margin-bottom: 20px;
}

.spinner-ring {
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: 51px;
  height: 51px;
  margin: 6px;
  border: 4px solid #000080;
  border-radius: 0;
  animation: spinner-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  border-color: #000080 transparent transparent transparent;
  box-shadow: 2px 2px 0 0 #808080;
}

.spinner-ring:nth-child(1) {
  animation-delay: -0.45s;
}

.spinner-ring:nth-child(2) {
  animation-delay: -0.3s;
}

.spinner-ring:nth-child(3) {
  animation-delay: -0.15s;
}

@keyframes spinner-ring {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-title {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: bold;
  color: #000;
}

.loading-message {
  margin: 0;
  font-size: 11px;
  color: #000;
  line-height: 1.4;
}

/* Skeleton loading variants */
.loading-container.skeleton .loading-spinner {
  display: none;
}

.skeleton-item {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
  margin-bottom: 12px;
}

.skeleton-item.rectangle {
  width: 100px;
  height: 100px;
  border-radius: 8px;
}

.skeleton-item.text {
  height: 16px;
  width: 60%;
}

.skeleton-item.text.short {
  width: 40%;
}

@keyframes skeleton-loading {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
</style>
