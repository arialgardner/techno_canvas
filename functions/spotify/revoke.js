/**
 * Spotify OAuth - Revoke Tokens
 * Disconnects Spotify account and removes tokens
 */

const {onCall} = require("firebase-functions/v2/https");
const {getFirestore} = require("firebase-admin/firestore");

/**
 * Revoke Spotify tokens and disconnect account
 */
exports.spotifyRevoke = onCall(async (request) => {
  // Verify user is authenticated
  if (!request.auth) {
    throw new Error("User must be authenticated");
  }

  const userId = request.auth.uid;

  try {
    const db = getFirestore();

    // Delete tokens document
    await db.collection("users").doc(userId).collection("spotify").doc("tokens").delete();

    // Update connection status
    await db.collection("users").doc(userId).collection("spotify").doc("connection").set({
      connected: false,
      disconnected_at: Date.now(),
    });

    return {
      success: true,
      message: "Spotify account disconnected successfully",
    };
  } catch (error) {
    console.error("Error in spotifyRevoke:", error);
    throw new Error(`Failed to revoke tokens: ${error.message}`);
  }
});

