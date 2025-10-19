/**
 * Spotify OAuth - Authorization Callback
 * Exchanges authorization code for access and refresh tokens
 */

const {onCall} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {getFirestore} = require("firebase-admin/firestore");

const spotifyClientId = defineSecret("SPOTIFY_CLIENT_ID");
const spotifyClientSecret = defineSecret("SPOTIFY_CLIENT_SECRET");
const spotifyRedirectUri = defineSecret("SPOTIFY_REDIRECT_URI");

/**
 * Exchange authorization code for tokens
 */
exports.spotifyCallback = onCall({
  secrets: [spotifyClientId, spotifyClientSecret, spotifyRedirectUri],
}, async (request) => {
  // Verify user is authenticated
  if (!request.auth) {
    throw new Error("User must be authenticated");
  }

  const {code, codeVerifier} = request.data;

  if (!code || !codeVerifier) {
    throw new Error("code and code_verifier are required");
  }

  const userId = request.auth.uid;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(
            spotifyClientId.value() + ":" + spotifyClientSecret.value(),
        ).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: spotifyRedirectUri.value(),
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Spotify token exchange failed:", errorData);
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
    }

    const tokenData = await tokenResponse.json();

    // Calculate expiry timestamp
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);

    // Store tokens in Firestore (encrypted in production, plain for now)
    const db = getFirestore();
    await db.collection("users").doc(userId).collection("spotify").doc("tokens").set({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      updated_at: Date.now(),
    });

    // Mark user as connected
    await db.collection("users").doc(userId).collection("spotify").doc("connection").set({
      connected: true,
      connected_at: Date.now(),
    });

    return {
      success: true,
      expiresAt,
    };
  } catch (error) {
    console.error("Error in spotifyCallback:", error);
    throw new Error(`Failed to complete OAuth flow: ${error.message}`);
  }
});

