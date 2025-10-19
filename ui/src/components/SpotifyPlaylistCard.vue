<template>
  <div class="playlist-card" @click="openInSpotify">
    <div class="playlist-image">
      <img 
        v-if="playlist.images && playlist.images.length > 0" 
        :src="playlist.images[0].url" 
        :alt="playlist.name"
      />
      <div v-else class="placeholder-image">
        <span>♫</span>
      </div>
    </div>
    <div class="playlist-info">
      <h3 class="playlist-name">{{ playlist.name }}</h3>
      <p class="playlist-description">{{ truncatedDescription }}</p>
      <p class="playlist-meta">{{ playlist.tracks.total }} tracks</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SpotifyPlaylistCard',
  props: {
    playlist: {
      type: Object,
      required: true
    }
  },
  computed: {
    truncatedDescription() {
      if (!this.playlist.description) return 'No description'
      const maxLength = 80
      if (this.playlist.description.length <= maxLength) {
        return this.playlist.description
      }
      return this.playlist.description.substring(0, maxLength) + '...'
    }
  },
  methods: {
    openInSpotify() {
      if (this.playlist.external_urls?.spotify) {
        window.open(this.playlist.external_urls.spotify, '_blank')
      }
    }
  }
}
</script>

<style scoped>
.playlist-card {
  background: #c0c0c0;
  border: 2px solid #ffffff;
  border-right-color: #808080;
  border-bottom-color: #808080;
  padding: 8px;
  cursor: pointer;
  transition: transform 0.1s;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.playlist-card:hover {
  transform: translateY(-2px);
  border-color: #000080;
}

.playlist-card:active {
  border: 2px solid #808080;
  border-right-color: #ffffff;
  border-bottom-color: #ffffff;
  transform: translateY(0);
}

.playlist-image {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid #000;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.playlist-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: #808080;
}

.playlist-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.playlist-name {
  font-size: 14px;
  font-weight: bold;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-description {
  font-size: 11px;
  color: #000;
  margin: 0;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.playlist-meta {
  font-size: 11px;
  color: #808080;
  margin: 0;
  margin-top: auto;
}
</style>

