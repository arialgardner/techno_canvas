/**
 * Spotify API - Search for Playlists
 * Uses Client Credentials flow (no user login needed)
 */

const {onCall} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

const spotifyClientId = defineSecret("SPOTIFY_CLIENT_ID");
const spotifyClientSecret = defineSecret("SPOTIFY_CLIENT_SECRET");

// Cache token in memory (valid for 1 hour)
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get access token using Client Credentials flow
 */
async function getAccessToken() {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(
            spotifyClientId.value() + ":" + spotifyClientSecret.value(),
        ).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error("Failed to get Spotify access token");
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Expire 1 min early

    return cachedToken;
  } catch (error) {
    console.error("Error getting Spotify token:", error);
    throw error;
  }
}

/**
 * Search Spotify for playlists by query
 */
exports.spotifySearch = onCall({
  secrets: [spotifyClientId, spotifyClientSecret],
  cors: true, // Enable CORS for all origins
}, async (request) => {
  const {query, limit = 12} = request.data;

  if (!query) {
    throw new Error("Search query is required");
  }

  try {
    const accessToken = await getAccessToken();

    // Search for playlists
    const searchParams = new URLSearchParams({
      q: query,
      type: "playlist",
      limit: limit.toString(),
    });

    const response = await fetch(
        `https://api.spotify.com/v1/search?${searchParams}`,
        {
          headers: {
            "Authorization": `Bearer ${accessToken}`,
          },
        },
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Spotify search failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Extract relevant playlist data (filter out null items)
    const playlists = data.playlists.items
        .filter((playlist) => playlist !== null)
        .map((playlist) => ({
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
          uri: `playlist:${playlist.id}`,
        }));

    return {
      success: true,
      playlists,
      query,
    };
  } catch (error) {
    console.error("Error searching Spotify:", error);
    throw new Error(`Failed to search Spotify: ${error.message}`);
  }
});

