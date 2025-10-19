/**
 * Spotify API - Get User Playlists
 * Fetches user's playlists from Spotify API
 */

const {onCall} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

/**
 * Get user's Spotify playlists
 */
exports.spotifyGetPlaylists = onCall(async (request) => {
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

    // Check if token is expired
    if (tokens.expires_at < Date.now()) {
      throw new Error("Access token expired. Please refresh your token.");
    }

    // Fetch playlists from Spotify API
    const playlists = await fetchAllPlaylists(tokens.access_token);

    return {
      success: true,
      playlists,
    };
  } catch (error) {
    console.error("Error in spotifyGetPlaylists:", error);
    throw new Error(`Failed to fetch playlists: ${error.message}`);
  }
});

/**
 * Fetch all playlists with pagination
 * @param {string} accessToken - Spotify access token
 * @return {Promise<Array>} Array of playlist objects
 */
async function fetchAllPlaylists(accessToken) {
  let allPlaylists = [];
  let nextUrl = "https://api.spotify.com/v1/me/playlists?limit=50";

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Spotify API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Extract relevant playlist data
    const playlists = data.items.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || "",
      images: playlist.images || [],
      tracks: {
        total: playlist.tracks?.total || 0,
      },
      owner: {
        display_name: playlist.owner?.display_name || "",
      },
      external_urls: playlist.external_urls || {},
      uri: playlist.uri,
    }));

    allPlaylists = allPlaylists.concat(playlists);

    // Check for next page
    nextUrl = data.next;
  }

  return allPlaylists;
}

