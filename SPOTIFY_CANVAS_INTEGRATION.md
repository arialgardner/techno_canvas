# Spotify Player in Canvas View

## What's Been Added

### 1. Persistent Mini Player Bar

A **Spotify mini player** now appears at the bottom of the canvas when you're connected to Spotify.

```
┌─────────────────────────────────────────────────────────┐
│                      Toolbar (Top)                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│                    Canvas Area                           │
│                                                          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ [🎵] Track Name - Artist  [⏮][▶][⏭]  ─●──  🔊──●── [♫] │  ← Mini Player
└─────────────────────────────────────────────────────────┘
```

### 2. Features

The mini player includes:

✅ **Album Art** - Shows current track's album cover
✅ **Track Info** - Song name and artist
✅ **Playback Controls** - Previous, Play/Pause, Next
✅ **Progress Bar** - Shows playback position and duration
✅ **Volume Control** - Adjust volume with slider
✅ **Modal Button** - Click ♫ to open full Spotify modal

### 3. When It Appears

- ✅ Only shows when **connected to Spotify**
- ✅ Automatically initializes player on connection
- ✅ Persists across canvas navigation
- ✅ Updates in real-time as music plays

### 4. Layout

The canvas area has been adjusted to make room for the mini player:

- **Top**: 70px (navbar)
- **Bottom**: 80px (mini player) ← NEW
- **Right**: 300px (properties panel)
- **Left**: 0px

## User Flow

### First Time User

1. Click **Spotify button** (♫) in toolbar
2. Modal opens → Click **"Connect Spotify"**
3. Authorize on Spotify → Redirected back to canvas
4. **Mini player appears** at bottom
5. Player automatically initializes
6. Open modal to browse playlists

### Returning User (Already Connected)

1. Open canvas
2. **Mini player automatically appears** at bottom
3. Shows last played track (if any)
4. Controls work immediately
5. Can browse playlists via modal button

## Component Hierarchy

```
CanvasView
├── Toolbar (top)
│   └── Spotify Button (♫)
├── Canvas Workspace (center)
├── PropertiesPanel (right)
├── SpotifyMiniPlayer (bottom) ← NEW
│   ├── Album Art
│   ├── Track Info
│   ├── Playback Controls
│   ├── Progress Bar
│   ├── Volume Control
│   └── Modal Button
└── SpotifyModal (overlay)
    ├── Player Tab
    └── Playlists Tab
```

## Technical Details

### Component: `SpotifyMiniPlayer.vue`

**Props**: None
**Emits**: `open-modal` (when ♫ button clicked)

**Features**:
- Auto-initializes player when connected
- Real-time playback state updates
- Responsive design (hides some elements on mobile)
- Windows 95 aesthetic matching canvas

### Integration Points

**CanvasView.vue**:
- Added `<SpotifyMiniPlayer>` component
- Adjusted canvas wrapper `bottom: 80px`
- Wired up modal toggle

**SpotifyAuth.js**:
- Saves current path before OAuth redirect
- Returns user to same canvas after connection

## Responsive Behavior

### Desktop (> 1200px)
- Full mini player with all controls
- Album art, track info, controls, progress, volume

### Tablet (768px - 1200px)
- Simplified mini player
- Hides some controls to save space

### Mobile (< 768px)
- Compact mini player
- Only essential controls shown
- Progress and volume hidden

## State Management

The mini player shares state with the modal through composables:

- **useSpotifyAuth** - Connection state
- **useSpotifyPlayer** - Player state (shared instance)
- **useSpotifyPlaylists** - Not used in mini player

This means:
- Changes in modal affect mini player
- Changes in mini player affect modal
- Single player instance across app

## Visual Examples

### Mini Player States

#### 1. Not Connected (Hidden)
```
[Mini player is not visible]
```

#### 2. Connected - No Track Playing
```
┌────────────────────────────────────────────────┐
│ [♫] Not playing  [⏮][▶][⏭]  0:00  ───  3:00  │
└────────────────────────────────────────────────┘
```

#### 3. Connected - Track Playing
```
┌────────────────────────────────────────────────┐
│ [🎵] Daft Punk - Get Lucky  [⏮][⏸][⏭] 1:23 ─●─ 4:08  🔊──●──  [♫] │
└────────────────────────────────────────────────┘
```

#### 4. Connected - Paused
```
┌────────────────────────────────────────────────┐
│ [🎵] Daft Punk - Get Lucky  [⏮][▶][⏭] 1:23 ─●─ 4:08  🔊──●──  [♫] │
└────────────────────────────────────────────────┘
```

## Interactions

### Click Album Art
- No action (visual only)

### Click Track Info
- No action (visual only)

### Click Previous (⏮)
- Skips to previous track
- Disabled if no track playing

### Click Play/Pause (▶/⏸)
- Toggles playback
- Always enabled

### Click Next (⏭)
- Skips to next track
- Disabled if no track playing

### Drag Progress Bar
- (Not yet implemented - future enhancement)

### Drag Volume Slider
- Adjusts volume 0-100%

### Click Modal Button (♫)
- Opens Spotify modal
- Shows Player and Playlists tabs

## Styling

**Theme**: Windows 95
- Gray (#c0c0c0) background
- Beveled borders (light/dark)
- Blue (#000080) accent for active states
- System fonts (Tahoma, MS Sans Serif)

**Dimensions**:
- Height: 80px (fixed)
- Width: Full width minus properties panel
- Z-index: 99 (above canvas, below toolbar/modals)

## Performance

**Optimizations**:
- Only renders when connected
- Shared player instance (no duplication)
- Minimal re-renders (reactive state)
- CSS transitions for smooth UI

**Resource Usage**:
- ~50KB component size
- Minimal memory footprint
- No additional API calls (uses existing composables)

## Future Enhancements

Potential improvements:

1. **Seekable Progress Bar** - Click/drag to seek
2. **Repeat/Shuffle** - Toggle playback modes
3. **Queue Display** - Show upcoming tracks
4. **Minimize Button** - Hide mini player temporarily
5. **Lyrics Display** - Show synchronized lyrics
6. **Collaborative Mode** - Show what others are listening to
7. **Canvas Sync** - Sync playback across all users in canvas

## Testing Checklist

- [ ] Mini player appears when connected
- [ ] Mini player hidden when not connected
- [ ] Album art displays correctly
- [ ] Track info updates in real-time
- [ ] Play/pause works
- [ ] Previous/next controls work
- [ ] Progress bar updates smoothly
- [ ] Volume control adjusts playback
- [ ] Modal button opens modal
- [ ] Canvas area doesn't overlap mini player
- [ ] Responsive layout works on all screen sizes
- [ ] State syncs between mini player and modal

## Troubleshooting

### Mini Player Not Appearing

**Cause**: Not connected to Spotify
**Solution**: Click Spotify button in toolbar and connect

### Controls Disabled

**Cause**: Player not initialized or Premium required
**Solution**: Check browser console for errors, verify Premium account

### Progress Bar Not Moving

**Cause**: Track not actually playing
**Solution**: Click play button, check Spotify app

### Volume Control Not Working

**Cause**: SDK not loaded or player error
**Solution**: Reload page, check browser console

---

**Summary**: The Spotify mini player provides persistent music controls directly in your canvas view, making it easy to control playback without leaving your workspace!

