# Spotify Integration Setup Guide

This guide walks you through setting up Spotify integration for Techno Canvas.

## Prerequisites

- Spotify account (Premium required for playback)
- Firebase project with Cloud Functions enabled
- Access to Spotify Developer Dashboard

## Step 1: Register Spotify Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click **"Create app"**
4. Fill in the application details:
   - **App name**: Techno Canvas
   - **App description**: Collaborative canvas with integrated music playback
   - **Redirect URIs**:
     - Development: `http://localhost:5173/spotify-callback`
     - Production: `https://YOUR-PROJECT-ID.web.app/spotify-callback`
   - **APIs used**: Web Playback SDK
5. Accept Spotify's Terms of Service
6. Click **"Save"**
7. On the app dashboard, click **"Settings"**
8. Copy your **Client ID** and **Client Secret** (you'll need these in Step 2)

## Step 2: Configure Firebase Functions

### Set up Secrets

Use Firebase CLI to configure Spotify credentials as secrets:

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Set Spotify credentials
firebase functions:secrets:set SPOTIFY_CLIENT_ID
# Paste your Client ID when prompted

firebase functions:secrets:set SPOTIFY_CLIENT_SECRET  
# Paste your Client Secret when prompted

firebase functions:secrets:set SPOTIFY_REDIRECT_URI
# For production: https://YOUR-PROJECT-ID.web.app/spotify-callback
# For development: http://localhost:5173/spotify-callback
```

### Local Development

For local development, create `.env.local` in the `functions/` directory:

```bash
cd functions
touch .env.local
```

Add your credentials:

```
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:5173/spotify-callback
```

**⚠️ Important**: Never commit `.env.local` to version control!

## Step 3: Deploy Functions

Deploy your Firebase Functions:

```bash
# From project root
firebase deploy --only functions
```

This will deploy the following functions:
- `spotifyAuth` - Generate authorization URL
- `spotifyCallback` - Exchange code for tokens
- `spotifyRefresh` - Refresh expired tokens
- `spotifyRevoke` - Disconnect Spotify account
- `spotifyGetPlaylists` - Fetch user playlists

## Step 4: Deploy Firestore Rules

Deploy the updated Firestore security rules:

```bash
firebase deploy --only firestore:rules
```

## Step 5: Deploy Frontend

Build and deploy your frontend:

```bash
# Build frontend
cd ui
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

## Step 6: Configure Development Mode Users

Spotify apps start in **Development Mode** with a limit of 25 users.

### Add Test Users

1. Go to your app in [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **"Settings"**
3. Scroll to **"Users and Access"**
4. Click **"Add New User"**
5. Enter the Spotify account email or username
6. Save

**Note**: Only added users can connect their Spotify accounts in Development Mode.

## Step 7: Test the Integration

1. Navigate to your deployed app
2. Open a canvas
3. Click the **Spotify** button in the toolbar (♫ icon)
4. Click **"Connect Spotify"**
5. Authorize the app
6. You should be redirected back to your canvas
7. The Spotify modal should now show the Player and Playlists tabs

## Production: Extended Quota Mode

Once you're ready for production (>25 users):

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your app
3. Click **"Request Extension"**
4. Fill out the quota extension form:
   - Provide app description
   - Upload screenshots
   - Explain your use case
   - Include branding assets
5. Submit for review

**Review timeline**: 2-6 weeks

**Cost**: Free (no charges for Spotify API usage)

## Troubleshooting

### "Invalid redirect URI" error

- Ensure the redirect URI in your Spotify app settings **exactly matches** the `SPOTIFY_REDIRECT_URI` secret
- Include the protocol (`http://` or `https://`)
- No trailing slashes

### "Premium required" error

- Only Spotify Premium users can use the Web Playback SDK
- Free Spotify users will see an error when trying to play music
- Playlist browsing works for all users

### "Token expired" error

- The app automatically refreshes tokens when they expire
- If you see this error, try disconnecting and reconnecting your Spotify account

### Functions not deploying

- Ensure you're on the Blaze plan (pay-as-you-go)
- Check that secrets are set correctly:
  ```bash
  firebase functions:secrets:access SPOTIFY_CLIENT_ID
  ```
- Review function logs:
  ```bash
  firebase functions:log
  ```

### SDK not loading

- Check browser console for errors
- Ensure `https://sdk.scdn.co/spotify-player.js` is loading
- Try disabling ad blockers (they sometimes block Spotify SDK)

## Security Notes

- **Never** expose your Client Secret in frontend code
- All OAuth flows are handled server-side via Firebase Functions
- Tokens are stored securely in Firestore with user-level security rules
- PKCE (Proof Key for Code Exchange) is used for additional security

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `SPOTIFY_CLIENT_ID` | Your Spotify app's Client ID | `a1b2c3d4e5f6g7h8i9j0` |
| `SPOTIFY_CLIENT_SECRET` | Your Spotify app's Client Secret | `z9y8x7w6v5u4t3s2r1q0` |
| `SPOTIFY_REDIRECT_URI` | OAuth callback URL | `https://myapp.web.app/spotify-callback` |

## Next Steps

- Add more Spotify features (search, recommendations, queue management)
- Implement collaborative playlists
- Add playback synchronization between users
- Display what other users are listening to

## Additional Resources

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api)
- [Spotify Web Playback SDK Documentation](https://developer.spotify.com/documentation/web-playback-sdk)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)

