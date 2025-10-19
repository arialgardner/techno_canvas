import { ref, readonly } from 'vue'

// Shared state for playlist browser
const isPlaying = ref(false)
const currentTrackName = ref('')

export function useMusicPlayer() {
  const setPlaying = (playing) => {
    isPlaying.value = playing
  }

  const setTrackName = (name) => {
    currentTrackName.value = name
  }

  return {
    isPlaying: readonly(isPlaying),
    currentTrackName: readonly(currentTrackName),
    setPlaying,
    setTrackName
  }
}

