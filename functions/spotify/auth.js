/**
 * Spotify OAuth - Authorization URL Generation
 * Generates authorization URL with PKCE for secure OAuth flow
 */

const {onCall} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");

// Define secrets for Spotify credentials
const spotifyClientId = defineSecret("SPOTIFY_CLIENT_ID");
const spotifyRedirectUri = defineSecret("SPOTIFY_REDIRECT_URI");

/**
 * Generate Spotify authorization URL
 * Client generates code_verifier and code_challenge before calling this
 */
exports.spotifyAuth = onCall({
  secrets: [spotifyClientId, spotifyRedirectUri],
}, async (request) => {
  const {codeChallenge} = request.data;

  if (!codeChallenge) {
    throw new Error("code_challenge is required for PKCE flow");
  }

  // Spotify OAuth scopes needed for playback and playlists
  const scopes = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-modify-playback-state",
    "playlist-read-private",
    "playlist-read-collaborative",
  ].join(" ");

  // Generate random state for CSRF protection
  const state = generateRandomString(16);

  // Build authorization URL
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.append("client_id", spotifyClientId.value());
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_uri", spotifyRedirectUri.value());
  authUrl.searchParams.append("scope", scopes);
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append("code_challenge_method", "S256");
  authUrl.searchParams.append("code_challenge", codeChallenge);

  return {
    authUrl: authUrl.toString(),
    state,
  };
});

/**
 * Generate random string for state parameter
 * @param {number} length - Length of random string
 * @return {string} Random string
 */
function generateRandomString(length) {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map((x) => possible[x % possible.length]).join("");
}

