/**
 * Spotify OAuth - Token Refresh
 * Refreshes expired access tokens using refresh token
 */

const {onCall} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {getFirestore} = require("firebase-admin/firestore");

const spotifyClientId = defineSecret("SPOTIFY_CLIENT_ID");
const spotifyClientSecret = defineSecret("SPOTIFY_CLIENT_SECRET");

/**
 * Refresh access token
 */
exports.spotifyRefresh = onCall({
  secrets: [spotifyClientId, spotifyClientSecret],
}, async (request) => {
  // Verify user is authenticated
  if (!request.auth) {
    throw new Error("User must be authenticated");
  }

  const userId = request.auth.uid;

  try {
    const db = getFirestore();
    const tokensDoc = await db.collection("users").doc(userId).collection("spotify").doc("tokens").get();

    if (!tokensDoc.exists) {
      throw new Error("No Spotify tokens found. Please connect your Spotify account.");
    }

    const tokens = tokensDoc.data();

    if (!tokens.refresh_token) {
      throw new Error("No refresh token available");
    }

    // Request new access token
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(
            spotifyClientId.value() + ":" + spotifyClientSecret.value(),
        ).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Spotify token refresh failed:", errorData);
      throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error}`);
    }

    const tokenData = await tokenResponse.json();

    // Calculate expiry timestamp
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);

    // Update tokens in Firestore
    await db.collection("users").doc(userId).collection("spotify").doc("tokens").update({
      access_token: tokenData.access_token,
      expires_at: expiresAt,
      updated_at: Date.now(),
      // Keep existing refresh_token if not provided in response
      ...(tokenData.refresh_token && {refresh_token: tokenData.refresh_token}),
    });

    return {
      success: true,
      access_token: tokenData.access_token,
      expiresAt,
    };
  } catch (error) {
    console.error("Error in spotifyRefresh:", error);
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
});

