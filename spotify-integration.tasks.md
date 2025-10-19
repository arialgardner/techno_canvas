# Spotify Integration - Implementation Tasks (PRs)

This document breaks down the Spotify integration into discrete pull requests for implementation.

---

## PR 1: Spotify App Setup & Configuration
**Branch**: `feat/spotify-app-setup`

**Scope**: External setup and configuration (no code changes)

### Tasks
- [ ] Create Spotify Developer account at developer.spotify.com
- [ ] Register new app in Spotify Dashboard
  - App name: "Techno Canvas"
  - App description: "Collaborative canvas with integrated music playback"
  - Redirect URIs: 
    - `http://localhost:5173/spotify-callback` (development)
    - `https://{project-id}.web.app/spotify-callback` (production)
- [ ] Configure OAuth scopes: `streaming`, `user-read-email`, `user-read-private`, `user-modify-playback-state`, `playlist-read-private`, `playlist-read-collaborative`
- [ ] Copy Client ID and Client Secret
- [ ] Store credentials in Firebase config:
  ```bash
  firebase functions:config:set spotify.client_id="YOUR_CLIENT_ID"
  firebase functions:config:set spotify.client_secret="YOUR_CLIENT_SECRET"
  firebase functions:config:set spotify.redirect_uri="YOUR_REDIRECT_URI"
  ```
- [ ] Update `.env.local` for local development
- [ ] Document setup in `SPOTIFY_SETUP.md`

**Files Changed**: Configuration only, `SPOTIFY_SETUP.md` (new)

**Dependencies**: None

**Testing**: Verify credentials are accessible in functions

---

## PR 2: Backend - OAuth Functions (PKCE Flow)
**Branch**: `feat/spotify-oauth-backend`

**Scope**: Firebase Functions for Spotify authentication

### Tasks
- [ ] Create `functions/spotify/auth.js`
  - Generate PKCE code challenge
  - Build Spotify authorization URL
  - Return URL to frontend
- [ ] Create `functions/spotify/callback.js`
  - Exchange authorization code for tokens
  - Verify PKCE code verifier
  - Encrypt tokens using Firebase Admin SDK
  - Store in `users/{userId}/spotify/tokens`
  - Return success/error status
- [ ] Create `functions/spotify/refresh.js`
  - Check token expiry
  - Refresh access token using refresh_token
  - Update Firestore with new tokens
  - Return new access token
- [ ] Create `functions/spotify/revoke.js`
  - Revoke Spotify tokens
  - Delete user tokens from Firestore
  - Return success status
- [ ] Update `functions/index.js`
  - Export `spotifyAuth`, `spotifyCallback`, `spotifyRefresh`, `spotifyRevoke`
- [ ] Update `functions/package.json`
  - Add dependencies: `node-fetch`, `crypto`

**Files Changed**: 
- `functions/spotify/auth.js` (new)
- `functions/spotify/callback.js` (new)
- `functions/spotify/refresh.js` (new)
- `functions/spotify/revoke.js` (new)
- `functions/index.js` (modified)
- `functions/package.json` (modified)

**Dependencies**: PR 1

**Testing**: 
- Unit tests for PKCE generation
- Integration test for full OAuth flow
- Test token encryption/decryption
- Test token refresh logic

---

## PR 3: Backend - Playlist Functions
**Branch**: `feat/spotify-playlists-backend`

**Scope**: Firebase Functions for fetching Spotify playlists

### Tasks
- [ ] Create `functions/spotify/playlists.js`
  - Validate user authentication
  - Fetch access token from Firestore
  - Call Spotify API `/v1/me/playlists`
  - Handle pagination (fetch all playlists)
  - Return sanitized playlist data (id, name, images, description, tracks.total)
  - Handle token expiry (trigger refresh if needed)
- [ ] Update `functions/index.js`
  - Export `spotifyGetPlaylists`
- [ ] Add error handling for:
  - Invalid/expired tokens
  - Spotify API rate limits
  - Network errors

**Files Changed**:
- `functions/spotify/playlists.js` (new)
- `functions/index.js` (modified)

**Dependencies**: PR 2

**Testing**:
- Mock Spotify API responses
- Test pagination handling
- Test error scenarios (expired token, rate limit)

---

## PR 4: Frontend - Spotify Auth Composable
**Branch**: `feat/spotify-auth-composable`

**Scope**: Authentication logic and token management

### Tasks
- [ ] Create `ui/src/composables/useSpotifyAuth.js`
  - Generate PKCE code_verifier and code_challenge
  - `connectSpotify()` - Call backend auth function, redirect to Spotify
  - `handleCallback()` - Extract code from URL, call backend callback
  - `disconnectSpotify()` - Call backend revoke, clear local state
  - `getAccessToken()` - Get valid token (refresh if expired)
  - `isConnected` - Reactive ref for connection status
  - Listen to Firestore `users/{userId}/spotify/tokens` for real-time updates
- [ ] Add utility functions:
  - `generateCodeVerifier()` - Generate random string
  - `generateCodeChallenge()` - SHA256 hash of verifier
  - `saveVerifierToSession()` - Store in sessionStorage during OAuth flow
- [ ] Handle OAuth callback route
  - Create `ui/src/views/SpotifyCallbackView.vue`
  - Extract code and state from URL
  - Call `handleCallback()`
  - Redirect back to canvas
- [ ] Update `ui/src/router/index.js`
  - Add `/spotify-callback` route

**Files Changed**:
- `ui/src/composables/useSpotifyAuth.js` (new)
- `ui/src/views/SpotifyCallbackView.vue` (new)
- `ui/src/router/index.js` (modified)

**Dependencies**: PR 2

**Testing**:
- Test PKCE generation
- Test OAuth redirect flow
- Test callback handling
- Test token refresh logic
- Test disconnect flow

---

## PR 5: Frontend - Spotify Player Composable & SDK
**Branch**: `feat/spotify-player-composable`

**Scope**: Web Playback SDK integration and player controls

### Tasks
- [ ] Create `ui/src/composables/useSpotifyPlayer.js`
  - Load Spotify Web Playback SDK script
  - Initialize player with access token
  - `initializePlayer()` - Create Spotify.Player instance
  - `play(uri)` - Play track/playlist
  - `pause()` - Pause playback
  - `resume()` - Resume playback
  - `next()` - Skip to next track
  - `previous()` - Skip to previous track
  - `setVolume(volume)` - Set volume (0-1)
  - `getPlayerState()` - Get current playback state
  - Reactive state: `isPlaying`, `currentTrack`, `position`, `duration`, `volume`, `deviceId`
  - Handle player events: ready, player_state_changed, initialization_error
  - Auto-reconnect on network issues
  - Cleanup on component unmount
- [ ] Add Web Playback SDK to `ui/public/index.html`
  ```html
  <script src="https://sdk.scdn.co/spotify-player.js"></script>
  ```
- [ ] Handle Premium requirement errors
  - Detect non-Premium users
  - Show appropriate error message

**Files Changed**:
- `ui/src/composables/useSpotifyPlayer.js` (new)
- `ui/public/index.html` (modified)

**Dependencies**: PR 4

**Testing**:
- Test player initialization
- Test playback controls (requires Spotify Premium account)
- Test error handling (non-Premium, network issues)
- Test player cleanup

---

## PR 6: Frontend - Spotify Playlists Composable
**Branch**: `feat/spotify-playlists-composable`

**Scope**: Fetch and cache user playlists

### Tasks
- [ ] Create `ui/src/composables/useSpotifyPlaylists.js`
  - `fetchPlaylists()` - Call backend function to get playlists
  - Cache playlists in reactive ref with 5-minute TTL
  - `refreshPlaylists()` - Force refresh cache
  - Reactive state: `playlists`, `isLoading`, `error`
  - Handle errors gracefully

**Files Changed**:
- `ui/src/composables/useSpotifyPlaylists.js` (new)

**Dependencies**: PR 3, PR 4

**Testing**:
- Test playlist fetching
- Test caching behavior
- Test error handling

---

## PR 7: Frontend - Spotify UI Components
**Branch**: `feat/spotify-ui-components`

**Scope**: Build Spotify modal, player, and playlist UI

### Tasks
- [ ] Create `ui/src/components/SpotifyModal.vue`
  - Modal overlay with Windows 95 aesthetic
  - Header with "Spotify" title and close button
  - Connection state management
    - If not connected: Show "Connect Spotify" button
    - If connected: Show tabs (Player | Playlists) and disconnect button
  - Tab navigation
  - Props: `isVisible`, `canvasId`
  - Emit: `close`
  - z-index: 900 (above canvas, below other modals)

- [ ] Create `ui/src/components/SpotifyPlayer.vue`
  - Display current track info (album art, title, artist)
  - Playback controls (prev, play/pause, next)
  - Volume slider
  - Progress bar with current time / total time
  - Handle loading states
  - Handle errors (Premium required, SDK not loaded)
  - Windows 95 button styling

- [ ] Create `ui/src/components/SpotifyPlaylistCard.vue`
  - Display playlist image (with fallback)
  - Display playlist name
  - Display description (truncated)
  - Display track count
  - Click to open in Spotify (external link)
  - Hover effect
  - Grid layout support

- [ ] Create `ui/src/components/SpotifyPlaylistGrid.vue`
  - Grid container for playlist cards
  - Loading skeleton
  - Empty state
  - Error state

**Files Changed**:
- `ui/src/components/SpotifyModal.vue` (new)
- `ui/src/components/SpotifyPlayer.vue` (new)
- `ui/src/components/SpotifyPlaylistCard.vue` (new)
- `ui/src/components/SpotifyPlaylistGrid.vue` (new)

**Dependencies**: PR 4, PR 5, PR 6

**Testing**:
- Visual testing of all components
- Test modal open/close
- Test tab navigation
- Test player controls
- Test playlist grid rendering

---

## PR 8: Frontend - Toolbar Integration & Canvas Wiring
**Branch**: `feat/spotify-toolbar-integration`

**Scope**: Add Spotify button to toolbar and integrate with CanvasView

### Tasks
- [ ] Update `ui/src/components/Toolbar.vue`
  - Add "Spotify" button (music note icon)
  - Position: next to AI command button
  - Emit `spotify-toggled` event
  - Button should show active state when modal is open

- [ ] Update `ui/src/views/CanvasView.vue`
  - Import `SpotifyModal` component
  - Add modal state: `showSpotifyModal` ref
  - Handle `spotify-toggled` event from toolbar
  - Pass `canvasId` prop to SpotifyModal
  - Include modal in template (after other modals)

- [ ] Add Firestore rules for Spotify data
  - Update `firestore.rules`
  - Allow users to read/write their own tokens
  - Deny access to other users' tokens

**Files Changed**:
- `ui/src/components/Toolbar.vue` (modified)
- `ui/src/views/CanvasView.vue` (modified)
- `firestore.rules` (modified)

**Dependencies**: PR 7

**Testing**:
- Test toolbar button click
- Test modal toggle
- Test per-canvas isolation
- Test Firestore security rules

---

## PR 9: Documentation & Testing
**Branch**: `feat/spotify-documentation`

**Scope**: Documentation and end-to-end testing

### Tasks
- [ ] Create `docs/SPOTIFY_INTEGRATION.md`
  - User guide: How to connect Spotify
  - Developer guide: Architecture overview
  - Troubleshooting common issues
  - Premium requirement notice

- [ ] Create E2E tests in `ui/tests/`
  - `spotify-oauth-flow.spec.js` - Test OAuth flow (mock Spotify)
  - `spotify-player-controls.spec.js` - Test player UI
  - `spotify-playlists-display.spec.js` - Test playlist fetching and display
  - `spotify-modal-toggle.spec.js` - Test modal open/close

- [ ] Update `README.md`
  - Add Spotify integration section
  - Link to setup guide
  - List Premium requirement

- [ ] Create `SPOTIFY_SETUP.md`
  - Step-by-step setup instructions
  - Environment variables needed
  - Development vs Production configuration

**Files Changed**:
- `docs/SPOTIFY_INTEGRATION.md` (new)
- `ui/tests/spotify-oauth-flow.spec.js` (new)
- `ui/tests/spotify-player-controls.spec.js` (new)
- `ui/tests/spotify-playlists-display.spec.js` (new)
- `ui/tests/spotify-modal-toggle.spec.js` (new)
- `README.md` (modified)
- `SPOTIFY_SETUP.md` (new)

**Dependencies**: PR 8

**Testing**:
- Run all E2E tests
- Manual testing with real Spotify account
- Test on multiple browsers

---

## Implementation Order

1. **PR 1**: Spotify App Setup & Configuration *(External setup, no code)*
2. **PR 2**: Backend - OAuth Functions *(Independent)*
3. **PR 3**: Backend - Playlist Functions *(Depends on PR 2)*
4. **PR 4**: Frontend - Spotify Auth Composable *(Depends on PR 2)*
5. **PR 5**: Frontend - Spotify Player Composable & SDK *(Depends on PR 4)*
6. **PR 6**: Frontend - Spotify Playlists Composable *(Depends on PR 3, PR 4)*
7. **PR 7**: Frontend - Spotify UI Components *(Depends on PR 4, PR 5, PR 6)*
8. **PR 8**: Frontend - Toolbar Integration & Canvas Wiring *(Depends on PR 7)*
9. **PR 9**: Documentation & Testing *(Depends on PR 8)*

**Total PRs**: 9
**Estimated Timeline**: 2-3 weeks (assuming 1-2 PRs per day with testing)

---

## Development Mode Notes

- Spotify Developer Mode allows **25 test users** maximum
- Add test users manually in Spotify Dashboard under "Users and Access"
- To go production (unlimited users), apply for **Extended Quota Mode**
  - Free, but requires review (2-6 weeks)
  - Provide: app description, screenshots, use case justification
- All API usage is **free** (no costs for development or production)

---

## Testing Accounts Needed

- [ ] Spotify Premium account (for playback testing)
- [ ] Spotify Free account (for error handling testing)
- [ ] Firebase test project (separate from production)

