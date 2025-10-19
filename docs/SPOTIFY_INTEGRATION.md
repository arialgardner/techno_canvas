# Spotify Integration Documentation

## Overview

Techno Canvas integrates Spotify's Web Playback SDK to provide in-app music playback. Users can connect their Spotify Premium accounts, browse their playlists, and control music playback directly within their canvas workspace.

## Architecture

### OAuth Flow (PKCE)

```
1. User clicks "Connect Spotify"
2. Frontend generates code_verifier and code_challenge
3. Frontend calls spotifyAuth function → receives auth URL
4. User redirected to Spotify for authorization
5. Spotify redirects back with authorization code
6. Frontend calls spotifyCallback with code and verifier
7. Backend exchanges code for tokens
8. Tokens stored in Firestore (user-specific)
9. Frontend listens to token updates via real-time listener
```

### Components

#### Backend (Firebase Functions)

- **spotifyAuth** - Generates Spotify authorization URL with PKCE challenge
- **spotifyCallback** - Exchanges authorization code for access/refresh tokens
- **spotifyRefresh** - Refreshes expired access tokens
- **spotifyRevoke** - Revokes tokens and disconnects account
- **spotifyGetPlaylists** - Fetches user's Spotify playlists

#### Frontend Composables

- **useSpotifyAuth** - Manages OAuth flow and token lifecycle
- **useSpotifyPlayer** - Wraps Web Playback SDK for player control
- **useSpotifyPlaylists** - Fetches and caches user playlists

#### Frontend Components

- **SpotifyModal** - Main modal with tabs (Player | Playlists)
- **SpotifyPlayer** - Playback controls and now-playing display
- **SpotifyPlaylistGrid** - Grid layout for playlist cards
- **SpotifyPlaylistCard** - Individual playlist card with metadata
- **SpotifyCallbackView** - OAuth callback handler

### Data Storage

```
Firestore:
  users/{userId}/
    spotify/
      tokens:
        - access_token: string
        - refresh_token: string
        - expires_at: timestamp
        - token_type: string
        - scope: string
      
      connection:
        - connected: boolean
        - connected_at: timestamp
```

## User Experience

### Connecting Spotify

1. User clicks Spotify button (♫) in toolbar
2. Modal opens with "Connect Spotify" prompt
3. User clicks connect → redirected to Spotify
4. After authorization → redirected back to canvas
5. Modal shows Player and Playlists tabs

### Playing Music

1. User navigates to Playlists tab
2. Clicks a playlist card
3. Playlist opens in Spotify app (external)
4. User returns to canvas
5. Player tab shows currently playing track
6. Controls: play/pause, previous, next, volume

### Disconnecting

1. User clicks "Disconnect Spotify" in modal footer
2. Tokens removed from Firestore
3. Player stopped and cleaned up
4. Modal returns to connection screen

## Premium Requirement

⚠️ **Spotify Premium is required for playback functionality.**

- Free users can browse playlists
- Attempting playback shows "Premium required" error
- Modal includes link to Spotify Premium signup

## Token Management

### Token Refresh

- Access tokens expire after 1 hour
- `useSpotifyAuth.getAccessToken()` automatically refreshes when needed
- Refresh triggered when token expires in < 1 minute
- New tokens saved to Firestore via `spotifyRefresh` function

### Token Security

- Tokens stored in Firestore with user-level security rules
- Only the token owner can read/write their tokens
- Tokens never exposed to other users
- PKCE prevents authorization code interception

## Development vs Production

### Development Mode

- Limited to 25 users
- Add test users manually in Spotify Dashboard
- Suitable for testing and initial launch

### Extended Quota Mode (Production)

- Unlimited users
- Requires application review by Spotify
- Review timeline: 2-6 weeks
- Still **free** (no API costs)

## Performance Considerations

### Caching

- Playlists cached for 5 minutes
- Reduces API calls and improves responsiveness
- Manual refresh available

### Player Initialization

- SDK loaded asynchronously on first use
- Player instance created per user session
- Automatic reconnection on network issues

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Premium required" | User has free Spotify account | Upgrade to Spotify Premium |
| "Invalid redirect URI" | Mismatch between config and Spotify app | Update redirect URI in Spotify Dashboard |
| "Token expired" | Access token not refreshed | Automatic retry, or disconnect/reconnect |
| "SDK failed to load" | Network issue or ad blocker | Check network, disable ad blockers |
| "Not connected" | User not authorized | Connect Spotify account |

### Error Display

- Errors shown inline in components
- User-friendly messages
- Actionable error states (e.g., "Get Premium" button)

## API Rate Limits

Spotify API limits:
- ~180 requests per minute per user
- Rolling time window
- Exceeded limits return 429 status

Mitigation:
- Client-side caching (5-minute TTL)
- Throttled requests
- Error handling with retry logic

## Security Best Practices

1. **PKCE Flow**: Prevents authorization code interception
2. **Server-side Token Exchange**: Client Secret never exposed to frontend
3. **User-specific Security Rules**: Firestore rules prevent unauthorized access
4. **Token Expiry**: Short-lived access tokens (1 hour)
5. **HTTPS Only**: All OAuth redirects use secure protocol

## Future Enhancements

Potential features to add:

- **Shared Listening**: Display what other users in the canvas are listening to
- **Playback Sync**: Synchronized playback for collaborative sessions
- **Search**: Search Spotify catalog directly in-app
- **Queue Management**: Add songs to queue from within canvas
- **Recommendations**: AI-powered playlist suggestions
- **Analytics**: Track listening habits and favorite genres

## Troubleshooting

### Player Not Initializing

1. Check browser console for errors
2. Verify Premium account status
3. Try disconnecting and reconnecting
4. Clear browser cache

### Playlists Not Loading

1. Check Firestore rules deployment
2. Verify function deployment
3. Check Firebase Functions logs
4. Test token refresh manually

### OAuth Callback Fails

1. Verify redirect URI matches exactly
2. Check PKCE verifier in sessionStorage
3. Review state parameter matching
3. Check function logs for errors

## Code Examples

### Using the Auth Composable

```javascript
import { useSpotifyAuth } from '@/composables/useSpotifyAuth'

const { 
  isConnected, 
  connectSpotify, 
  disconnectSpotify,
  getAccessToken 
} = useSpotifyAuth()

// Connect
await connectSpotify()

// Get valid token
const token = await getAccessToken() // Auto-refreshes if needed

// Disconnect
await disconnectSpotify()
```

### Using the Player Composable

```javascript
import { useSpotifyPlayer } from '@/composables/useSpotifyPlayer'

const {
  isReady,
  isPlaying,
  currentTrack,
  initializePlayer,
  play,
  pause,
  next,
  previous
} = useSpotifyPlayer()

// Initialize
await initializePlayer()

// Play a track
await play('spotify:track:6rqhFgbbKwnb9MLmUQDhG6')

// Control playback
await pause()
await next()
```

### Using the Playlists Composable

```javascript
import { useSpotifyPlaylists } from '@/composables/useSpotifyPlaylists'

const {
  playlists,
  isLoading,
  error,
  fetchPlaylists,
  refreshPlaylists
} = useSpotifyPlaylists()

// Fetch playlists (uses cache if recent)
await fetchPlaylists()

// Force refresh
await refreshPlaylists()
```

## Testing

### Manual Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Token refresh works automatically
- [ ] Playlists load and display correctly
- [ ] Player initializes (Premium account)
- [ ] Playback controls work
- [ ] Volume control works
- [ ] Error handling for non-Premium users
- [ ] Disconnect removes tokens
- [ ] Modal opens/closes properly
- [ ] Multiple users can connect independently

### Test Accounts Needed

- Spotify Premium account (for playback testing)
- Spotify Free account (for error handling testing)
- Multiple test accounts (for concurrent user testing)

## Resources

- [Spotify Web API Reference](https://developer.spotify.com/documentation/web-api)
- [Web Playback SDK Guide](https://developer.spotify.com/documentation/web-playback-sdk/guide)
- [OAuth 2.0 with PKCE](https://oauth.net/2/pkce/)
- [Firebase Functions](https://firebase.google.com/docs/functions)

