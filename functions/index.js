/**
 * Firebase Cloud Functions
 *
 * Main entry point for all Cloud Functions
 */

const {setGlobalOptions} = require("firebase-functions/v2");

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
});

// V6: AI Command System
const {parseAICommand} = require("./ai/parseCommand");

// V7: Spotify Integration
const {
  spotifyAuth,
  spotifyCallback,
  spotifyRefresh,
  spotifyRevoke,
  spotifyGetPlaylists,
  spotifySearch,
} = require("./spotify");

// Export functions
exports.parseAICommand = parseAICommand;

// Spotify functions
exports.spotifyAuth = spotifyAuth;
exports.spotifyCallback = spotifyCallback;
exports.spotifyRefresh = spotifyRefresh;
exports.spotifyRevoke = spotifyRevoke;
exports.spotifyGetPlaylists = spotifyGetPlaylists;
exports.spotifySearch = spotifySearch;
